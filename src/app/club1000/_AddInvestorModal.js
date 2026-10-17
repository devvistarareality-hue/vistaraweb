'use client';
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import DateFieldDMY from '../../components/DateFieldDMY';
import { downloadInvestorLOI } from '../../lib/investorLOI';
import { useCurrentCompany } from '../../lib/currentCompany';

import Icon from '../../components/Icon';
import { C1Modal, C1Section, C1Field, C1Value, C1Error } from './_Form';
import { schedulePeriods, maturityWorking } from '../../lib/c1Periods';
import ScheduleTable from './_ScheduleTable';
import { errText } from '../../lib/apiError';

const SOURCE_LABELS = { referral: 'Referral', walk_in: 'Walk-in', website: 'Website', other: 'Other' };

// Format using LOCAL date parts, never toISOString() — that converts to UTC and
// silently shifts the date back a day in positive-offset timezones (e.g. IST).
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeMaturity(investmentDateStr, tenureMonths) {
  if (!investmentDateStr || !tenureMonths) return '';
  const d = new Date(`${investmentDateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + Number(tenureMonths));
  return toISODate(d);
}

// Principal + the scheme's total return, applied once over the whole tenure
// — pct is the total return BY maturity (e.g. "LEGACY 110" pays 110% total
// over its 5-year tenure, not 110% every year), not an annualized rate to
// scale by day-count. Mirrors backend/club1000/services.py::maturity_value.
function computeMaturityValue(investmentDateStr, maturityDateStr, principal, pct) {
  if (!investmentDateStr || !maturityDateStr) return principal;
  return principal + principal * (pct / 100);
}

// Every interest instalment (quarterly or monthly) falls on this fixed day of
// its month rather than the month-end — e.g. investing 25 Jun means the first
// quarterly instalment is 10 Jul (a 15-day stub), not 31 Jul — mirrors
// backend/club1000/services.py::PAYOUT_DAY.
const PAYOUT_DAY = 10;

// Company fiscal quarters: Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar.
// Quarterly interest is paid in the FIRST month of the quarter AFTER the one the
// investment falls in — e.g. investing anywhere in Q1 (Apr/May/Jun) pays out in
// July (Q2's start month), Q2 investments pay in October, Q3 in January, Q4 in
// April — mirrors backend/club1000/services.py::_next_quarter_payout.
const QUARTER_START_MONTHS = [4, 7, 10, 1]; // Q1, Q2, Q3, Q4 start months (1-indexed)

function quarterIndex(month) { // 0=Q1(Apr-Jun) 1=Q2(Jul-Sep) 2=Q3(Oct-Dec) 3=Q4(Jan-Mar)
  return Math.floor((((month - 4) % 12) + 12) % 12 / 3);
}

function nextQuarterPayout(d) {
  const idx = quarterIndex(d.getMonth() + 1); // getMonth() is 0-indexed
  const nextIdx = (idx + 1) % 4;
  const targetMonth = QUARTER_START_MONTHS[nextIdx]; // 1-indexed
  // Only the Q3 (Oct-Dec) -> Q4 (Jan) handoff crosses a calendar year boundary.
  const year = idx === 2 ? d.getFullYear() + 1 : d.getFullYear();
  return new Date(year, targetMonth - 1, PAYOUT_DAY);
}

// The LAST instalment is capped at the maturity date instead of always
// landing on the next quarter's PAYOUT_DAY — otherwise the stretch from the
// last regular quarterly date to maturity would go uncompensated. Mirrors
// backend/club1000/services.py::default_quarterly_dates.
function computeQuarterlyDates(investmentDateStr, tenureMonths) {
  let current = new Date(`${investmentDateStr}T00:00:00`);
  if (Number.isNaN(current.getTime())) return [];
  const maturity = new Date(current);
  maturity.setMonth(maturity.getMonth() + Number(tenureMonths));
  const dates = [];
  for (;;) {
    const nxt = nextQuarterPayout(current);
    if (nxt >= maturity) { dates.push(toISODate(maturity)); break; }
    dates.push(toISODate(nxt));
    current = nxt;
  }
  return dates;
}

// Mirrors backend/club1000/services.py::default_monthly_dates — one instalment
// per calendar month on PAYOUT_DAY, for the full tenure.
function nextMonth10th(d) {
  const totalMonth = d.getMonth() + 1 + 1; // 1-indexed, +1 month ahead
  const year = d.getFullYear() + Math.floor((totalMonth - 1) / 12);
  const month = ((totalMonth - 1) % 12) + 1;
  return new Date(year, month - 1, PAYOUT_DAY);
}

// The LAST instalment is capped at the maturity date — see computeQuarterlyDates.
function computeMonthlyDates(investmentDateStr, tenureMonths) {
  let current = new Date(`${investmentDateStr}T00:00:00`);
  if (Number.isNaN(current.getTime())) return [];
  const maturity = new Date(current);
  maturity.setMonth(maturity.getMonth() + Number(tenureMonths));
  const dates = [];
  for (;;) {
    const nxt = nextMonth10th(current);
    if (nxt >= maturity) { dates.push(toISODate(maturity)); break; }
    dates.push(toISODate(nxt));
    current = nxt;
  }
  return dates;
}

// Day-count proration, mirrors backend/club1000/services.py::generate_payout_schedule:
// the investor's FIXED total return over the tenure (principal * pct/100 —
// pct is the total return by maturity, not an annualized rate) is spread
// pro-rata across the tenure's actual days: dailyRate = (principal * pct/100)
// / tenureDays, each instalment = dailyRate * actual calendar days since the
// PREVIOUS instalment (or since investment_date for the first one) — so the
// first instalment is usually a stub. The sum of every instalment therefore
// always equals principal * pct/100, exactly matching computeMaturityValue's
// total interest.
// The last day an instalment's interest accrues to. A payout DATE is when the
// money is handed over, not the period it covers: investing 1 Jul with
// quarterly payouts, the instalment due 10 Oct pays the quarter that ENDED
// 30 Sep, so accruing to the 10th charged ten days belonging to the next
// quarter. The final instalment is capped at maturity, which is a real end
// rather than a payment day, so it accrues to itself.
// Mirrors backend/club1000/services.py::accrual_end.
function accrualEnd(due, maturity) {
  if (due >= maturity) return maturity;
  // Day 0 of the due month is the last day of the month before it.
  return new Date(due.getFullYear(), due.getMonth(), 0);
}

function prorateInstalments(dates, investmentDateStr, maturityDateStr, principal, totalReturnPct) {
  const start = new Date(`${investmentDateStr}T00:00:00`);
  const end = new Date(`${maturityDateStr}T00:00:00`);
  const tenureDays = Math.round((end - start) / 86400000);
  const dailyRate = tenureDays > 0 ? (principal * totalReturnPct) / 100 / tenureDays : 0;
  let prev = start;
  return dates.map((due_date) => {
    // Accrue to the end of the period this instalment pays for, not to the day
    // it is handed over — see accrualEnd.
    const periodEnd = accrualEnd(new Date(`${due_date}T00:00:00`), end);
    const days = Math.round((periodEnd - prev) / 86400000);
    // Invested on or after this period's own end (e.g. 30 Sep, with the 10 Oct
    // instalment covering up to 30 Sep): nothing has accrued yet. prev stays
    // put so the next instalment runs from the investment date and no day goes
    // uncounted.
    if (days <= 0) return 0;
    prev = periodEnd;
    return +((dailyRate * days).toFixed(2));
  });
}

const INTEREST_PAYOUT_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', maturity: 'At Maturity' };

// `revise` (an approved investor) turns this into Revise LOI: the same form, prefilled
// with the investor — or with the revision they saved as a draft — where everything,
// the scheme and the investment date included, can change. It submits to the revise
// endpoint and goes for approval; nothing changes on the investor until it's approved.
export default function AddInvestorModal({ schemes: schemeList, prefillLead, draft: savedDraft, revise, onClose, onCreated }) {
  // The issuer printed on the investor LOI — company-wise, never a constant.
  const issuer = useCurrentCompany();
  // What the form opens with: a revision's saved draft over the investor itself, or a
  // saved new-investor draft. Either wins over the lead prefill — it IS what was last typed.
  const draft = revise ? { ...revise, ...(revise.revision_draft || {}) } : savedDraft;
  // The investor's own scheme stays selectable even if it is no longer offered.
  const schemes = revise && revise.scheme && !schemeList.some((sc) => String(sc.id) === String(revise.scheme))
    ? [...schemeList, { id: revise.scheme, name: revise.scheme_name || 'Current scheme', tenure_months: revise.scheme_tenure_months,
        min_ticket_size: 0, interest_payout_options: [revise.interest_payout || 'maturity'], payout_rates: {} }]
    : schemeList;
  const nextRevisionNo = revise ? (revise.revision_no || 0) + 1 : 0;
  const initialSchemeId = draft?.scheme || prefillLead?.scheme_interest || schemes[0]?.id || '';
  const initialScheme = schemes.find((s) => String(s.id) === String(initialSchemeId));
  const [form, setForm] = useState({
    scheme: initialSchemeId,
    source: draft?.source || 'referral',
    reference_name: draft?.reference_name || prefillLead?.reference_name || '',
    reference_phone: draft?.reference_phone || prefillLead?.reference_phone || '',
    name: draft?.name || prefillLead?.name || '',
    phone: draft?.phone || prefillLead?.phone || '',
    email: draft?.email || prefillLead?.email || '',
    pan: draft?.pan || '',
    // A draft's amount may legitimately be 0 — that is "not said yet", and the
    // field should read empty rather than showing a figure nobody typed.
    amount_invested: (draft && Number(draft.amount_invested) > 0)
      ? String(draft.amount_invested) : (prefillLead?.amount_interested || ''),
    investment_date: draft?.investment_date || toISODate(new Date()),
    notes: draft?.notes || '',
    security: draft?.security || '',
    interest_payout: draft?.interest_payout || initialScheme?.interest_payout_options?.[0] || 'maturity',
    // The lead's negotiated rate wins over the scheme's rate for the default
    // frequency, if one was set.
    total_return_pct: (draft && Number(draft.total_return_pct) > 0) ? String(draft.total_return_pct)
      : (prefillLead?.total_return_pct ?? initialScheme?.payout_rates?.[initialScheme?.interest_payout_options?.[0] || 'maturity'] ?? ''),
  });
  const [documentFile, setDocumentFile] = useState(null); // {name, type, data(base64)}
  const [schedule, setSchedule] = useState([]); // [{due_date, amount_due, payout_type}] — editable preview
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loiDone, setLoiDone] = useState(false);
  const [loiDownloading, setLoiDownloading] = useState(false);
  const [loiFile, setLoiFile] = useState(null); // signed scan, {name, type, data(base64)}
  const [refSuggestions, setRefSuggestions] = useState([]);
  const [refDropdownOpen, setRefDropdownOpen] = useState(false);

  const scheme = schemes.find((s) => String(s.id) === String(form.scheme));
  const maturityPreview = scheme ? computeMaturity(form.investment_date, scheme.tenure_months) : '';
  const maturityValuePreview = computeMaturityValue(form.investment_date, maturityPreview, Number(form.amount_invested) || 0, Number(form.total_return_pct) || 0);

  // Existing reference name/number pairs already used at this company — lets a
  // user pick a prior reference instead of retyping it with different casing
  // (e.g. "chinmay" vs "Chinmay"), which the backend also canonicalizes by phone.
  useEffect(() => {
    apiFetch(CLUB1000_ENDPOINTS.investorReferences)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRefSuggestions)
      .catch(() => {});
  }, []);

  const filteredRefSuggestions = form.reference_name.trim()
    ? refSuggestions.filter((r) => r.reference_name.toLowerCase().includes(form.reference_name.trim().toLowerCase()))
    : refSuggestions;

  function selectReferenceSuggestion(r) {
    setForm((f) => ({ ...f, reference_name: r.reference_name, reference_phone: r.reference_phone }));
    setRefDropdownOpen(false);
  }

  function buildDefaultSchedule() {
    if (!scheme || (form.interest_payout !== 'quarterly' && form.interest_payout !== 'monthly')) return [];
    const dates = form.interest_payout === 'quarterly'
      ? computeQuarterlyDates(form.investment_date, scheme.tenure_months)
      : computeMonthlyDates(form.investment_date, scheme.tenure_months);
    const principal = Number(form.amount_invested) || 0;
    const totalReturn = Number(form.total_return_pct) || 0;
    const amounts = prorateInstalments(dates, form.investment_date, maturityPreview, principal, totalReturn);
    const rows = dates.map((due_date, i) => ({ due_date, amount_due: Number(amounts[i]).toFixed(2), payout_type: 'interest' }));
    rows.push({ due_date: maturityPreview, amount_due: Number(principal).toFixed(2), payout_type: 'maturity' });
    return rows;
  }

  // Quarterly/monthly payout dates & amounts are shown for confirmation and stay
  // editable — recomputed automatically as the form changes, until the user edits
  // a row, then their edits are preserved until the scheme is switched or Reset is used.
  useEffect(() => {
    if (form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') {
      if (!scheduleDirty) setSchedule(buildDefaultSchedule());
    } else if (schedule.length) {
      setSchedule([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.interest_payout, form.scheme, form.investment_date, form.total_return_pct, form.amount_invested]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // The working behind each interest row (period, days, interest per day).
  const periods = schedulePeriods(schedule, form?.investment_date, maturityPreview, form?.amount_invested, form?.total_return_pct, form?.interest_payout);

  function updateScheduleRow(idx, field, value) {
    setScheduleDirty(true);
    setSchedule((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function resetSchedule() {
    setScheduleDirty(false);
    setSchedule(buildDefaultSchedule());
  }

  // Selecting a scheme re-prefills interest payout & return % from that scheme's
  // defaults — both stay editable afterwards for this specific investor.
  function selectScheme(id) {
    const s = schemes.find((sc) => String(sc.id) === String(id));
    const freq = s?.interest_payout_options?.[0] || 'maturity';
    setScheduleDirty(false);
    setForm((f) => ({
      ...f,
      scheme: id,
      interest_payout: freq,
      total_return_pct: s?.payout_rates?.[freq] ?? '',
    }));
  }

  // Changing the frequency re-prefills return % from the scheme's rate for
  // THAT frequency — each frequency carries its own rate, not one flat number.
  function selectInterestPayout(freq) {
    setScheduleDirty(false);
    setForm((f) => ({ ...f, interest_payout: freq, total_return_pct: scheme?.payout_rates?.[freq] ?? '' }));
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDocumentFile({ name: file.name, type: file.type, data: reader.result.split(',')[1] });
    reader.readAsDataURL(file);
  }

  function handleLoiFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLoiFile({ name: file.name, type: file.type, data: reader.result.split(',')[1] });
    reader.readAsDataURL(file);
  }

  // Generate & download the Investment Proposal Form (LOI) from the form's
  // current values — client-side only, no API call except previewing the
  // stable LOI number so it's baked into the PDF (the real number is
  // (re)computed the same way at actual submit time).
  async function doDownloadLoi() {
    setError('');
    if (!scheme) { setError('Select a scheme first.'); return; }
    if (!form.name.trim()) { setError('Investor name is required before generating the LOI.'); return; }
    if (Number(form.amount_invested) < Number(scheme.min_ticket_size)) {
      setError(`Minimum ticket size for ${scheme.name} is ₹${Number(scheme.min_ticket_size).toLocaleString('en-IN')}.`);
      return;
    }
    setLoiDownloading(true);
    try {
      if (revise) {
        // The revised LOI keeps the investor's LOI number and carries R1, R2, …
        await downloadInvestorLOI({ ...revise, ...form }, scheme, { revisionNo: nextRevisionNo, schedule, companyName: issuer.name, companyLogoUrl: issuer.logoUrl });
        setLoiDone(true);
        return;
      }
      const noRes = await apiFetch(`${CLUB1000_ENDPOINTS.investorNextLoiNo}?scheme_id=${scheme.id}`);
      const { loi_no } = noRes.ok ? await noRes.json() : { loi_no: '' };
      await downloadInvestorLOI({ ...form, loi_no }, scheme, { schedule, companyName: issuer.name, companyLogoUrl: issuer.logoUrl });
      setLoiDone(true);
    } catch (_) {
      setError('Could not generate the LOI. Please try again.');
    } finally {
      setLoiDownloading(false);
    }
  }

  // Saved but not submitted. None of submit()'s completeness checks apply —
  // the whole point is never to lose a long form because one field is missing.
  // The row it writes is the same one submitting later promotes, so saving twice
  // never leaves two investors behind.
  const [draftId, setDraftId] = useState(revise ? null : (draft?.id || null));
  const [savingDraft, setSavingDraft] = useState(false);

  async function saveDraft() {
    setError('');
    if (!form.scheme) { setError('Pick a scheme before saving a draft.'); return; }
    setSavingDraft(true);
    try {
      const payload = { ...form, ...(draftId ? { id: draftId } : {}) };
      if (payload.source !== 'referral') { delete payload.reference_name; delete payload.reference_phone; }
      if (revise && (form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') && schedule.length) payload.payout_schedule = schedule;
      // A revision's draft lives on the investor and leaves it approved and live.
      const res = await apiFetch(revise ? CLUB1000_ENDPOINTS.investorReviseDraft(revise.id) : CLUB1000_ENDPOINTS.investorDraft, {
        method: 'POST', body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(errText(data, 'Could not save the draft.')); return; }
      if (!revise) setDraftId(data.id);
      onCreated?.(data);
      onClose();
    } finally {
      setSavingDraft(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (scheme && Number(form.amount_invested) < Number(scheme.min_ticket_size)) {
      setError(`Minimum ticket size for ${scheme.name} is ₹${Number(scheme.min_ticket_size).toLocaleString('en-IN')}.`);
      return;
    }
    if (!loiFile) {
      setError('Download the LOI, get it signed, and upload it before submitting.');
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, loi_file: loiFile, ...(draftId ? { draft_id: draftId } : {}) };
      if (payload.source !== 'referral') { delete payload.reference_name; delete payload.reference_phone; }
      if (documentFile) payload.document_file = documentFile;
      if ((form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') && schedule.length) payload.payout_schedule = schedule;
      if (prefillLead?.id && !revise) payload.lead = prefillLead.id;
      const res = await apiFetch(revise ? CLUB1000_ENDPOINTS.investorRevise(revise.id) : CLUB1000_ENDPOINTS.investors, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.amount_invested?.[0] || errText(data, revise ? 'Could not submit the revision.' : 'Could not add investor.'));
        return;
      }
      onCreated(data);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const busyAny = busy || savingDraft;
  return (
    <C1Modal wide
      title={revise ? 'Revise LOI' : draft ? 'Edit Draft Investor' : 'Add Investor'}
      badge={revise ? `R${nextRevisionNo}` : null}
      sub={revise ? `${revise.name} · ${revise.phone}` : 'Added investors go for approval before they count'}
      onClose={onClose} onSubmit={submit}
      footer={<>
        {/* Saving a draft is what you do BEFORE the signed LOI is back — so it stays enabled without one. */}
        <div className="c1m-foot-left">
          <button type="button" className={`nx-btn nx-btn-md nx-btn-secondary inv-draft-btn${busyAny ? ' is-busy' : ''}`} onClick={saveDraft} disabled={busyAny}>
            {savingDraft ? 'Saving…' : (draftId || revise?.revision_draft) ? 'Update Draft' : 'Save Draft'}
          </button>
        </div>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="nx-btn nx-btn-md nx-btn-success" disabled={busy || !loiFile}>{busy ? 'Submitting…' : 'Submit for Approval'}</button>
      </>}>





      <C1Section title="Investor">
        <C1Field label="Investor name" required>
          <input className="nx-input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </C1Field>
        <C1Field label="Mobile number" required>
          <input className="nx-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
        </C1Field>
        <C1Field label="Email">
          <input className="nx-input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </C1Field>
        <C1Field label="PAN">
          <input className="nx-input" value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} />
        </C1Field>
        <C1Field label="Scan document" hint="KYC / ID proof">
          <input className="c1-file" type="file" accept="image/*,.pdf" onChange={handleFileChange} />
          {documentFile && <span className="c1-help ok">Selected: {documentFile.name}</span>}
          {revise?.document_url && !documentFile && <span className="c1-help">One is on file — choose a file only to replace it.</span>}
        </C1Field>
        <C1Field label="Security" hint="Printed on the LOI — optional">
          <input className="nx-input" value={form.security} onChange={(e) => set('security', e.target.value)} placeholder="NA" />
        </C1Field>
        <C1Field label="Notes">
          <input className="nx-input" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </C1Field>
      </C1Section>

      <C1Section title="Source">
        <C1Field label="Source">
          <select className="nx-input" value={form.source} onChange={(e) => set('source', e.target.value)}>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </C1Field>
        {form.source === 'referral' && <>
          <C1Field label="Reference name">
            <div className="c1i-ref">
              <input className="nx-input" value={form.reference_name} autoComplete="off"
                onChange={(e) => { set('reference_name', e.target.value); setRefDropdownOpen(true); }}
                onFocus={() => setRefDropdownOpen(true)} onBlur={() => setTimeout(() => setRefDropdownOpen(false), 120)} />
              {refDropdownOpen && filteredRefSuggestions.length > 0 && (
                <div className="nx-popover c1i-ref-pop">
                  {filteredRefSuggestions.map((r, i) => (
                    <div key={`${r.reference_phone}-${i}`} className="c1i-ref-opt" onMouseDown={() => selectReferenceSuggestion(r)}>
                      <b>{r.reference_name}</b>{r.reference_phone && <span> — {r.reference_phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </C1Field>
          <C1Field label="Reference number">
            <input className="nx-input" value={form.reference_phone} onChange={(e) => set('reference_phone', e.target.value)} />
          </C1Field>
        </>}
      </C1Section>

      <C1Section title="Scheme & dates">
        <C1Field label="Scheme" required hint={scheme ? `Min ticket ₹${Number(scheme.min_ticket_size).toLocaleString('en-IN')}` : null}>
          <select className="nx-input" value={form.scheme} onChange={(e) => selectScheme(e.target.value)} required>
            {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </C1Field>
        <C1Field label="Date of investment" required>
          <DateFieldDMY value={form.investment_date} onChange={(e) => set('investment_date', e.target.value)} />
        </C1Field>
        <C1Field label="Date of maturity" hint="From the scheme's tenure">
          <C1Value>{maturityPreview ? formatDMY(maturityPreview) : '—'}</C1Value>
        </C1Field>
      </C1Section>

      <C1Section title="Investment">
        <C1Field label="Amount invested (₹)" required>
          <input className="nx-input" type="number" min="0" value={form.amount_invested} onChange={(e) => set('amount_invested', e.target.value)} required />
        </C1Field>
        <C1Field label="Interest payout">
          <select className="nx-input" value={form.interest_payout} onChange={(e) => selectInterestPayout(e.target.value)}>
            {(scheme?.interest_payout_options?.length ? scheme.interest_payout_options : ['maturity']).map((key) => (
              <option key={key} value={key}>{INTEREST_PAYOUT_LABELS[key] || key}</option>
            ))}
          </select>
        </C1Field>
        <C1Field label="Return %" hint="Total return by maturity" required>
          <input className="nx-input" type="number" step="0.01" min="0" value={form.total_return_pct} onChange={(e) => set('total_return_pct', e.target.value)} required />
        </C1Field>
        {Number(form.amount_invested) > 0 && Number(form.total_return_pct) > 0 && (
          <C1Field label="Maturity value">
            <C1Value tone="good">₹{Math.round(maturityValuePreview).toLocaleString('en-IN')}</C1Value>
          </C1Field>
        )}
      </C1Section>

      {form.interest_payout === 'maturity' && maturityPreview && Number(form.amount_invested) > 0 && (() => {
        const mw = maturityWorking(form.amount_invested, form.total_return_pct, form.investment_date, maturityPreview);
        return mw.rows.length ? (
          <C1Section title="Interest working — paid at maturity">
            <ScheduleTable readOnly schedule={mw.rows} periods={mw.periods} principal={form.amount_invested} pct={form.total_return_pct}
              from={form.investment_date} to={maturityPreview} renderDate={() => null} onAmount={() => {}} onReset={() => {}} />
          </C1Section>
        ) : null;
      })()}
      {(form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') && schedule.length > 0 && (
        <C1Section title="Payout schedule — confirm or edit">
          <ScheduleTable schedule={schedule} periods={periods} principal={form.amount_invested} pct={form.total_return_pct}
            from={form.investment_date} to={maturityPreview}
            renderDate={(row, idx) => <DateFieldDMY value={row.due_date} onChange={(e) => updateScheduleRow(idx, 'due_date', e.target.value)} />}
            onAmount={(idx, v) => updateScheduleRow(idx, 'amount_due', v)} onReset={resetSchedule} />
        </C1Section>
      )}

      <C1Section title={revise ? 'Revised investment proposal form (LOI)' : 'Investment proposal form (LOI)'}>
        <C1Field label="1. Download" hint="Print it and get it signed">
          <button type="button" className="nx-btn nx-btn-md nx-btn-secondary c1i-loi-btn" onClick={doDownloadLoi} disabled={loiDownloading}>
            {loiDownloading ? 'Generating…' : <><Icon name="download" /> {revise ? `Download Revised LOI (R${nextRevisionNo})` : 'Download LOI PDF'}</>}
          </button>
          {loiDone && <span className="c1-help ok">{revise ? 'Revised LOI' : 'LOI'} downloaded — get it signed and upload it below.</span>}
        </C1Field>
        <C1Field label="2. Upload signed copy" required>
          <input className="c1-file" type="file" accept="image/*,.pdf" onChange={handleLoiFileChange} />
          {loiFile && <span className="c1-help ok">Selected: {loiFile.name}</span>}
        </C1Field>
      </C1Section>

      <C1Error>{error}</C1Error>
    </C1Modal>
  );
}
