'use client';
import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { computeFormulas, fieldFlags, installmentBase, rupee } from '../../../lib/bookingFormulas';
import { stripPlotPrefix } from '../../../lib/plotNumber';
import { downloadLOI } from '../../../lib/bookingLOI';
import { computeShop, impliedUnitPct } from '../../../lib/pratishthaShop';
import { computeFlat } from '../../../lib/pratishthaFlat';


const MAX_LOI_FILE_SIZE_MB = 100;
const MAX_LOI_FILE_SIZE = MAX_LOI_FILE_SIZE_MB * 1024 * 1024;

// Open a previously-uploaded signed LOI via a short-lived signed URL (never a public link).
async function openLoi(id) {
  if (!id) return;
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(id), { headers: authHeaders() });
    const d = await r.json();
    if (r.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
    else alert('Could not open the LOI.');
  } catch { alert('Could not open the LOI.'); }
}

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
  const pathname = usePathname();
  // Kiosk mode: this booking form is opened full-screen from the client Kiosk (/kiosk/book).
  // Back and post-submit return to the kiosk instead of the sales area.
  const kioskMode = (pathname || '').startsWith('/kiosk');
  const me = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cq = (sep) => (companyId ? `${sep}company_id=${companyId}` : '');

  const reviseId  = qp.get('revise') || '';
  const draftId   = qp.get('draft') || '';   // resuming a saved draft
  // Id of the draft this form is persisting to — starts as the URL's ?draft=, but a
  // fresh Save (no ?draft= yet) mints a new draft row and this captures its id so
  // every later Save in the same visit keeps updating that same row.
  const [savedDraftId, setSavedDraftId] = useState('');
  const convertEoiId = qp.get('convertEoi') || '';   // converting an EOI into a plot booking
  const [projectId, setProjectId] = useState(qp.get('project'));
  // Multi-plot: `plots` query param is a comma list of ids; fall back to single `plot`.
  const [plotIds,   setPlotIds]   = useState((qp.get('plots') || qp.get('plot') || '').split(',').map((s) => s.trim()).filter(Boolean));
  const plotId    = plotIds[0] || '';
  const leadId    = qp.get('lead') || '';
  // EOI (Expression of Interest): a booking on a project with no plots yet. No plot is
  // selected; a sequential per-project EOI code (EOI-1, EOI-2…) stands in for the plot no.
  // EOI mode applies when creating an EOI (?eoi=1) OR revising an existing EOI (?revise=..&eoi=1).
  const eoiMode   = qp.get('eoi') === '1' || qp.get('eoi') === 'true';
  // Block-wise industrial: which block this EOI is against — drives the block-prefixed
  // EOI code (e.g. Block E → E1, E2…) instead of the default EOI-<n>.
  const eoiBlock  = qp.get('block') || '';
  const [eoiNo, setEoiNo] = useState('');
  const [eoiType, setEoiType] = useState('');   // selected EOI standard unit type
  const [eoiUnits, setEoiUnits] = useState('1'); // no. of units — multiplies the standard area

  const [project, setProject] = useState(null);
  const [plot,    setPlot]    = useState(null);   // primary (first) plot
  const [plots,   setPlots]   = useState([]);     // all selected plots
  const [sources, setSources] = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');

  // form state
  const [f, setF] = useState({
    client_name: qp.get('client') || '', gender: '', phone: qp.get('phone') || '', address: '', source: '',
    manual_stm_name: '',   // kiosk: the salesperson assisting, typed in
    area: '', area_unit: 'sq.yd', const_area: '', villa_type: '',
    land_rate: '', dev_rate: '', const_rate: '', sale_deed_rate: '', dev_agreement_rate: '',
    sale_deed_pct: '60', sale_deed_amount: '',
    land_sale_deed: '', const_agreement: '', premium_location: '',
    discount: '0', legal_charges: '', maint_rate: '', maint_months: '',
    apply_reg_fee: 'Yes', apply_page_fee: 'Yes', apply_stamp_duty: 'Yes', apply_gst: 'Yes',
    booking_date: new Date().toISOString().slice(0, 10), cp_name: '',
  });
  const [errs, setErrs] = useState({});   // required-field highlight on Generate/Submit
  // Per-shop overrides: { [unit]: { rate, mode: 'pct'|'amount', unitPct, unitAmount } }
  const [shopEdits, setShopEdits] = useState({});
  const [flatEdits, setFlatEdits] = useState({});
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
  const [loiFile, setLoiFile] = useState(null); // {name,type,data(base64)} — a freshly attached file this session
  // Path of a signed LOI already saved on a resumed draft from an earlier Save —
  // distinct from loiFile, since we only have the backend path, not the file's bytes,
  // and don't need to re-upload it unless the rep attaches a replacement.
  const [savedLoiPath, setSavedLoiPath] = useState('');
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
      // Revising an EOI: keep its existing EOI code (no plot, no next-EOI fetch).
      if (String(b.plot_numbers || '').toUpperCase().startsWith('EOI')) setEoiNo(b.plot_numbers);
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

  // Resuming a saved draft: same prefill as revision mode, from the caller's own
  // drafts list (status=draft is always scoped server-side to the requester).
  useEffect(() => {
    if (!draftId) return;
    fetch(`${SALES_ENDPOINTS.bookings}?status=draft${cq('&')}`, { headers: authHeaders() }).then(r => r.json()).then((arr) => {
      const b = (Array.isArray(arr) ? arr : []).find((x) => String(x.id) === String(draftId));
      if (!b) return;
      setSavedDraftId(String(b.id));
      // A signed LOI attached before an earlier Save is already on the server — show
      // it as attached instead of asking the rep to re-upload it to resume.
      setSavedLoiPath(b.loi_document || '');
      if (b.loi_document) setLoiDone(true);
      setProjectId(String(b.project));
      setPlotIds(((b.plot_ids && b.plot_ids.length ? b.plot_ids : [b.plot]).filter(Boolean)).map(String));
      if (String(b.plot_numbers || '').toUpperCase().startsWith('EOI')) setEoiNo(b.plot_numbers);
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
  }, [draftId]);

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
    if (eoiMode && !reviseId && projectId) fetch(`${SALES_ENDPOINTS.bookings}next-eoi/?project=${projectId}${cq('&')}${eoiBlock ? `&block=${encodeURIComponent(eoiBlock)}` : ''}`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null)).then((d) => { if (d && d.eoi_no) setEoiNo(d.eoi_no); }).catch(() => {});
  }, [projectId, plotIds.join(','), companyId, eoiMode, eoiBlock]);

  // Comma display of every selected plot ("12, 13, 14").
  const plotNumbers = useMemo(
    () => {
      if (eoiMode) return eoiNo;
      return plots.length ? plots.map((p) => stripPlotPrefix(p.number)).join(', ') : stripPlotPrefix(plot?.number || '');
    },
    [plots, plot, eoiMode, eoiNo],
  );

  const formulaSet = project?.formula_set || 'kalrav';
  const flags = useMemo(() => fieldFlags(formulaSet), [formulaSet]);
  // All pricing sets share the sale-deed % split (Unit Price + Additional Extra Work Amount).
  // Which pricing sections apply depends on the project's formula set and, for a unit
  // booking, on that unit's price book — neither is known on the first paint. Render a
  // placeholder until both have loaded, otherwise the default (Kalrav) layout flashes up
  // and is then replaced.
  const unitResolved = eoiMode || !plotIds.length || !!plot;
  const pricingReady = !!project && unitResolved;

  // Pratishtha prices each unit from its price book, and there is no instalment
  // schedule. A booking can cover several units, so every selected one is priced and
  // the totals are summed. Both kinds are computed from a small set of editable
  // drivers: shops from Rate + Total Unit Price, flats from Flat Rate + Token.
  const rawBooks = formulaSet === 'pratishtha'
    ? plots.map((p) => p.price_book).filter((b) => b && Object.keys(b).length)
    : [];
  // Seeds come from the unit's own price book, and a patch merges onto the seed rather
  // than onto {} — otherwise the first edit to any one field (switching plan, toggling
  // % / Rs.) would create a state with the *other* fields missing and blank their inputs.
  const shopSeed = (pb) => ({ rate: pb.rate, mode: 'pct', unitPct: impliedUnitPct(pb), unitAmount: pb.loan_amount });
  const shopEdit = (pb) => shopEdits[pb.unit] || shopSeed(pb);
  const setShopEdit = (pb, patch) =>
    setShopEdits((m) => ({ ...m, [pb.unit]: { ...(m[pb.unit] || shopSeed(pb)), ...patch } }));
  const flatSeed = (pb) => ({ plan: 'Regular', flatPrice: pb.flat_price, token: pb.token });
  const flatEdit = (pb) => flatEdits[pb.unit] || flatSeed(pb);
  const setFlatEdit = (pb, patch) =>
    setFlatEdits((m) => ({ ...m, [pb.unit]: { ...(m[pb.unit] || flatSeed(pb)), ...patch } }));
  // Only a Down Payment plan may move the rate or token. On Regular the unit prices
  // straight from the price book — passing no overrides at all, so switching back from
  // Down Payment cannot leave an edited figure behind.
  const isDownPayment = (pb) => flatEdit(pb).plan === 'Down Payment';
  const flatOverrides = (pb) => (isDownPayment(pb) ? flatEdit(pb) : {});
  const pratBooks = rawBooks.map((pb) => (pb.kind === 'shop'
    ? computeShop(pb, shopEdit(pb))
    : computeFlat(pb, flatOverrides(pb))));
  const prat = pratBooks[0] || null;
  const pratRowsFor = (pb) => (pb.kind === 'shop'
    ? [['Shop Area', `${pb.sq_feet} sq.ft`], ['Rate', rupee(pb.rate) + ' / sq.ft'],
       ['Shop Amount', rupee(pb.amount), 'sub'],
       // Grouped like the flats: the charge bifurcation, then the documented split.
       // Grand Total is Shop Amount + Total Legal & Other Charges, so those two are
       // the figures to read.
       { h: 'Legal & Other Charges' },
       ['Stamp Duty & Registration (6% of Final Unit Price)', rupee(pb.stamp_duty_reg)],
       ['GST (5% of Final Unit Price)', rupee(pb.gst)], ['AUDA (₹400/sq.ft)', rupee(pb.auda)],
       ['6 Months Maintenance Advance', rupee(pb.maint_adv_6m)],
       ['12 Months Maintenance Deposit', rupee(pb.maint_dep_12m)],
       ['Legal Charges', rupee(pb.legal)],
       ['Total Legal & Other Charges', rupee(pb.total_extra), 'sub'],
       { h: 'What This Price Includes' },
       ['Final Unit Price', rupee(pb.loan_amount)],
       ['Total Legal & Other Charges', rupee(pb.total_extra)],
       ['Extra Work Amount', rupee(pb.extra_work_amount)]]
    : [['Facing', pb.facing === 'road' ? 'Road Facing' : pb.facing === 'garden' ? 'Garden Facing' : '—'],
       ['Flat Area', `${pb.flat_area} sq.yd`],
       ['Flat Rate', rupee(pb.flat_rate) + ' / sq.yd'],
       ['Flat Price', rupee(pb.flat_price)],
       ...(pb.terrace_area
         ? [['Additional Terrace Area', `${pb.terrace_area} sq.yd`],
            ['Terrace Rate (Flat Rate / 2)', rupee(pb.terrace_rate) + ' / sq.yd'],
            ['Additional Terrace Price (Terrace Area x Terrace Rate)', rupee(pb.terrace_price)]]
         : [['Additional Terrace Area', '—']]),
       [pb.is_down_payment ? 'Unit Price (Flat Price + Terrace Price)' : 'Box Price (Flat Price + Terrace Price)', rupee(pb.box_price), 'sub'],
       // Same split as the LOI: what the price is made up of, then how it is funded.
       // Both add to the Total, so listing them together reads as double the price.
       { h: 'What This Price Includes' },
       // Down Payment quotes four figures that add to the total; Regular breaks the
       // box price down into what it already contains.
       ...(pb.is_down_payment
         ? [['Unit Price (Flat Price + Terrace Price)', rupee(pb.box_price)],
            ['Total Legal & Other Charges (Unit Price x 7% + Legal Charges)', rupee(pb.total_extra)],
            ['6 Months Advance Maintenance (1.5 x 9 x Area x 6)', rupee(pb.maint_adv_6m)],
            ['12 Months Maintenance Deposit (1.5 x 9 x Area x 12)', rupee(pb.maint_adv_12m)],
            ['Total Legal & Extra Charges', rupee(pb.total_legal_extra), 'sub']]
         : [['Final Unit Price ((Box Price - Bank Processing) / 1.07)', rupee(pb.dastavej_value)],
            ['Stamp Duty + Registration (Final Unit Price x 6%)', rupee(pb.stamp_duty_reg)],
            ['GST (Final Unit Price x 1%)', rupee(pb.gst)],
            ['Bank Processing Charges (Bank Loan x 4.5%)', rupee(pb.bank_processing)]]),
       // Down Payment has no loan to describe, and its four rows already add to the
       // footer total — so no How You Pay section and no duplicate subtotal above it.
       ...(pb.is_down_payment
         ? []
         : [['Total All Inclusive Amount', rupee(pb.total), 'sub'],
            { h: 'How You Pay' },
            ['Token', rupee(pb.token)],
            ['Bank Loan (Box Price - Token)', rupee(pb.bank_loan)]])]);
  // The stored unit number may already carry the word ("Shop1"), so don't repeat it:
  // "Shop1" -> "Shop 1", "101" -> "Flat 101".
  const unitTitle = (pb) => {
    const kind = pb.kind === 'shop' ? 'Shop' : 'Flat';
    const n = String(pb.unit || '').trim();
    const bare = n.replace(new RegExp('^' + kind + '\\s*', 'i'), '');
    return kind + ' ' + (bare || n);
  };
  // A Down Payment flat is paid in instalments against the Box Price only — flats carry
  // no extra work, so there is no second schedule. The three charge lines fall due on
  // the sale deed or possession instead, so they are carried as undated extras.
  const pratDp   = prat && pratBooks.some((b) => b.is_down_payment);
  const pratShop = prat && pratBooks.some((b) => b.kind === 'shop');
  const pratSched = pratDp || pratShop;   // the units that are paid in instalments
  // Shops follow Ankhol: an Extra Work Amount schedule, then the unit price, then the
  // charges. A Down Payment flat has no extra work, so only the middle table applies.
  // Summed per unit so a booking covering both kinds still adds up.
  const pratPer = (fn) => pratBooks.reduce((sum, b) => sum + (Number(fn(b)) || 0), 0);
  const pratUnitBase = pratPer((b) => (b.kind === 'shop' ? b.loan_amount : (b.is_down_payment ? b.box_price : 0)));
  const pratEwBase   = pratPer((b) => (b.kind === 'shop' ? b.extra_work_amount : 0));
  // One line on the schedule, not several: the itemisation already sits in the pricing
  // panel above, and the whole amount falls due on the same date.
  const pratExtras = () => {
    const amt = Math.round(pratPer((b) => (b.kind === 'shop' ? b.total_extra : (b.is_down_payment ? b.total_legal_extra : 0))));
    return amt > 0
      ? [{ no: 'Extra', date: '', amt, isExtra: true,
           label: pratDp ? 'Total Legal & Extra Charges' : 'Total Legal & Other Charges' }]
      : [];
  };
  const pbTotal = (pb) => (pb.grand_total ?? pb.box_price ?? 0);
  const pratTotal = pratBooks.reduce((sum, pb) => sum + pbTotal(pb), 0);
  const pratExtraTotal = pratBooks.reduce((sum, pb) => sum + (pb.total_extra || 0), 0);

  const hasSaleDeedSplit = formulaSet === 'ankhol' || formulaSet === 'kalrav' || formulaSet === 'industrial';
  // EOI standard sizes are per-unit; the No. of Units field multiplies Plot/Construction Area.
  const applyEoiUnit = (name, unitsStr) => {
    const t = (project?.eoi_unit_types || []).find((x) => x.type === name);
    const n = Math.max(1, parseInt(unitsStr, 10) || 1);
    setF((s) => ({ ...s, villa_type: name,
      area:       t ? String((+t.plot_area  || 0) * n) : s.area,
      const_area: t ? String((+t.const_area || 0) * n) : s.const_area }));
  };

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

  const base = pratSched ? pratUnitBase : installmentBase(v);
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
    : (formulaSet === 'kalrav' ? (v.isKalrav3 ? '4.9% of Unit Price' : '4.9% of Land Sale Deed') : '4.9% of Sale Deed');
  const pageFeeTxt = f.apply_page_fee === 'No' ? '' : ' + ₹1,500';
  const femPage = f.apply_page_fee === 'No' ? '₹0' : '₹1,500';
  const regSub = f.apply_reg_fee === 'No'
    ? (f.apply_page_fee === 'No' ? 'Not applicable' : 'Page Fee only (₹1,500)')
    : (formulaSet === 'ankhol' ? `1% of Sale Deed${pageFeeTxt}`
      : formulaSet === 'industrial' ? `Male: 1% Sale Deed${pageFeeTxt} | Female: ${femPage}`
      : v.isKalrav3 ? `Male: 1% Unit Price${pageFeeTxt} | Female: ${femPage}`
      : `Male: 1% LSD${pageFeeTxt} | Female: ${femPage}`);
  const gstSub = (hasSaleDeedSplit && f.apply_gst === 'No') ? 'Not applicable'
    : (formulaSet === 'ankhol' ? '5% of Sale Deed'
      : formulaSet === 'industrial' ? (v.isTundav ? '18% of 67% of Sale Deed' : '18% of Development Agreement')
      : v.isKalrav3 ? '5% of Unit Price'
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

  const nsdBase = pratSched ? pratEwBase : Math.max(0, (v.nonSaleDeed || 0) - (v.discount || 0));
  const nsdPctTotal = nsdBase ? nsdInsts.reduce((a, r) => a + (parseFloat(r.amt) || 0), 0) / nsdBase * 100 : nsdInsts.reduce((a, r) => a + (parseFloat(r.pct) || 0), 0);
  // An instalment's amount is worked out from its % at the moment the % is typed. Nothing
  // revisited it when the base moved, so entering the price after setting the schedule
  // left every amount against the old base — 33% of a 20,00,000 unit showing as 66.
  // The percentages are the source of truth: re-derive the amounts whenever a base
  // changes, giving the last row the remainder so a schedule always sums to its base.
  // Applies to all three schedules (unit price, extra work charges, extra work) and so
  // to every pricing model and to EOIs, which share this table.
  const rebaseRows = (arr, b) => {
    if (!arr.length || !b) return arr;
    const next = arr.map((r) => {
      const pct = parseFloat(r.pct) || 0;
      return pct ? { ...r, amt: String(Math.round(b * pct / 100)) } : r;
    });
    // Give the last row the remainder only when the schedule is a complete one, so
    // rounding never leaves it a rupee short of the base. An EOI may carry a partial
    // (token) schedule on purpose — inflating its last row to 100% would misstate it.
    const last = next.length - 1;
    const pctSum = next.reduce((a, r) => a + (parseFloat(r.pct) || 0), 0);
    if (last > 0 && Math.abs(pctSum - 100) < 0.5) {
      const used = next.slice(0, last).reduce((a, r) => a + (parseFloat(r.amt) || 0), 0);
      const rem = Math.max(0, Math.round(b - used));
      next[last] = { ...next[last], amt: String(rem), pct: String(parseFloat((rem / b * 100).toFixed(2))) };
    }
    return next;
  };
  const useRebase = (b, setRows) => {
    const prev = useRef(b);
    useEffect(() => {
      if (prev.current === b) return;
      prev.current = b;
      if (b) setRows((arr) => rebaseRows(arr, b));
    }, [b]);
  };
  useRebase(base, setInsts);
  useRebase(nsdBase, setNsdInsts);
  useRebase(ewBase, setEwInsts);

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
    if (prat) {
      if (!pratSched) return [];
      // isNsd marks the Extra Work Amount rows — the LOI prints those per hundred.
      nsdInsts.forEach((r, i) => arr.push({ no: i + 1, date: r.date, pct: parseFloat(r.pct) || 0, amt: parseFloat(r.amt) || 0, isNsd: true }));
      return arr.concat(pratExtras());
    }
    nsdInsts.forEach((r, i) => arr.push({ no: i + 1, date: r.date, pct: parseFloat(r.pct) || 0, amt: parseFloat(r.amt) || 0, isNsd: true }));
    arr.push({ no: 'Extra', date: extraDate, amt: Math.round(v.totalExtra), isExtra: true });
    return arr;
  }
  async function doDownloadLOI() {
    const e = {};
    if (!f.client_name.trim()) e.client_name = true;
    if (!f.phone.trim()) e.phone = true;
    // Pratishtha has no rate fields — its amounts come from the unit's price book, so
    // requiring area/land rate would flag inputs that aren't on the form.
    if (!prat && !v.plotBasic) { if (!f.area) e.area = true; if (!f.land_rate) e.land_rate = true; }
    if (Object.keys(e).length) { setErrs(e); setMsg('Please fill the highlighted fields.'); return; }
    setErrs({});
    // Installments must total 100% before the LOI — EXCEPT for an EOI, where a partial
    // (token) schedule is allowed and the 100% rule does not apply.
    // A Down Payment Pratishtha flat now has a real schedule, so it is held to the same
    // 100% rule; a Regular one has no schedule at all and is skipped.
    if ((!prat || pratSched) && !eoiMode) {
      if (!insts.length) { setMsg('Add the payment installments before downloading the LOI.'); return; }
      if (Math.abs(pctTotal - 100) > 0.01) { setMsg('Payment installments must total 100% before downloading the LOI.'); return; }
      if ((hasSaleDeedSplit || pratShop) && nsdBase > 0 && (!nsdInsts.length || Math.abs(nsdPctTotal - 100) > 0.01)) {
        setMsg('Extra Work Amount installments must be filled and total 100% before downloading the LOI.'); return;
      }
    }
    const meta = {
      clientName: f.client_name, phoneNumber: f.phone, gender: f.gender, address: f.address,
      project: project?.name, plotNo: plotNumbers || plot?.number, bookingDate: f.booking_date,
      villaType: f.villa_type, bunglowType: flags.bunglowTypeFixed || '', cpName: f.cp_name, loggedInUser: f.manual_stm_name.trim() || me?.name, source: f.source,
      areaUnit: f.area_unit || flags.areaUnit,
    };
    try { await downloadLOI(meta, v, instArr(), { formulaSet, projectName: project?.name, projectLogoUrl: project?.logo_url, isRevision: !!reviseId, revNo: (reviseId ? 1 : 0), extraWorkInst: ewArr(), extraTerms: cleanTerms(), areaUnit: f.area_unit || flags.areaUnit,
      // Pratishtha prices from the unit's fixed price book, not the form's rates.
      priceBooks: pratBooks }); setLoiDone(true); setMsg('✅ LOI downloaded — get it signed and upload below.'); }
    catch (e) { setMsg('LOI error: ' + e.message); }
  }
  function onFile(e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > MAX_LOI_FILE_SIZE) {
      setMsg(`File too large — max ${MAX_LOI_FILE_SIZE_MB} MB.`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLoiFile({ name: file.name, type: file.type, data: reader.result.split(',')[1] });
    reader.readAsDataURL(file);
  }

  // Shared by submit() and saveDraft() so the two payloads never drift apart.
  function buildPayload() {
    return {
      project: projectId, plot: eoiMode ? undefined : plotId, plot_ids: eoiMode ? [] : plotIds, lead: leadId || undefined,
      ...(eoiMode ? { eoi: true, eoi_no: eoiNo, ...(eoiBlock ? { eoi_block: eoiBlock } : {}) } : {}),
      client_name: f.client_name.trim(), gender: f.gender, phone: f.phone.trim(), address: f.address, source: f.source,
      manual_stm_name: f.manual_stm_name.trim(),
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
      total_extra: Math.round(prat ? pratExtraTotal : v.totalExtra), discount: f.discount || 0,
      final_amount: Math.round(prat ? pratTotal : v.finalAmt),
      apply_reg_fee: f.apply_reg_fee, apply_page_fee: f.apply_page_fee, apply_stamp_duty: f.apply_stamp_duty, apply_gst: f.apply_gst,
      // A Regular Pratishtha unit is a fixed box price with no staged payments; a Down
      // Payment one is paid in instalments against the box price.
      installments: instArr(),
      extra_work_desc: reviseId ? (ew.desc || '') : '',
      extra_work_amount: reviseId ? Math.round(parseFloat(ew.amt) || 0) : 0,
      extra_work_inst: reviseId ? ewArr() : [],
      extra_terms: cleanTerms(),
      booking_date: f.booking_date, cp_name: f.cp_name,
      loi_file: loiFile,   // {name,type,data} → saved server-side
      ...(reviseId ? { revision_of: reviseId } : {}),
    };
  }

  async function submit() {
    const e = {};
    if (!f.client_name.trim()) e.client_name = true;
    if (!f.phone.trim()) e.phone = true;
    if (!prat && (!f.land_rate || !v.plotBasic)) { e.land_rate = true; if (!f.area) e.area = true; }
    if (Object.keys(e).length) { setErrs(e); setMsg('Please fill the highlighted fields.'); return; }
    setErrs({});
    if ((!prat || pratSched) && !eoiMode && insts.length && Math.abs(pctTotal - 100) > 0.01) { setMsg('Installments must total 100%.'); return; }
    if (!loiFile && !savedLoiPath) { setMsg('Download the LOI, get it signed, and upload it before submitting.'); return; }
    setSaving(true); setMsg('');
    const payload = {
      ...buildPayload(),
      ...((draftId || savedDraftId) ? { draft_id: draftId || savedDraftId } : {}),
    };
    try {
      const res = await fetch(SALES_ENDPOINTS.bookings + cq('?'), { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
      if (res.ok) {
        setMsg('✅ Booking submitted — sent for approval.');
        try { sessionStorage.setItem('booking_flash', 'Your booking has been submitted and sent for approval.'); } catch {}
        // Leave the button disabled (saving stays true) — we're navigating away
        // momentarily. Re-enabling it here let an impatient re-click during that
        // 1s window fire a second, identical submission (confirmed against real
        // duplicate bookings in production).
        setTimeout(() => router.push(kioskMode ? '/kiosk' : '/sales/closure'), 1000);
        return;
      }
      const errData = await res.json().catch(() => ({}));
      setMsg('Error: ' + (errData.detail || JSON.stringify(errData)));
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  }

  // Save Draft: none of Submit's completeness checks apply — the whole point is to
  // never lose typed data, even if it's just a client name so far.
  async function saveDraft() {
    setSaving(true); setMsg('');
    const payload = { ...buildPayload(), ...(savedDraftId ? { id: savedDraftId } : {}) };
    try {
      const res = await fetch(SALES_ENDPOINTS.bookingDraft, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSavedDraftId(String(data.id));
        if (data.loi_document) setSavedLoiPath(data.loi_document);
        const conflicts = data.plot_conflicts || [];
        setMsg(conflicts.length
          ? `✅ Draft saved — but Plot ${conflicts.map((c) => c.number).join(', ')} is no longer held for you.`
          : '✅ Draft saved — safe to come back later.');
      } else {
        setMsg('Error: ' + (data.detail || JSON.stringify(data)));
      }
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  }

  // Area unit follows the STM's toggle (relabel only — values are entered in the
  // chosen unit); defaults to the project's native unit.
  const unit = f.area_unit || flags.areaUnit;
  return (
    <div style={{ padding: '24px 28px', maxWidth: 760 }}>
      {saving && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.7)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #E0E6F0', borderTopColor: '#1a73e8', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>Submitting booking…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <button onClick={() => kioskMode ? router.push('/kiosk') : router.back()} style={back}>← Back</button>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', margin: '8px 0 2px' }}>
        {/* A tower sells flats and shops, not plots — name what's actually being booked. */}
        {reviseId ? (eoiMode ? 'Revise EOI' : 'Revise Booking') : eoiMode ? 'Create EOI'
          : (plots.length > 1 ? 'Book Units' : prat ? (prat.kind === 'shop' ? 'Book Shop' : 'Book Flat') : 'Book Unit')}{' '}
        {eoiMode ? <span style={{ color: '#E4571A' }}>{eoiNo || '…'}</span> : plotNumbers}
      </h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 18 }}>
        {project?.name || '…'} · <span style={{ textTransform: 'uppercase', fontWeight: 700, color: '#3D5AFE' }}>{pricingReady ? formulaSet : '…'}</span> pricing
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
        {/* Kiosk: the booking is created by the kiosk account, so the salesperson
            assisting types their own name — it's what the LOI prints as STM Name. */}
        {kioskMode && <Row><L>STM Name</L><In value={f.manual_stm_name} placeholder="Sales team member assisting"
          onChange={(e) => set('manual_stm_name', e.target.value)} /></Row>}
      </Section>

      {!pricingReady ? (
        <Section title="Pricing">
          <p style={{ fontSize: 13, color: '#8492A6', margin: 0 }}>Loading unit pricing…</p>
        </Section>
      ) : prat ? (
        /* Pratishtha: each unit is priced from its price book, driven by a few editable
           inputs (flats: Flat Rate + Token; shops: Rate + Total Unit Price). A booking
           can cover several units, so each is priced separately and summed. */
        <>
          {pratBooks.map((pb, idx) => (
            <Section key={idx} title={`Unit Pricing · ${unitTitle(pb)}`}>
              {idx === 0 && (
                <p style={{ fontSize: 12, color: '#8492A6', margin: '0 0 12px' }}>
                  Figures come from the Pratishtha price book. Adjust the highlighted drivers and every dependent line recalculates.
                </p>
              )}
              {pb.kind !== 'shop' && (() => {
                const e = flatEdit(pb);
                const dp = isDownPayment(pb);
                return (
                  <div style={{ border: '1.5px solid #C7D2FE', background: '#F5F7FF', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#3D5AFE', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      {dp ? 'Editable · everything below recalculates' : 'Plan'}
                    </div>
                    <Row><L>Plan</L>
                      {/* Switching to Down Payment clears the price rather than carrying the
                          price-book figure over: the whole point of the plan is to enter a
                          negotiated one, and a pre-filled default is easy to leave in place
                          by mistake. */}
                      <Sel opts={['Regular', 'Down Payment']} value={e.plan || 'Regular'}
                        onChange={(ev) => setFlatEdit(pb, ev.target.value === 'Down Payment'
                          ? { plan: ev.target.value, flatPrice: 0 }
                          : { plan: ev.target.value })} />
                    </Row>
                    <Row><L>Flat Price (₹)</L>
                      <In type="number" disabled={!dp} value={dp ? (e.flatPrice ?? '') : pb.flat_price}
                        onChange={(ev) => setFlatEdit(pb, { flatPrice: ev.target.value })} />
                    </Row>
                    {/* No token on a Down Payment plan — there is no loan, and the section
                        that used to quote it is gone. */}
                    {!dp && (
                      <Row><L>Token</L>
                        <In type="number" disabled value={pb.token} />
                      </Row>
                    )}
                    <p style={{ fontSize: 11, color: '#8492A6', margin: '4px 0 0' }}>
                      {dp
                        ? `${rupee(pb.flat_price)} / ${pb.flat_area} sq.yd = ${rupee(pb.flat_rate)} per sq.yd${pb.terrace_area ? ` · terrace ${pb.terrace_area} sq.yd @ ${rupee(pb.terrace_rate)} = ${rupee(pb.terrace_price)}` : ''}`
                        : 'Regular plan — priced from the approved price book. Switch to Down Payment to change the rate or token.'}
                    </p>
                  </div>
                );
              })()}
              {pb.kind === 'shop' && (() => {
                const e = shopEdit(pb);
                return (
                  <div style={{ border: '1.5px solid #C7D2FE', background: '#F5F7FF', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#3D5AFE', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                      Editable · everything below recalculates
                    </div>
                    <Row><L>Rate (₹/sq.ft)</L>
                      <In type="number" value={e.rate ?? ''} onChange={(ev) => setShopEdit(pb, { rate: ev.target.value })} />
                    </Row>
                    <Row><L>Total Unit Price</L>
                      <div style={{ display: 'flex', flex: 1, gap: 8 }}>
                        {[['pct', '%'], ['amount', '₹']].map(([m, lbl]) => (
                          <button key={m} type="button" onClick={() => setShopEdit(pb, { mode: m })}
                            style={{ width: 44, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              border: `1.5px solid ${e.mode === m ? '#3D5AFE' : '#E0E6F0'}`,
                              background: e.mode === m ? '#3D5AFE' : '#fff', color: e.mode === m ? '#fff' : '#8492A6' }}>{lbl}</button>
                        ))}
                        {e.mode === 'amount'
                          ? <In type="number" value={e.unitAmount ?? ''} onChange={(ev) => setShopEdit(pb, { unitAmount: ev.target.value })} />
                          : <In type="number" value={e.unitPct ?? ''} onChange={(ev) => setShopEdit(pb, { unitPct: ev.target.value })} />}
                      </div>
                    </Row>
                    <p style={{ fontSize: 11, color: '#8492A6', margin: '4px 0 0' }}>
                      {e.mode === 'amount'
                        ? `Entered as an amount · ${pb.amount ? ((pb.loan_amount / pb.amount) * 100).toFixed(2) : '0'}% of the shop amount`
                        : `${e.unitPct || 0}% of ${rupee(pb.amount)} = ${rupee(pb.loan_amount)}`}
                    </p>
                  </div>
                );
              })()}
              <div style={{ border: '1px solid #E0E6F0', borderRadius: 10, overflow: 'hidden' }}>
                {pratRowsFor(pb).map((row, i) => (
                  Array.isArray(row) ? (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 14px',
                      background: row[2] === 'sub' ? '#EEF2FF' : (i % 2 ? '#FAFBFE' : '#fff'), borderBottom: '1px solid #F0F3FA' }}>
                      <span style={{ fontSize: 13, color: row[2] === 'sub' ? '#1A1A2E' : '#6B7280', fontWeight: row[2] === 'sub' ? 700 : 400 }}>{row[0]}</span>
                      <span style={{ fontSize: 13, fontWeight: row[2] === 'sub' ? 800 : 700, color: '#1A1A2E' }}>{row[1]}</span>
                    </div>
                  ) : (
                    <div key={i} style={{ padding: '9px 14px', background: '#F5F7FF', borderBottom: '1px solid #E5EAF5',
                      fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: '#3D5AFE' }}>{row.h}</div>
                  )
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 14px',
                  background: pratBooks.length > 1 ? '#4B5563' : '#182350' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
                    {pb.kind === 'shop' ? 'Grand Total' : 'Total'}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{rupee(pbTotal(pb))}</span>
                </div>
              </div>
            </Section>
          ))}
          {/* Only meaningful with more than one unit — a single unit's total is above. */}
          {pratBooks.length > 1 && (
            <Section title={`Combined Total · ${pratBooks.length} units`}>
              <div style={{ border: '1px solid #E0E6F0', borderRadius: 10, overflow: 'hidden' }}>
                {pratBooks.map((pb, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 14px',
                    background: i % 2 ? '#FAFBFE' : '#fff', borderBottom: '1px solid #F0F3FA' }}>
                    <span style={{ fontSize: 13, color: '#6B7280' }}>{unitTitle(pb)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{rupee(pbTotal(pb))}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 14px', background: '#182350' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Total All Inclusive Amount</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{rupee(pratTotal)}</span>
                </div>
              </div>
            </Section>
          )}
        </>
      ) : (<>
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
          <>
            <Row><L>Unit Type</L>
              <Sel value={eoiType} onChange={(e) => {
                const name = e.target.value; setEoiType(name);
                // Standard EOI sizes prefill Plot/Construction Area (× No. of Units, locked in EOI mode).
                applyEoiUnit(name, eoiUnits);
              }} opts={['', ...(project.eoi_unit_types || []).map((x) => x.type)]} />
            </Row>
            <Row><L>No. of Units</L>
              <In type="number" value={eoiUnits} onChange={(e) => {
                const u = e.target.value; setEoiUnits(u); applyEoiUnit(eoiType, u);
              }} /></Row>
          </>
        )}
        <Row><L>Plot Area ({unit})</L><In value={f.area} invalid={errs.area} onChange={(e) => set('area', e.target.value)} /></Row>
        {flags.hasConstructionFields && <Row><L>Construction Area ({unit})</L><In value={f.const_area} onChange={(e) => set('const_area', e.target.value)} /></Row>}
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
        {(flags.hasMaintDeposit || v.isKalrav3) && <Calc label="Maintenance Deposit" sub={v.isKalrav3 ? '½ × Maintenance Amount' : maintSub} val={v.maintDeposit} />}
        {(flags.hasMaintAdvance || v.isKalrav3) && <Calc label="Maintenance Advance" sub={v.isKalrav3 ? '½ × Maintenance Amount' : maintSub} val={v.maintAdvance} />}
        <Calc label="Maintenance Amount" sub={(flags.hasMaintDeposit || flags.hasMaintAdvance || v.isKalrav3) ? '= Maintenance Deposit + Maintenance Advance' : maintSub} val={v.maint} />
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
      </>)}

      <Section title="Payment Schedule">
        <Row><L>Booking Date *</L><In type="date" value={safeDate(f.booking_date)} onChange={(e) => set('booking_date', e.target.value)} /></Row>
        {/* A Regular Pratishtha unit is an all-inclusive fixed box price — no staged
            payments. A Down Payment one is paid in instalments against the box price. */}
        {pricingReady && (!prat || pratSched) && (<>
        {/* Extra Work Amount Installments — shown ABOVE the sale-deed installments */}
        {(hasSaleDeedSplit || pratShop) && nsdBase > 0 && (
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
        {(hasSaleDeedSplit || pratSched) && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E3A5F', marginBottom: 2 }}>{pratShop ? 'Final Unit Price Installments' : 'Unit Price Installments'}</div>
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
              {/* Pratishtha's three charge lines all fall due on the sale deed or
                  possession, so they carry that wording instead of a date picker. */}
              {pratSched ? pratExtras().map((x) => (
                <tr key={x.label} style={{ background: '#FFF8E1' }}>
                  <td style={{ ...td, fontWeight: 700, color: '#92400E', fontSize: 11 }}>Extra</td>
                  <td style={{ ...td, fontSize: 10, fontStyle: 'italic', color: '#6B7280' }}>Date of Sale Deed or Possession (whichever is earlier)</td>
                  <td style={{ ...td, fontWeight: 700, color: '#92400E', fontSize: 11 }}>{x.label}</td>
                  <td style={td}><input value={rupee(x.amt)} readOnly style={{ ...inp, background: '#f0f4ff', color: '#1a73e8', fontWeight: 600 }} /></td>
                </tr>
              )) : v.totalExtra > 0 && (
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
        {insts.length > 0 && <div style={{ fontSize: 12, marginTop: 6, color: Math.abs(pctTotal - 100) < 0.01 ? '#15803D' : '#DC2626' }}>Total: {pctTotal.toFixed(2)}%{pratDp ? '' : ` · Legal & Other Charges ${rupee(v.totalExtra)}`}</div>}
        </>)}
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
        {savedLoiPath && !loiFile && (
          <div style={{ fontSize: 12, color: '#15803D', background: '#E8F5E9', border: '1px solid #86EFAC', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>📎 Signed LOI already attached from your last save.</span>
            <button type="button" onClick={() => openLoi(draftId || savedDraftId)} style={{ background: 'none', border: 'none', color: '#15803D', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>View</button>
          </div>
        )}
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{savedLoiPath ? 'Replace Signed LOI' : 'Upload Signed LOI *'}</label>
        <input type="file" accept="image/*,.pdf" onChange={onFile} style={{ display: 'block', marginTop: 8, fontSize: 13 }} />
        {loiFile && <div style={{ fontSize: 12, color: '#15803D', marginTop: 6 }}>📎 {loiFile.name}</div>}
      </Section>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 8, background: msg[0] === '✅' ? '#E8F5E9' : '#FEF2F2', color: msg[0] === '✅' ? '#15803D' : '#DC2626', fontSize: 13, marginBottom: 12 }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={saveDraft} disabled={saving || !projectId} style={{ ...submitBtn, background: '#fff', color: '#3D5AFE', border: '1.5px solid #3D5AFE' }}>
          {saving ? '…' : '💾 Save Draft'}
        </button>
        <button onClick={submit} disabled={saving} style={submitBtn}>{saving ? 'Saving…' : 'Submit Booking'}</button>
      </div>
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
