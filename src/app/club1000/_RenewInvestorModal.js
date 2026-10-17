'use client';
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { downloadInvestorLOI } from '../../lib/investorLOI';
import { useCurrentCompany } from '../../lib/currentCompany';
import { errText } from '../../lib/apiError';
import { C1Modal, C1Section, C1Field, C1Value, C1Error } from './_Form';
import { schedulePeriods } from '../../lib/c1Periods';
import ScheduleTable from './_ScheduleTable';
import { RenewalSummary } from './_CloseInvestment';



function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Every interest instalment falls on this fixed day of its month rather than
// the month-end — mirrors backend/club1000/services.py::PAYOUT_DAY.
const PAYOUT_DAY = 10;
const QUARTER_START_MONTHS = [4, 7, 10, 1];
function quarterIndex(month) { return Math.floor((((month - 4) % 12) + 12) % 12 / 3); }
function nextQuarterPayout(d) {
  const idx = quarterIndex(d.getMonth() + 1);
  const nextIdx = (idx + 1) % 4;
  const targetMonth = QUARTER_START_MONTHS[nextIdx];
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
function nextMonth10th(d) {
  const totalMonth = d.getMonth() + 1 + 1;
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
// Day-count proration — mirrors backend/club1000/services.py::generate_payout_schedule:
// the investor's FIXED total return over the tenure (principal * pct/100 —
// pct is the total return by maturity, not an annualized rate) is spread
// pro-rata across the tenure's actual days, not across a flat 365.
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

function computeMaturity(investmentDateStr, tenureMonths) {
  if (!investmentDateStr || !tenureMonths) return '';
  const d = new Date(`${investmentDateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + Number(tenureMonths));
  return toISODate(d);
}

const INTEREST_PAYOUT_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', maturity: 'At Maturity' };

export default function RenewInvestorModal({ investor, scheme, onClose, onSaved }) {
  // The issuer printed on the investor LOI — company-wise, never a constant.
  const issuer = useCurrentCompany();
  const [form, setForm] = useState({
    investment_date: toISODate(new Date()),
    amount_invested: String(investor.amount_invested || ''),
    interest_payout: investor.interest_payout || 'maturity',
    total_return_pct: String(investor.total_return_pct ?? ''),
    security: investor.security || '',
    notes: investor.notes || '',
  });
  const [schedule, setSchedule] = useState([]);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loiDone, setLoiDone] = useState(false);
  const [loiDownloading, setLoiDownloading] = useState(false);
  const [loiFile, setLoiFile] = useState(null);

  const nextRevisionNo = (investor.revision_no || 0) + 1;
  const maturityPreview = scheme ? computeMaturity(form.investment_date, scheme.tenure_months) : '';

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  // Changing the frequency re-prefills return % from the scheme's rate for
  // THAT frequency — each frequency carries its own rate, not one flat number.
  function selectInterestPayout(freq) {
    setForm((f) => ({ ...f, interest_payout: freq, total_return_pct: scheme?.payout_rates?.[freq] ?? f.total_return_pct }));
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

  useEffect(() => {
    if (form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') {
      if (!scheduleDirty) setSchedule(buildDefaultSchedule());
    } else if (schedule.length) {
      setSchedule([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.interest_payout, form.total_return_pct, form.amount_invested, form.investment_date]);

  // The working behind each interest row (period, days, interest per day).
  const periods = schedulePeriods(schedule, form?.investment_date, maturityPreview, form?.amount_invested, form?.total_return_pct, form?.interest_payout);

  function updateScheduleRow(idx, field, value) {
    setScheduleDirty(true);
    setSchedule((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }
  function resetSchedule() { setScheduleDirty(false); setSchedule(buildDefaultSchedule()); }

  function handleLoiFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLoiFile({ name: file.name, type: file.type, data: reader.result.split(',')[1] });
    reader.readAsDataURL(file);
  }

  async function doDownloadLoi() {
    setError('');
    if (Number(form.amount_invested) < Number(scheme.min_ticket_size)) {
      setError(`Minimum ticket size for ${scheme.name} is ₹${Number(scheme.min_ticket_size).toLocaleString('en-IN')}.`);
      return;
    }
    setLoiDownloading(true);
    try {
      // maturity_date is explicitly overridden (not just spread from `investor`)
      // because renewing changes investment_date — the OLD investor.maturity_date
      // would otherwise leak through and understate/misdate the schedule's totals.
      await downloadInvestorLOI({ ...investor, ...form, maturity_date: maturityPreview || null }, scheme, { renewalNo: nextRevisionNo, schedule, companyName: issuer.name, companyLogoUrl: issuer.logoUrl });
      setLoiDone(true);
    } catch (_) {
      setError('Could not generate the LOI. Please try again.');
    } finally {
      setLoiDownloading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (Number(form.amount_invested) < Number(scheme.min_ticket_size)) {
      setError(`Minimum ticket size for ${scheme.name} is ₹${Number(scheme.min_ticket_size).toLocaleString('en-IN')}.`);
      return;
    }
    if (!loiFile) {
      setError('Download the renewed LOI, get it signed, and upload it before submitting.');
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, loi_file: loiFile };
      if ((form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') && schedule.length) payload.payout_schedule = schedule;
      const res = await apiFetch(CLUB1000_ENDPOINTS.investorRenew(investor.id), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(errText(data, 'Could not submit the renewal.'));
        return;
      }
      onSaved(data);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <C1Modal wide title="Renew Investment" badge={`R${nextRevisionNo}`} sub={`${investor.name} · ${investor.phone} · ${scheme?.name || ''}`}
      onClose={onClose} onSubmit={submit}
      footer={<>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="nx-btn nx-btn-md nx-btn-warning" disabled={busy || !loiFile}>{busy ? 'Submitting…' : 'Submit Renewal for Approval'}</button>
      </>}>
      <div className="nx-note info c1-error">
        This investment matured on {formatDMY(investor.maturity_date)}. Set the renewal terms below — the amount can go up or down.
      </div>

      <RenewalSummary investorId={investor.id} newAmount={form.amount_invested} />

      <C1Section title="Renewal">
        <C1Field label="Renewal date" required>
          <input className="nx-input" type="date" value={form.investment_date} onChange={(e) => set('investment_date', e.target.value)} required />
        </C1Field>
        <C1Field label="New maturity" hint="From the scheme's tenure">
          <C1Value>{maturityPreview ? formatDMY(maturityPreview) : '—'}</C1Value>
        </C1Field>
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
        <C1Field label="Return %" required>
          <input className="nx-input" type="number" step="0.01" min="0" value={form.total_return_pct} onChange={(e) => set('total_return_pct', e.target.value)} required />
        </C1Field>
        <C1Field label="Security" hint="Printed on the LOI — optional">
          <input className="nx-input" value={form.security} onChange={(e) => set('security', e.target.value)} placeholder="NA" />
        </C1Field>
        <C1Field label="Notes">
          <input className="nx-input" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </C1Field>
      </C1Section>

      {(form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') && schedule.length > 0 && (
        <C1Section title="Payout schedule — confirm or edit">
          <ScheduleTable schedule={schedule} periods={periods} principal={form.amount_invested} pct={form.total_return_pct}
            from={form.investment_date} to={maturityPreview}
            renderDate={(row) => <span className="c1st-fixed-date">{formatDMY(row.due_date)}</span>}
            onAmount={(idx, v) => updateScheduleRow(idx, 'amount_due', v)} onReset={resetSchedule} />
        </C1Section>
      )}

      <C1Section title="Renewed investment proposal form (LOI)">
        <C1Field label="1. Download" hint="Print it and get it signed">
          <button type="button" className="nx-btn nx-btn-md nx-btn-secondary c1i-loi-btn" onClick={doDownloadLoi} disabled={loiDownloading}>
            {loiDownloading ? 'Generating…' : `Download Renewed LOI (R${nextRevisionNo})`}
          </button>
          {loiDone && <span className="c1-help ok">Renewed LOI downloaded — get it signed and upload it below.</span>}
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
