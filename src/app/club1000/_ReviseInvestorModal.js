'use client';
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { downloadInvestorLOI } from '../../lib/investorLOI';

const TEAL = '#00838F';
const PURPLE = '#7C3AED';

const inp = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #C6D0DB', fontSize: 13, boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };

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
// Day-count proration — mirrors backend/club1000/services.py::generate_payout_schedule.
function prorateInstalments(dates, investmentDateStr, principal, totalReturnPct) {
  const dailyRate = (principal * totalReturnPct) / 100 / 365;
  let prev = new Date(`${investmentDateStr}T00:00:00`);
  return dates.map((due_date) => {
    const cur = new Date(`${due_date}T00:00:00`);
    const days = Math.round((cur - prev) / 86400000);
    prev = cur;
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

export default function ReviseInvestorModal({ investor, scheme, onClose, onSaved }) {
  const [form, setForm] = useState({
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
  const maturityPreview = scheme ? computeMaturity(investor.investment_date, scheme.tenure_months) : '';

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  // Changing the frequency re-prefills return % from the scheme's rate for
  // THAT frequency — each frequency carries its own rate, not one flat number.
  function selectInterestPayout(freq) {
    setForm((f) => ({ ...f, interest_payout: freq, total_return_pct: scheme?.payout_rates?.[freq] ?? f.total_return_pct }));
  }

  function buildDefaultSchedule() {
    if (!scheme || (form.interest_payout !== 'quarterly' && form.interest_payout !== 'monthly')) return [];
    const dates = form.interest_payout === 'quarterly'
      ? computeQuarterlyDates(investor.investment_date, scheme.tenure_months)
      : computeMonthlyDates(investor.investment_date, scheme.tenure_months);
    const principal = Number(form.amount_invested) || 0;
    const totalReturn = Number(form.total_return_pct) || 0;
    const amounts = prorateInstalments(dates, investor.investment_date, principal, totalReturn);
    const rows = dates.map((due_date, i) => ({ due_date, amount_due: amounts[i], payout_type: 'interest' }));
    rows.push({ due_date: maturityPreview, amount_due: principal, payout_type: 'maturity' });
    return rows;
  }

  useEffect(() => {
    if (form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') {
      if (!scheduleDirty) setSchedule(buildDefaultSchedule());
    } else if (schedule.length) {
      setSchedule([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.interest_payout, form.total_return_pct, form.amount_invested]);

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
      await downloadInvestorLOI({ ...investor, ...form }, scheme, { revisionNo: nextRevisionNo, schedule });
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
      setError('Download the revised LOI, get it signed, and upload it before submitting.');
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, loi_file: loiFile };
      if ((form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') && schedule.length) payload.payout_schedule = schedule;
      const res = await apiFetch(CLUB1000_ENDPOINTS.investorRevise(investor.id), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.detail || 'Could not submit the revision.');
        return;
      }
      onSaved(data);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(24,35,80,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F0F3FA' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E', display: 'flex', alignItems: 'center', gap: 8 }}>
            Revise LOI
            <span style={{ fontSize: 10, fontWeight: 800, color: PURPLE, background: '#F3E8FF', padding: '2px 8px', borderRadius: 20 }}>R{nextRevisionNo}</span>
          </div>
          <div style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>{investor.name} · {investor.phone} · {scheme?.name}</div>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, color: '#8492A6', background: '#F8FAFC', border: '1px solid #EDF1F7', borderRadius: 8, padding: '8px 10px' }}>
            Scheme, investor identity and investment date stay fixed across a revision — only the terms below can change. Matures {maturityPreview ? formatDMY(maturityPreview) : '—'}.
          </div>
          <div>
            <label style={lbl}>Amount Invested (₹)</label>
            <input style={inp} type="number" min="0" value={form.amount_invested} onChange={(e) => set('amount_invested', e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Interest Payout</label>
              <select style={inp} value={form.interest_payout} onChange={(e) => selectInterestPayout(e.target.value)}>
                {(scheme?.interest_payout_options?.length ? scheme.interest_payout_options : ['maturity']).map((key) => (
                  <option key={key} value={key}>{INTEREST_PAYOUT_LABELS[key] || key}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Return %</label>
              <input style={inp} type="number" step="0.01" min="0" value={form.total_return_pct} onChange={(e) => set('total_return_pct', e.target.value)} required />
            </div>
          </div>
          {(form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') && schedule.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...lbl, marginBottom: 0 }}>Payout Schedule (confirm or edit)</label>
                <button type="button" onClick={resetSchedule} style={{ fontSize: 11, fontWeight: 700, color: TEAL, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Reset to default</button>
              </div>
              <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                {schedule.map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 10px', borderTop: idx > 0 ? '1px solid #F0F3FA' : 'none' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: row.payout_type === 'maturity' ? '#7B1FA2' : '#0D9488', width: 58, flexShrink: 0 }}>
                      {row.payout_type === 'maturity' ? 'Principal' : form.interest_payout === 'monthly' ? `M${idx + 1}` : `Q${idx + 1}`}
                    </span>
                    <span style={{ fontSize: 12, color: '#1A1A2E', flex: 1 }}>{formatDMY(row.due_date)}</span>
                    <input
                      type="number" step="0.01" value={row.amount_due}
                      onChange={(e) => updateScheduleRow(idx, 'amount_due', e.target.value)}
                      style={{ ...inp, height: 32, flex: 1 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label style={lbl}>Security (for LOI — optional)</label>
            <input style={inp} value={form.security} onChange={(e) => set('security', e.target.value)} placeholder="NA" />
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <input style={inp} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid #EDF1F7', borderRadius: 10, padding: 12 }}>
            <label style={lbl}>Revised Investment Proposal Form (LOI)</label>
            <button type="button" onClick={doDownloadLoi} disabled={loiDownloading}
              style={{ width: '100%', padding: '9px 0', background: '#fff', color: PURPLE, border: `1.5px solid ${PURPLE}`, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: loiDownloading ? 'default' : 'pointer', opacity: loiDownloading ? 0.7 : 1 }}>
              {loiDownloading ? 'Generating…' : `📥 Download Revised LOI (R${nextRevisionNo})`}
            </button>
            {loiDone && <div style={{ fontSize: 11, color: '#2E7D32', marginTop: 6 }}>Revised LOI downloaded — get it signed and upload below.</div>}
            <div style={{ marginTop: 10 }}>
              <label style={lbl}>Upload Signed Revised LOI *</label>
              <input type="file" accept="image/*,.pdf" onChange={handleLoiFileChange} style={{ fontSize: 12 }} />
              {loiFile && <div style={{ fontSize: 11, color: '#2E7D32', marginTop: 4 }}>Selected: {loiFile.name}</div>}
            </div>
          </div>

          {error && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={busy || !loiFile} style={{ padding: '9px 20px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: (busy || !loiFile) ? 'default' : 'pointer', opacity: (busy || !loiFile) ? 0.5 : 1 }}>
            {busy ? 'Submitting…' : 'Submit Revision for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
}
