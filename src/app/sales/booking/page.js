'use client';
import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { computeFormulas, fieldFlags, installmentBase, rupee } from '../../../lib/bookingFormulas';
import { downloadLOI } from '../../../lib/bookingLOI';


// Normalise legacy lowercase source names stored in the DB to display equivalents.
const srcDisplay = (name) => {
  if (!name) return name;
  if (/^referral$/i.test(name)) return 'Reference';
  if (/^other$/i.test(name)) return 'Other';
  return name;
};

// <input type="date"> needs a zero-padded yyyy-mm-dd or it throws in Safari.
function safeDate(s) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}

export default function BookingPageWrapper() {
  return <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}><BookingPage /></Suspense>;
}

function BookingPage() {
  const router = useRouter();
  const qp = useSearchParams();
  const me = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cq = (sep) => (companyId ? `${sep}company_id=${companyId}` : '');

  const reviseId  = qp.get('revise') || '';
  const convertEoiId = qp.get('convertEoi') || '';   // converting an EOI into a plot booking
  const [projectId, setProjectId] = useState(qp.get('project'));
  // Multi-plot: `plots` query param is a comma list of ids; fall back to single `plot`.
  const [plotIds,   setPlotIds]   = useState((qp.get('plots') || qp.get('plot') || '').split(',').map((s) => s.trim()).filter(Boolean));
  const plotId    = plotIds[0] || '';
  const leadId    = qp.get('lead') || '';
  // EOI (Expression of Interest): a booking on a project with no plots yet. No plot is
  // selected; a sequential per-project EOI code (EOI-1, EOI-2…) stands in for the plot no.
  const eoiMode   = !reviseId && (qp.get('eoi') === '1' || qp.get('eoi') === 'true');
  const [eoiNo, setEoiNo] = useState('');
  const [eoiType, setEoiType] = useState('');   // selected EOI standard unit type

  const [project, setProject] = useState(null);
  const [plot,    setPlot]    = useState(null);   // primary (first) plot
  const [plots,   setPlots]   = useState([]);     // all selected plots
  const [sources, setSources] = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');

  // form state
  const [f, setF] = useState({
    client_name: qp.get('client') || '', gender: '', phone: qp.get('phone') || '', address: '', source: '',
    area: '', area_unit: 'sq.yd', const_area: '', villa_type: '',
    land_rate: '', dev_rate: '', const_rate: '', sale_deed_rate: '', dev_agreement_rate: '',
    sale_deed_pct: '60', sale_deed_amount: '',
    land_sale_deed: '', const_agreement: '', premium_location: '',
    discount: '0', legal_charges: '', maint_rate: '', maint_months: '',
    apply_reg_fee: 'Yes', apply_page_fee: 'Yes', apply_stamp_duty: 'Yes', apply_gst: 'Yes',
    booking_date: new Date().toISOString().slice(0, 10), cp_name: '',
  });
  const [errs, setErrs] = useState({});   // required-field highlight on Generate/Submit
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErrs((e) => (e[k] ? { ...e, [k]: false } : e)); };
  const [insts, setInsts] = useState([]); // [{date,pct,amt}]
  const [nsdInsts, setNsdInsts] = useState([]); // extra work charges installments (ankhol)
  const [extraDate, setExtraDate] = useState(''); // due date for the Extra Charges line
  const [ew, setEw] = useState({ desc: '', amt: '' });       // extra work (revise mode)
  const [ewInsts, setEwInsts] = useState([]);                // [{date,pct,amt}]
  const [extraTerms, setExtraTerms] = useState([]);          // [{title,desc}] — appended below default LOI terms
  const addTerm    = () => setExtraTerms((s) => [...s, { title: '', desc: '' }]);
  const setTerm    = (i, k, val) => setExtraTerms((s) => s.map((t, j) => (j === i ? { ...t, [k]: val } : t)));
  const removeTerm = (i) => setExtraTerms((s) => s.filter((_, j) => j !== i));
  const cleanTerms = () => extraTerms.map((t) => ({ title: (t.title || '').trim(), desc: (t.desc || '').trim() })).filter((t) => t.title || t.desc);
  const [loiDone, setLoiDone] = useState(false);
  const [loiFile, setLoiFile] = useState(null); // {name,type,data(base64)}
  const [deedAmtStr, setDeedAmtStr] = useState('');
  const editingAmtRef = useRef(false);

  // Revision mode: load the existing booking and prefill the form.
  useEffect(() => {
    if (!reviseId) return;
    fetch(SALES_ENDPOINTS.bookings + cq('?'), { headers: authHeaders() }).then(r => r.json()).then((arr) => {
      const b = (Array.isArray(arr) ? arr : []).find((x) => String(x.id) === String(reviseId));
      if (!b) return;
      setProjectId(String(b.project));
      setPlotIds(((b.plot_ids && b.plot_ids.length ? b.plot_ids : [b.plot]).filter(Boolean)).map(String));
      setF((s) => ({
        ...s, client_name: b.client_name || '', gender: b.gender || '', phone: b.phone || '', address: b.address || '', source: srcDisplay(b.source || ''),
        area: b.area || '', area_unit: b.area_unit || 'sq.yd', const_area: b.const_area || '', villa_type: b.villa_type || '',
        land_rate: b.land_rate, dev_rate: b.dev_rate, const_rate: b.const_rate, sale_deed_rate: b.sale_deed_rate, dev_agreement_rate: b.dev_agreement_rate,
        sale_deed_pct: b.sale_deed_pct != null ? String(b.sale_deed_pct) : '60',
        sale_deed_amount: b.sale_deed_amount ? String(b.sale_deed_amount) : '',
        land_sale_deed: b.land_sale_deed, const_agreement: b.const_agreement, premium_location: b.premium_location,
        discount: b.discount, legal_charges: b.legal_charges, maint_rate: b.maint_rate, maint_months: b.maint_months,
        apply_reg_fee: b.apply_reg_fee || 'Yes', apply_page_fee: b.apply_page_fee || 'Yes', apply_stamp_duty: b.apply_stamp_duty || 'Yes', apply_gst: b.apply_gst || 'Yes',
        booking_date: safeDate(b.booking_date) || s.booking_date, cp_name: b.cp_name || '',
      }));
      if (Array.isArray(b.installments)) {
        setInsts(b.installments.filter((i) => !i.isExtra && !i.isExtraWork && !i.isNsd).map((i) => ({ date: safeDate(i.date), pct: String(i.pct || ''), amt: String(i.amt || '') })));
        setNsdInsts(b.installments.filter((i) => i.isNsd).map((i) => ({ date: safeDate(i.date), pct: String(i.pct || ''), amt: String(i.amt || '') })));
        const ex = b.installments.find((i) => i.isExtra);
        if (ex) setExtraDate(safeDate(ex.date));
      }
      setEw({ desc: b.extra_work_desc || '', amt: b.extra_work_amount ? String(b.extra_work_amount) : '' });
      if (Array.isArray(b.extra_work_inst)) setEwInsts(b.extra_work_inst.map((i) => ({ date: safeDate(i.date), pct: String(i.pct || ''), amt: String(i.amt || '') })));
      if (Array.isArray(b.extra_terms)) setExtraTerms(b.extra_terms.map((t) => ({ title: t.title || '', desc: t.desc || '' })));
    });
  }, [reviseId]);

  // Convert EOI → LOI: prefill everything from the source EOI. Plot & Plot Area come from
  // the newly-picked plot (URL); Construction Area comes from the EOI. All fields editable.
  useEffect(() => {
    if (!convertEoiId) return;
    fetch(SALES_ENDPOINTS.bookings + cq('?'), { headers: authHeaders() }).then(r => r.json()).then((arr) => {
      const b = (Array.isArray(arr) ? arr : []).find((x) => String(x.id) === String(convertEoiId));
      if (!b) return;
      setF((s) => ({
        ...s, client_name: b.client_name || '', gender: b.gender || '', phone: b.phone || '', address: b.address || '', source: srcDisplay(b.source || ''),
        area_unit: b.area_unit || s.area_unit, const_area: b.const_area || '', villa_type: b.villa_type || '',
        land_rate: b.land_rate, dev_rate: b.dev_rate, const_rate: b.const_rate, sale_deed_rate: b.sale_deed_rate, dev_agreement_rate: b.dev_agreement_rate,
        sale_deed_pct: b.sale_deed_pct != null ? String(b.sale_deed_pct) : '60',
        land_sale_deed: b.land_sale_deed, const_agreement: b.const_agreement, premium_location: b.premium_location,
        discount: b.discount, legal_charges: b.legal_charges, maint_rate: b.maint_rate, maint_months: b.maint_months,
        apply_reg_fee: b.apply_reg_fee || 'Yes', apply_page_fee: b.apply_page_fee || 'Yes', apply_stamp_duty: b.apply_stamp_duty || 'Yes', apply_gst: b.apply_gst || 'Yes',
        booking_date: safeDate(b.booking_date) || s.booking_date, cp_name: b.cp_name || '',
      }));
      if (Array.isArray(b.installments)) {
        setInsts(b.installments.filter((i) => !i.isExtra && !i.isExtraWork && !i.isNsd).map((i) => ({ date: safeDate(i.date), pct: String(i.pct || ''), amt: String(i.amt || '') })));
        setNsdInsts(b.installments.filter((i) => i.isNsd).map((i) => ({ date: safeDate(i.date), pct: String(i.pct || ''), amt: String(i.amt || '') })));
      }
      if (Array.isArray(b.extra_terms)) setExtraTerms(b.extra_terms.map((t) => ({ title: t.title || '', desc: t.desc || '' })));
    });
  }, [convertEoiId]);

  useEffect(() => {
    if (projectId) fetch(`${SALES_ENDPOINTS.projects}${projectId}/${cq('?')}`, { headers: authHeaders() }).then(r => r.json()).then((p) => {
      setProject(p);
      setF((s) => ({ ...s, area_unit: (p.formula_set === 'kalrav' ? 'sq.yd' : 'sq.ft') }));
    });
    if (projectId) fetch(SALES_ENDPOINTS.plots + `?project=${projectId}${cq('&')}`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : [])).then((arr) => {
        const all = Array.isArray(arr) ? arr : [];
        // Resolve every selected plot (preserve the chosen order) and sum their areas.
        const picked = plotIds.map((pid) => all.find((x) => String(x.id) === String(pid))).filter(Boolean);
        if (picked.length) {
          setPlots(picked); setPlot(picked[0]);
          const sumArea = picked.reduce((a, p) => a + (parseFloat((p.size || '').replace(/[^\d.]/g, '')) || 0), 0);
          // Auto-map construction area from the plot definition(s) into the booking.
          const sumConst = picked.reduce((a, p) => a + (parseFloat((p.construction_area || '').replace(/[^\d.]/g, '')) || 0), 0);
          setF((s) => ({
            ...s,
            area: sumArea ? String(+sumArea.toFixed(2)) : s.area,
            // When converting an EOI, Construction Area comes from the EOI, not the plot.
            const_area: (sumConst && !convertEoiId) ? String(+sumConst.toFixed(2)) : s.const_area,
            villa_type: '',
          }));
        }
      }).catch(() => {});
    fetch(SALES_ENDPOINTS.sources + cq('?'), { headers: authHeaders() }).then(r => r.json()).then((d) => setSources(Array.isArray(d) ? d : []));
    // EOI: fetch the next per-project EOI code to show in the form + the LOI/EOI PDF.
    if (eoiMode && projectId) fetch(`${SALES_ENDPOINTS.bookings}next-eoi/?project=${projectId}${cq('&')}`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null)).then((d) => { if (d && d.eoi_no) setEoiNo(d.eoi_no); }).catch(() => {});
  }, [projectId, plotIds.join(','), companyId, eoiMode]);

  // Comma display of every selected plot ("12, 13, 14").
  const plotNumbers = useMemo(
    () => {
      if (eoiMode) return eoiNo;
      const strip = (n) => { const s = (n || '').toString(); return s.replace(/^[^0-9]*/, '') || s; };
      return plots.length ? plots.map((p) => strip(p.number)).join(', ') : strip(plot?.number || '');
    },
    [plots, plot, eoiMode, eoiNo],
  );

  const formulaSet = project?.formula_set || 'kalrav';
  const flags = useMemo(() => fieldFlags(formulaSet), [formulaSet]);
  // All pricing sets share the sale-deed % split (Unit Price + Additional Extra Work Amount).
  const hasSaleDeedSplit = formulaSet === 'ankhol' || formulaSet === 'kalrav' || formulaSet === 'industrial';
  // In EOI, area is locked only when the project defines standard unit types (picked from the
  // Unit Type dropdown). Sets without unit types (e.g. Industrial) keep the area editable.
  const eoiLocked = eoiMode && (project?.eoi_unit_types || []).length > 0;

  const v = useMemo(() => computeFormulas({
    formulaSet, projectName: project?.name,
    area: f.area, landRate: f.land_rate, devRate: f.dev_rate, constArea: f.const_area, constRate: f.const_rate,
    discount: f.discount, legalCharges: f.legal_charges, maintRate: f.maint_rate, maintMonths: f.maint_months,
    gender: f.gender, landSaleDeed: f.land_sale_deed, constAgreement: f.const_agreement,
    premiumLocation: f.premium_location, saleDeedRate: f.sale_deed_rate, devAgreementRate: f.dev_agreement_rate,
    saleDeedPct: f.sale_deed_pct, saleDeedAmount: f.sale_deed_amount,
    applyRegFee: f.apply_reg_fee, applyPageFee: f.apply_page_fee, applyStampDuty: f.apply_stamp_duty, applyGst: f.apply_gst,
    extraWorkAmt: reviseId ? ew.amt : 0, extraWorkDesc: ew.desc,
  }), [f, formulaSet, project, ew, reviseId]);

  useEffect(() => {
    if (!editingAmtRef.current) setDeedAmtStr(String(Math.round(v.saleDeed) || ''));
  }, [v.saleDeed]);

  // Warn before leaving the booking form once meaningful data has been entered
  // (covers accidental back-button / gesture / refresh / tab-close).
  const isDirty = !!(f.land_rate || f.dev_rate || f.const_rate || f.premium_location || f.sale_deed_amount
    || f.legal_charges || f.maint_rate || insts.length || nsdInsts.length || deedAmtStr || loiFile);
  useEffect(() => {
    const beforeUnload = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [isDirty]);
  useEffect(() => {
    if (!isDirty) return;
    window.history.pushState(null, '', window.location.href);
    const onPop = () => {
      if (window.confirm('Are you sure you want to go back? Your unsaved booking details will be lost.')) {
        window.removeEventListener('popstate', onPop);
        router.back();
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isDirty, router]);

  const base = installmentBase(v);
  const pctTotal = base ? insts.reduce((a, r) => a + (parseFloat(r.amt) || 0), 0) / base * 100 : insts.reduce((a, r) => a + (parseFloat(r.pct) || 0), 0);
  const ewBase = parseFloat(ew.amt) || 0;
  const ewPctTotal = ewBase ? ewInsts.reduce((a, r) => a + (parseFloat(r.amt) || 0), 0) / ewBase * 100 : ewInsts.reduce((a, r) => a + (parseFloat(r.pct) || 0), 0);
  function buildEw(n) {
    n = parseInt(n, 10) || 0;
    setEwInsts(Array.from({ length: n }, (_, i) => ewInsts[i] || { date: '', pct: '', amt: '' }));
  }
  function setEwInst(i, k, val) {
    setEwInsts((arr) => {
      const next = arr.map((r, idx) => {
        if (idx !== i) return r;
        const nr = { ...r, [k]: val };
        if (k === 'pct') nr.amt = val && ewBase ? String(Math.round(ewBase * parseFloat(val) / 100)) : '';
        if (k === 'amt') nr.pct = val && ewBase ? (parseFloat(val) / ewBase * 100).toFixed(2) : '';
        return nr;
      });
      const last = next.length - 1;
      if (last > 0 && i < last) {
        const usedAmt = next.slice(0, last).reduce((a, r) => a + (parseFloat(r.amt) || 0), 0);
        const remAmt = Math.max(0, Math.round((ewBase || 0) - usedAmt));
        const remPct = ewBase ? parseFloat((remAmt / ewBase * 100).toFixed(2)) : 0;
        next[last] = { ...next[last], amt: String(remAmt), pct: String(remPct) };
      }
      return next;
    });
  }
  const ewArr = () => ewInsts.map((r, i) => ({ no: i + 1, date: r.date, pct: parseFloat(r.pct) || 0, amt: parseFloat(r.amt) || 0, isExtraWork: true }));
  const inr = (n) => Number(n || 0).toLocaleString('en-IN');
  const extraSub = formulaSet === 'ankhol' ? 'Stamp + Reg + GST + Maint Dep + Maint Adv + Legal'
    : formulaSet === 'industrial' ? 'Stamp + Reg + GST + Maint Dep + Maint Adv + Legal'
    : 'Stamp + Reg + GST + Maintenance + Legal';
  const extraSub2 = formulaSet === 'ankhol'
    ? `${inr(v.stampDuty)} + ${inr(v.regFees)} + ${inr(v.gst)} + ${inr(v.maintDeposit)} + ${inr(v.maintAdvance)} + ${inr(v.legal)}`
    : formulaSet === 'industrial'
      ? `${inr(v.stampDuty)} + ${inr(v.regFees)} + ${inr(v.gst)} + ${inr(v.maintDeposit)} + ${inr(v.maintAdvance)} + ${inr(v.legal)}`
      : `${inr(v.stampDuty)} + ${inr(v.regFees)} + ${inr(v.gst)} + ${inr(v.maint)} + ${inr(v.legal)}`;
  const sdPct = Math.round((v.saleDeedPct || 0) * 100) / 100;   // display % capped at 2 decimals
  const saleDeedSub = hasSaleDeedSplit ? `${sdPct}% × Total Basic Amount` : 'Sale Deed Rate × Plot Area';
  const saleDeedSub2 = hasSaleDeedSplit
    ? `${sdPct}% × ${inr(v.plotBasic + v.plotDev + v.constAmt + v.premiumLocation)}`
    : `${inr(v.saleDeedRate)} × ${inr(v.area)}`;
  // formula sub-labels shown under each computed value (mirrors GAS)
  const stampSub = (hasSaleDeedSplit && f.apply_stamp_duty === 'No') ? 'Not applicable'
    : (formulaSet === 'kalrav' ? '4.9% of Land Sale Deed' : '4.9% of Sale Deed');
  const pageFeeTxt = f.apply_page_fee === 'No' ? '' : ' + ₹1,500';
  const femPage = f.apply_page_fee === 'No' ? '₹0' : '₹1,500';
  const regSub = f.apply_reg_fee === 'No'
    ? (f.apply_page_fee === 'No' ? 'Not applicable' : 'Page Fee only (₹1,500)')
    : (formulaSet === 'ankhol' ? `1% of Sale Deed${pageFeeTxt}`
      : formulaSet === 'industrial' ? `Male: 1% Sale Deed${pageFeeTxt} | Female: ${femPage}`
      : `Male: 1% LSD${pageFeeTxt} | Female: ${femPage}`);
  const gstSub = (hasSaleDeedSplit && f.apply_gst === 'No') ? 'Not applicable'
    : (formulaSet === 'ankhol' ? '5% of Sale Deed'
      : formulaSet === 'industrial' ? (v.isTundav ? '18% of 67% of Sale Deed' : '18% of Development Agreement')
      : '18% of Construction Agreement');
  const maintSub = formulaSet === 'ankhol' ? 'Construction Area × Rate × Months'
    : formulaSet === 'industrial' ? 'Plot Area × Rate' : 'Plot Area × Rate × Months';

  function buildInsts(n) {
    n = parseInt(n, 10) || 0;
    setInsts(Array.from({ length: n }, (_, i) => insts[i] || { date: '', pct: '', amt: '' }));
  }
  function setInst(i, k, val) {
    setInsts((arr) => {
      const next = arr.map((r, idx) => {
        if (idx !== i) return r;
        const nr = { ...r, [k]: val };
        if (k === 'pct') nr.amt = val && base ? String(Math.round(base * parseFloat(val) / 100)) : '';
        if (k === 'amt') nr.pct = val && base ? (parseFloat(val) / base * 100).toFixed(2) : '';
        return nr;
      });
      const last = next.length - 1;
      if (last > 0 && i < last) {
        const usedAmt = next.slice(0, last).reduce((a, r) => a + (parseFloat(r.amt) || 0), 0);
        const remAmt = Math.max(0, Math.round((base || 0) - usedAmt));
        const remPct = base ? parseFloat((remAmt / base * 100).toFixed(2)) : 0;
        next[last] = { ...next[last], amt: String(remAmt), pct: String(remPct) };
      }
      return next;
    });
  }

  const nsdBase = Math.max(0, (v.nonSaleDeed || 0) - (v.discount || 0));
  const nsdPctTotal = nsdBase ? nsdInsts.reduce((a, r) => a + (parseFloat(r.amt) || 0), 0) / nsdBase * 100 : nsdInsts.reduce((a, r) => a + (parseFloat(r.pct) || 0), 0);
  function buildNsdInsts(n) { n = parseInt(n, 10) || 0; setNsdInsts(Array.from({ length: n }, (_, i) => nsdInsts[i] || { date: '', pct: '', amt: '' })); }
  function setNsdInst(i, k, val) {
    setNsdInsts((arr) => {
      const next = arr.map((r, idx) => {
        if (idx !== i) return r;
        const nr = { ...r, [k]: val };
        if (k === 'pct') nr.amt = val && nsdBase ? String(Math.round(nsdBase * parseFloat(val) / 100)) : '';
        if (k === 'amt') nr.pct = val && nsdBase ? (parseFloat(val) / nsdBase * 100).toFixed(2) : '';
        return nr;
      });
      const last = next.length - 1;
      if (last > 0 && i < last) {
        const usedAmt = next.slice(0, last).reduce((a, r) => a + (parseFloat(r.amt) || 0), 0);
        const remAmt = Math.max(0, Math.round((nsdBase || 0) - usedAmt));
        const remPct = nsdBase ? parseFloat((remAmt / nsdBase * 100).toFixed(2)) : 0;
        next[last] = { ...next[last], amt: String(remAmt), pct: String(remPct) };
      }
      return next;
    });
  }
  function instArr() {
    const arr = insts.map((r, i) => ({ no: i + 1, date: r.date, pct: parseFloat(r.pct) || 0, amt: parseFloat(r.amt) || 0 }));
    nsdInsts.forEach((r, i) => arr.push({ no: i + 1, date: r.date, pct: parseFloat(r.pct) || 0, amt: parseFloat(r.amt) || 0, isNsd: true }));
    arr.push({ no: 'Extra', date: extraDate, amt: Math.round(v.totalExtra), isExtra: true });
    return arr;
  }
  async function doDownloadLOI() {
    const e = {};
    if (!f.client_name.trim()) e.client_name = true;
    if (!f.phone.trim()) e.phone = true;
    if (!v.plotBasic) { if (!f.area) e.area = true; if (!f.land_rate) e.land_rate = true; }
    if (Object.keys(e).length) { setErrs(e); setMsg('Please fill the highlighted fields.'); return; }
    setErrs({});
    // Installments must total 100% before the LOI — EXCEPT for an EOI, where a partial
    // (token) schedule is allowed and the 100% rule does not apply.
    if (!eoiMode) {
      if (!insts.length) { setMsg('Add the payment installments before downloading the LOI.'); return; }
      if (Math.abs(pctTotal - 100) > 0.01) { setMsg('Payment installments must total 100% before downloading the LOI.'); return; }
      if (hasSaleDeedSplit && nsdBase > 0 && (!nsdInsts.length || Math.abs(nsdPctTotal - 100) > 0.01)) {
        setMsg('Extra Work Amount installments must be filled and total 100% before downloading the LOI.'); return;
      }
    }
    const meta = {
      clientName: f.client_name, phoneNumber: f.phone, gender: f.gender, address: f.address,
      project: project?.name, plotNo: plotNumbers || plot?.number, bookingDate: f.booking_date,
      villaType: f.villa_type, bunglowType: flags.bunglowTypeFixed || '', cpName: f.cp_name, loggedInUser: me?.name, source: f.source,
      areaUnit: f.area_unit || flags.areaUnit,
    };
    try { await downloadLOI(meta, v, instArr(), { formulaSet, projectName: project?.name, projectLogoUrl: project?.logo_url, isRevision: !!reviseId, revNo: (reviseId ? 1 : 0), extraWorkInst: ewArr(), extraTerms: cleanTerms(), areaUnit: f.area_unit || flags.areaUnit }); setLoiDone(true); setMsg('✅ LOI downloaded — get it signed and upload below.'); }
    catch (e) { setMsg('LOI error: ' + e.message); }
  }
  function onFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLoiFile({ name: file.name, type: file.type, data: reader.result.split(',')[1] });
    reader.readAsDataURL(file);
  }

  async function submit() {
    const e = {};
    if (!f.client_name.trim()) e.client_name = true;
    if (!f.phone.trim()) e.phone = true;
    if (!f.land_rate || !v.plotBasic) { e.land_rate = true; if (!f.area) e.area = true; }
    if (Object.keys(e).length) { setErrs(e); setMsg('Please fill the highlighted fields.'); return; }
    setErrs({});
    if (!eoiMode && insts.length && Math.abs(pctTotal - 100) > 0.01) { setMsg('Installments must total 100%.'); return; }
    if (!loiFile) { setMsg('Download the LOI, get it signed, and upload it before submitting.'); return; }
    setSaving(true); setMsg('');
    const payload = {
      project: projectId, plot: eoiMode ? undefined : plotId, plot_ids: eoiMode ? [] : plotIds, lead: leadId || undefined,
      ...(eoiMode ? { eoi: true, eoi_no: eoiNo } : {}),
      client_name: f.client_name.trim(), gender: f.gender, phone: f.phone.trim(), address: f.address, source: f.source,
      formula_set: formulaSet, area: f.area, area_unit: f.area_unit, const_area: f.const_area || '0',
      villa_type: flags.bunglowTypeIsDropdown ? f.villa_type : '', bunglow_type: flags.bunglowTypeFixed || '',
      land_rate: f.land_rate || 0, dev_rate: f.dev_rate || 0, const_rate: f.const_rate || 0,
      sale_deed_rate: f.sale_deed_rate || 0, dev_agreement_rate: f.dev_agreement_rate || 0,
      sale_deed_pct: f.sale_deed_pct === '' || f.sale_deed_pct == null ? 60 : f.sale_deed_pct,
      sale_deed_amount: f.sale_deed_amount || 0,
      maint_rate: f.maint_rate || 0, maint_months: f.maint_months || 0,
      plot_basic: Math.round(v.plotBasic), plot_dev: Math.round(v.plotDev), const_amt: Math.round(v.constAmt),
      sale_deed: Math.round(v.saleDeed), dev_agreement: Math.round(v.devAgreement),
      land_sale_deed: f.land_sale_deed || 0, const_agreement: f.const_agreement || 0,
      stamp_duty: Math.round(v.stampDuty), reg_fees: Math.round(v.regFees), gst: Math.round(v.gst),
      maintenance: Math.round(v.maint), maint_deposit: Math.round(v.maintDeposit), maint_advance: Math.round(v.maintAdvance),
      legal_charges: f.legal_charges || 0, premium_location: f.premium_location || 0,
      total_extra: Math.round(v.totalExtra), discount: f.discount || 0, final_amount: Math.round(v.finalAmt),
      apply_reg_fee: f.apply_reg_fee, apply_page_fee: f.apply_page_fee, apply_stamp_duty: f.apply_stamp_duty, apply_gst: f.apply_gst,
      installments: instArr(),
      extra_work_desc: reviseId ? (ew.desc || '') : '',
      extra_work_amount: reviseId ? Math.round(parseFloat(ew.amt) || 0) : 0,
      extra_work_inst: reviseId ? ewArr() : [],
      extra_terms: cleanTerms(),
      booking_date: f.booking_date, cp_name: f.cp_name,
      loi_file: loiFile,   // {name,type,data} → saved server-side
      ...(reviseId ? { revision_of: reviseId } : {}),
    };
    try {
      const res = await fetch(SALES_ENDPOINTS.bookings + cq('?'), { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
      if (res.ok) {
        setMsg('✅ Booking submitted — sent for approval.');
        try { sessionStorage.setItem('booking_flash', 'Your booking has been submitted and sent for approval.'); } catch {}
        setTimeout(() => router.push('/sales/closure'), 1000);
      }
      else setMsg('Error: ' + JSON.stringify(await res.json().catch(() => ({}))));
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  }

  // Area unit follows the STM's toggle (relabel only — values are entered in the
  // chosen unit); defaults to the project's native unit.
  const unit = f.area_unit || flags.areaUnit;
  return (
    <div style={{ padding: '24px 28px', maxWidth: 760 }}>
      <button onClick={() => router.back()} style={back}>← Back</button>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', margin: '8px 0 2px' }}>
        {reviseId ? 'Revise Booking' : eoiMode ? 'Create EOI' : (plots.length > 1 ? 'Book Units' : 'Book Unit')}{' '}
        {eoiMode ? <span style={{ color: '#E4571A' }}>{eoiNo || '…'}</span> : plotNumbers}
      </h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 18 }}>
        {project?.name || '…'} · <span style={{ textTransform: 'uppercase', fontWeight: 700, color: '#3D5AFE' }}>{formulaSet}</span> pricing
        {eoiMode && <span style={{ color: '#E4571A', fontWeight: 700 }}> · Expression of Interest · no plot</span>}
        {plots.length > 1 && <span style={{ color: '#2E7D32', fontWeight: 700 }}> · {plots.length} plots · area summed</span>}
      </p>

      <Section title="Client">
        <Row><L>Client Name *</L><In value={f.client_name} invalid={errs.client_name} onChange={(e) => set('client_name', e.target.value)} /></Row>
        <Row><L>Gender *</L><Sel value={f.gender} onChange={(e) => set('gender', e.target.value)} opts={['', 'Male', 'Female']} /></Row>
        <Row><L>Phone *</L><In value={f.phone} invalid={errs.phone} onChange={(e) => set('phone', e.target.value)} /></Row>
        <Row><L>Source</L><Sel value={f.source} onChange={(e) => set('source', e.target.value)} opts={['', ...(() => { const mapped = sources.map(s => srcDisplay(s.name)); const extra = ['Reference', 'Channel Partner', 'Other'].filter(n => !mapped.some(m => m.toLowerCase() === n.toLowerCase())); return [...mapped, ...extra]; })()] } /></Row>
        {/^reference$/i.test(f.source) && <Row><L>Reference Name</L><In value={f.cp_name} onChange={(e) => set('cp_name', e.target.value)} /></Row>}
        {/^channel partner$/i.test(f.source) && <Row><L>Channel Partner Name</L><In value={f.cp_name} onChange={(e) => set('cp_name', e.target.value)} /></Row>}
        {/^other$/i.test(f.source) && <Row><L>Other</L><In value={f.cp_name} onChange={(e) => set('cp_name', e.target.value)} /></Row>}
        <Row><L>Address</L><In value={f.address} onChange={(e) => set('address', e.target.value)} /></Row>
      </Section>

      <Section title="Plot & Type">
        <Row><L>Area Unit</L>
          <div style={{ display: 'flex', flex: 1, gap: 8 }}>
            {['sq.yd', 'sq.ft', 'sq.m'].map((u) => (
              <button key={u} type="button" onClick={() => set('area_unit', u)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.12s',
                  border: `1.5px solid ${unit === u ? '#3D5AFE' : '#E0E6F0'}`,
                  background: unit === u ? '#3D5AFE' : '#fff', color: unit === u ? '#fff' : '#6B7280' }}>{u}</button>
            ))}
          </div>
        </Row>
        {eoiMode && (project?.eoi_unit_types || []).length > 0 && (
          <Row><L>Unit Type</L>
            <Sel value={eoiType} onChange={(e) => {
              const name = e.target.value; setEoiType(name);
              const t = (project.eoi_unit_types || []).find((x) => x.type === name);
              // Standard EOI sizes prefill Plot/Construction Area (locked in EOI mode).
              setF((s) => ({ ...s, villa_type: name, area: t ? String(t.plot_area) : s.area, const_area: t ? String(t.const_area) : s.const_area }));
            }} opts={['', ...(project.eoi_unit_types || []).map((x) => x.type)]} />
          </Row>
        )}
        <Row><L>Plot Area ({unit})</L><In value={f.area} disabled={eoiLocked} invalid={errs.area} onChange={(e) => set('area', e.target.value)} /></Row>
        {flags.hasConstructionFields && <Row><L>Construction Area ({unit})</L><In value={f.const_area} disabled={eoiLocked} onChange={(e) => set('const_area', e.target.value)} /></Row>}
        {flags.bunglowTypeIsDropdown && !eoiMode && <Row><L>Villa Type</L><Sel value={f.villa_type} onChange={(e) => set('villa_type', e.target.value)} opts={['', '1BHK', '2BHK', '3BHK', '4BHK', 'Customized Villa']} /></Row>}
        {flags.bunglowTypeFixed && <Row><L>Bunglow Type</L><In value={flags.bunglowTypeFixed} disabled /></Row>}
      </Section>

      <Section title="Pricing">
        <Row><L>Land Rate (₹/{unit}) *</L><In type="number" value={f.land_rate} invalid={errs.land_rate} onChange={(e) => set('land_rate', e.target.value)} /></Row>
        {flags.hasConstructionFields && <Row><L>Development Rate (₹/{unit})</L><In type="number" value={f.dev_rate} onChange={(e) => set('dev_rate', e.target.value)} /></Row>}
        {flags.hasConstructionFields && <Row><L>Construction Rate (₹/{unit})</L><In type="number" value={f.const_rate} onChange={(e) => set('const_rate', e.target.value)} /></Row>}
        {flags.hasSaleDeedRate && <Row><L>Sale Deed Rate (₹/sq.ft)</L><In type="number" value={f.sale_deed_rate} onChange={(e) => set('sale_deed_rate', e.target.value)} /></Row>}
        {flags.hasDevAgreement && <Row><L>Dev Agreement Rate (₹/sq.ft)</L><In type="number" value={f.dev_agreement_rate} onChange={(e) => set('dev_agreement_rate', e.target.value)} /></Row>}
        {flags.hasLandSaleDeed && <Row><L>Land Sale Deed (₹)</L><In type="number" value={f.land_sale_deed} onChange={(e) => set('land_sale_deed', e.target.value)} /></Row>}
        {flags.hasConstructionAgreement && <Row><L>Construction Agreement (₹)</L><In type="number" value={f.const_agreement} onChange={(e) => set('const_agreement', e.target.value)} /></Row>}
        {flags.hasPremiumLocation && <Row><L>Premium Location (₹)</L><In type="number" value={f.premium_location} onChange={(e) => set('premium_location', e.target.value)} /></Row>}
        {formulaSet === 'kalrav' && <>
          {/* Kalrav: Unit Price = Land Sale Deed + Construction Agreement; % derived — both read-only. */}
          <Row><L>Sale Deed %</L><In type="number" value={v.saleDeedPct ? v.saleDeedPct.toFixed(2) : '0'} disabled readOnly /></Row>
          <Row><L>Unit Price (₹)</L><In type="number" value={Math.round(v.saleDeed) || 0} disabled readOnly /></Row>
        </>}
        {hasSaleDeedSplit && formulaSet !== 'kalrav' && <>
          {/* Editing the % clears the exact Unit Price override so the % drives again. */}
          <Row><L>Sale Deed %</L><In type="number" value={f.sale_deed_pct} onChange={(e) => setF((s) => ({ ...s, sale_deed_pct: e.target.value, sale_deed_amount: '' }))} /></Row>
          <Row>
            <L>Unit Price (₹)</L>
            <In
              type="number"
              value={deedAmtStr}
              onFocus={() => { editingAmtRef.current = true; }}
              onBlur={() => { editingAmtRef.current = false; }}
              onChange={(e) => {
                setDeedAmtStr(e.target.value);
                const amt = parseFloat(e.target.value) || 0;
                const base = v.plotBasic + v.plotDev + v.constAmt + v.premiumLocation;
                // Keep the exact amount as the source of truth; % is just a rounded display.
                setF((s) => ({ ...s, sale_deed_amount: e.target.value, sale_deed_pct: base > 0 ? parseFloat((amt / base * 100).toFixed(2)) : s.sale_deed_pct }));
              }}
            />
          </Row>
        </>}
        {!hasSaleDeedSplit && <Row><L>Discount (₹)</L><In type="number" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></Row>}
      </Section>

      <Section title="Legal & Other Charges">
        {hasSaleDeedSplit && <Row><L>Apply Stamp Duty?</L><Sel value={f.apply_stamp_duty} onChange={(e) => set('apply_stamp_duty', e.target.value)} opts={['Yes', 'No']} /></Row>}
        <Calc label="Stamp Duty" sub={stampSub} val={v.stampDuty} />
        <Row><L>Apply Registration Fee?</L><Sel value={f.apply_reg_fee} onChange={(e) => set('apply_reg_fee', e.target.value)} opts={['Yes', 'No']} /></Row>
        <Row><L>Apply ₹1,500 Page Fee?</L><Sel value={f.apply_page_fee} onChange={(e) => set('apply_page_fee', e.target.value)} opts={['Yes', 'No']} /></Row>
        <Calc label="Registration Fees" sub={regSub} val={v.regFees} />
        {hasSaleDeedSplit && <Row><L>Apply GST?</L><Sel value={f.apply_gst} onChange={(e) => set('apply_gst', e.target.value)} opts={['Yes', 'No']} /></Row>}
        <Calc label="GST" sub={gstSub} val={v.gst} />
        <Row><L>Maintenance Rate (₹/{unit}{formulaSet === 'industrial' ? '' : '/mo'})</L><In type="number" value={f.maint_rate} onChange={(e) => set('maint_rate', e.target.value)} /></Row>
        {formulaSet !== 'industrial' && <Row><L>Maintenance Months</L><In type="number" value={f.maint_months} onChange={(e) => set('maint_months', e.target.value)} /></Row>}
        <Calc label="Maintenance Amount" sub={maintSub} val={v.maint} />
        {flags.hasMaintDeposit && <Calc label="Maintenance Deposit" sub="= Maintenance Amount" val={v.maintDeposit} />}
        {flags.hasMaintAdvance && <Calc label="Maintenance Advance" sub="= Maintenance Amount" val={v.maintAdvance} />}
        <Row><L>Legal Documentation charge (₹)</L><In type="number" value={f.legal_charges} onChange={(e) => set('legal_charges', e.target.value)} /></Row>
      </Section>

      {/* Live totals — mirrors the GAS "Total Deal" box (breakdowns + Total Basic + Extra Charges) */}
      <div style={totalBox}>
        <T label="Plot Basic Amount" sub="Plot Area × Land Rate" sub2={`${inr(v.area)} × ${inr(v.landRate)}`} val={v.plotBasic} />
        {flags.hasConstructionFields && <T label="Plot Development Amount" sub={`${formulaSet === 'ankhol' ? 'Construction' : 'Plot'} Area × Dev Rate`} sub2={`${inr(formulaSet === 'ankhol' ? v.constArea : v.area)} × ${inr(v.devRate)}`} val={v.plotDev} />}
        {flags.hasConstructionFields && <T label="Construction Amount" sub="Construction Area × Construction Rate" sub2={`${inr(v.constArea)} × ${inr(v.constRate)}`} val={v.constAmt} />}
        {flags.hasConstructionFields && formulaSet === 'ankhol' && v.premiumLocation > 0 && <T label="Premium Location Charge" val={v.premiumLocation} />}
        {flags.hasConstructionFields && <T
          label="Total Basic Amount"
          sub={formulaSet === 'ankhol' ? 'Plot Basic + Plot Dev + Construction + Premium' : 'Plot Basic + Plot Dev + Construction'}
          val={formulaSet === 'ankhol' ? v.plotBasic + v.plotDev + v.constAmt + v.premiumLocation : v.plotBasic + v.plotDev + v.constAmt}
          subtotal />}
        {flags.hasSaleDeed && formulaSet !== 'ankhol' && !hasSaleDeedSplit && <T label="Sale Deed" sub={saleDeedSub} sub2={saleDeedSub2} val={v.saleDeed} />}
        {hasSaleDeedSplit && <>
          <T label="Unit Price" sub={saleDeedSub} sub2={saleDeedSub2} val={v.saleDeed} />
          <T label="Extra Work Amount" val={v.nonSaleDeed} />
          <Row><L>Discount (₹)</L><In type="number" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></Row>
          {v.discount > 0 && <T label="Final Extra Work Amount" sub="Extra Work Amount − Discount" val={v.nonSaleDeed - v.discount} />}
          <T label="Total Unit Price" sub={v.discount > 0 ? 'Unit Price + Final Extra Work Amount' : 'Unit Price + Extra Work Amount'} val={v.saleDeed + v.nonSaleDeed - v.discount} subtotal />
        </>}
        <T label="Legal & Other Charges" sub={extraSub} sub2={extraSub2} val={v.totalExtra} />
        {reviseId && v.extraWorkAmt > 0 && <T label="Extra Work" val={v.extraWorkAmt} />}
        {!hasSaleDeedSplit && <T label="Discount" val={-v.discount} />}
        <T label="Total Box Price" val={v.finalAmt} big />
      </div>

      <Section title="Payment Schedule">
        <Row><L>Booking Date *</L><In type="date" value={safeDate(f.booking_date)} onChange={(e) => set('booking_date', e.target.value)} /></Row>
        {/* Extra Work Amount Installments — shown ABOVE the sale-deed installments */}
        {hasSaleDeedSplit && nsdBase > 0 && (
          <div style={{ marginBottom: 14, borderBottom: '1px solid #E5E7EB', paddingBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46', marginBottom: 2 }}>Extra Work Amount Installments</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>{rupee(nsdBase)}</div>
            <Row><L>No. of Installments (Extra Work Amount)</L><In type="number" value={nsdInsts.length || ''} onChange={(e) => buildNsdInsts(e.target.value)} /></Row>
            {nsdInsts.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                <thead><tr>{['#', 'Due Date', '%', 'Amount'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {nsdInsts.map((r, i) => (
                    <tr key={i}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}><input type="date" value={safeDate(r.date)} onChange={(e) => setNsdInst(i, 'date', e.target.value)} style={inp} /></td>
                      <td style={td}><input type="text" inputMode="decimal" value={r.pct} onChange={(e) => setNsdInst(i, 'pct', e.target.value)} style={{ ...inp, width: 70 }} /></td>
                      <td style={td}><input type="text" inputMode="decimal" value={r.amt} onChange={(e) => setNsdInst(i, 'amt', e.target.value)} style={inp} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {nsdInsts.length > 0 && <div style={{ fontSize: 12, marginTop: 6, color: Math.abs(nsdPctTotal - 100) < 0.01 ? '#15803D' : '#DC2626' }}>Total: {nsdPctTotal.toFixed(2)}%</div>}
          </div>
        )}
        {hasSaleDeedSplit && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', marginBottom: 2 }}>Unit Price Installments</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>{rupee(base)}</div>
          </>
        )}
        <Row><L>No. of Installments</L><In type="number" value={insts.length || ''} onChange={(e) => buildInsts(e.target.value)} /></Row>
        {insts.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <thead><tr>{['#', 'Due Date', '%', 'Amount'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {insts.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}><input type="date" value={safeDate(r.date)} onChange={(e) => setInst(i, 'date', e.target.value)} style={inp} /></td>
                  <td style={td}><input type="text" inputMode="decimal" value={r.pct} onChange={(e) => setInst(i, 'pct', e.target.value)} style={{ ...inp, width: 70 }} /></td>
                  <td style={td}><input type="text" inputMode="decimal" value={r.amt} onChange={(e) => setInst(i, 'amt', e.target.value)} style={inp} /></td>
                </tr>
              ))}
              {v.totalExtra > 0 && (
                <tr style={{ background: '#FFF8E1' }}>
                  <td style={{ ...td, fontWeight: 700, color: '#92400E', fontSize: 11 }}>Extra</td>
                  <td style={td}><input type="date" value={safeDate(extraDate)} onChange={(e) => setExtraDate(e.target.value)} style={inp} /></td>
                  <td style={{ ...td, fontWeight: 700, color: '#92400E', fontSize: 11 }}>Legal & Other Charges</td>
                  <td style={td}><input value={rupee(v.totalExtra)} readOnly style={{ ...inp, background: '#f0f4ff', color: '#1a73e8', fontWeight: 600 }} /></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {insts.length > 0 && <div style={{ fontSize: 12, marginTop: 6, color: Math.abs(pctTotal - 100) < 0.01 ? '#15803D' : '#DC2626' }}>Total: {pctTotal.toFixed(2)}% · Legal & Other Charges {rupee(v.totalExtra)}</div>}
      </Section>

      {reviseId && (
        <Section title="Extra Work (revise only)">
          <Row><L>Description</L><In value={ew.desc} onChange={(e) => setEw((s) => ({ ...s, desc: e.target.value }))} /></Row>
          <Row><L>Total Amount (₹)</L><In type="number" value={ew.amt} onChange={(e) => setEw((s) => ({ ...s, amt: e.target.value }))} /></Row>
          <Row><L>No. of Installments</L><In type="number" value={ewInsts.length || ''} onChange={(e) => buildEw(e.target.value)} /></Row>
          {ewInsts.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead><tr>{['#', 'Due Date', '%', 'Amount'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {ewInsts.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}><input type="date" value={safeDate(r.date)} onChange={(e) => setEwInst(i, 'date', e.target.value)} style={inp} /></td>
                    <td style={td}><input type="text" inputMode="decimal" value={r.pct} onChange={(e) => setEwInst(i, 'pct', e.target.value)} style={{ ...inp, width: 70 }} /></td>
                    <td style={td}><input type="text" inputMode="decimal" value={r.amt} onChange={(e) => setEwInst(i, 'amt', e.target.value)} style={inp} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {ewInsts.length > 0 && <div style={{ fontSize: 12, marginTop: 6, color: Math.abs(ewPctTotal - 100) < 0.01 ? '#15803D' : '#DC2626' }}>Extra Work Total: {ewPctTotal.toFixed(2)}%</div>}
        </Section>
      )}

      <Section title="📝 Extra Terms & Conditions (optional — added below the default terms)">
        {extraTerms.map((t, i) => (
          <div key={i} style={{ border: '1px solid #E0E6F0', borderRadius: 10, padding: 12, marginBottom: 10, background: '#FAFBFE' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#8492A6' }}>Term {i + 1}</span>
              <button onClick={() => removeTerm(i)} style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕ Remove</button>
            </div>
            <input value={t.title} onChange={(e) => setTerm(i, 'title', e.target.value)} placeholder="Title (e.g. Possession)"
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 13, borderRadius: 8, border: '1.5px solid #E0E6F0', outline: 'none', marginBottom: 8 }} />
            <textarea value={t.desc} onChange={(e) => setTerm(i, 'desc', e.target.value)} placeholder="Description / clause text" rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 13, borderRadius: 8, border: '1.5px solid #E0E6F0', outline: 'none', resize: 'vertical' }} />
          </div>
        ))}
        <button onClick={addTerm} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px dashed #3D5AFE', background: '#EEF1FF', color: '#3D5AFE', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Add Extra Term</button>
      </Section>

      <Section title="LOI Document">
        <button onClick={doDownloadLOI} style={{ ...submitBtn, background: 'linear-gradient(135deg,#7b2ff7,#5a00d8)', marginBottom: 12 }}>
          📥 Download LOI PDF  (Print → Sign → Upload)
        </button>
        {loiDone && <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>✅ LOI downloaded. Get it signed and upload below.</div>}
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Upload Signed LOI *</label>
        <input type="file" accept="image/*,.pdf" onChange={onFile} style={{ display: 'block', marginTop: 8, fontSize: 13 }} />
        {loiFile && <div style={{ fontSize: 12, color: '#15803D', marginTop: 6 }}>📎 {loiFile.name}</div>}
      </Section>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, background: msg[0] === '✅' ? '#E8F5E9' : '#FEF2F2', color: msg[0] === '✅' ? '#15803D' : '#DC2626', fontSize: 13, marginBottom: 12 }}>{msg}</div>}
      <button onClick={submit} disabled={saving} style={submitBtn}>{saving ? 'Saving…' : 'Submit Booking'}</button>
    </div>
  );
}

const Section = ({ title, children }) => (
  <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginBottom: 14, boxShadow: '0 2px 8px rgba(184,196,214,0.18)' }}>
    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#3D5AFE', marginBottom: 12 }}>{title}</div>
    {children}
  </div>
);
const Row = ({ children }) => <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>{children}</div>;
const L = ({ children }) => <label style={{ width: 200, minWidth: 200, fontSize: 13, fontWeight: 600, color: '#374151' }}>{children}</label>;
const In = ({ type, invalid, ...p }) => (
  // number → plain text + numeric keypad, so scrolling never changes the value (no spinner)
  <input {...p} type={type === 'number' ? 'text' : (type || 'text')} inputMode={type === 'number' ? 'decimal' : undefined}
    style={{ flex: 1, padding: '9px 11px', fontSize: 13, borderRadius: 8, border: `1.5px solid ${invalid ? '#DC2626' : '#E0E6F0'}`, outline: 'none', background: p.disabled ? '#F3F4F6' : (invalid ? '#FEF2F2' : '#fff') }} />
);
const Sel = ({ opts, invalid, ...p }) => <select {...p} style={{ flex: 1, padding: '9px 11px', fontSize: 13, borderRadius: 8, border: `1.5px solid ${invalid ? '#DC2626' : '#E0E6F0'}`, outline: 'none', cursor: 'pointer', background: invalid ? '#FEF2F2' : '#fff' }}>{opts.map((o) => <option key={o} value={o}>{o === '' ? '— Select —' : o}</option>)}</select>;
// readonly computed value (auto-calculated) shown under its toggle/inputs
const Calc = ({ label, sub, val }) => (
  <Row>
    <L>{label}{sub && <span style={{ display: 'block', fontSize: 11, color: '#9CA3AF', fontWeight: 400, fontStyle: 'italic' }}>{sub}</span>}</L>
    <div style={{ flex: 1, padding: '9px 11px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: '1.5px solid #C5D8FB', background: '#F0F4FF', color: '#1a73e8' }}>{rupee(val)}</div>
  </Row>
);
const T = ({ label, sub, sub2, val, valFmt, big, subtotal }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: big ? '10px 0 0' : subtotal ? '8px 10px' : '6px 0',
    borderTop: big ? '2px solid #B3CDF9' : 'none', marginTop: big ? 6 : 0,
    ...(subtotal ? { background: '#DBEAFE', borderRadius: 6, margin: '4px 0' } : {}),
  }}>
    <span style={{ flex: 1, paddingRight: 12, fontSize: big ? 15 : 13, fontWeight: (big || subtotal) ? 800 : 500, color: (big || subtotal) ? '#0D47A1' : '#4B5563' }}>
      {label}
      {sub && <small style={{ display: 'block', fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>{sub}</small>}
      {sub2 && <small style={{ display: 'block', fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>{sub2}</small>}
    </span>
    <span style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: big ? 15 : 13, fontWeight: big ? 800 : 700, color: (big || subtotal) ? '#0D47A1' : '#1F2937' }}>{valFmt || rupee(val)}</span>
  </div>
);
const totalBox = { background: 'linear-gradient(135deg,#F0F7FF,#E8F0FE)', border: '1.5px solid #C5D8FB', borderRadius: 12, padding: '10px 18px', marginBottom: 14 };
const back = { background: 'none', border: 'none', color: '#3D5AFE', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0 };
const th = { fontSize: 11, fontWeight: 700, color: '#8492A6', textAlign: 'left', padding: '6px 8px' };
const td = { padding: '4px 8px', fontSize: 13 };
const inp = { width: '100%', padding: '7px 9px', fontSize: 13, borderRadius: 6, border: '1.5px solid #E0E6F0', outline: 'none' };
const submitBtn = { width: '100%', padding: 13, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#1a73e8,#0d47a1)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' };
