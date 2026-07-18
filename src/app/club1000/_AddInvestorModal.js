'use client';
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';

const TEAL = '#00838F';

const inp = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #C6D0DB', fontSize: 13, boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };

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
  const lastDay = new Date(year, targetMonth, 0).getDate(); // day 0 of next month
  return new Date(year, targetMonth - 1, lastDay);
}

function computeQuarterlyDates(investmentDateStr, tenureMonths) {
  const quarters = Math.max(Math.floor((Number(tenureMonths) || 0) / 3), 1);
  let current = new Date(`${investmentDateStr}T00:00:00`);
  if (Number.isNaN(current.getTime())) return [];
  const dates = [];
  for (let i = 0; i < quarters; i++) {
    current = nextQuarterPayout(current);
    dates.push(toISODate(current));
  }
  return dates;
}

// Mirrors backend/club1000/services.py::default_monthly_dates — one instalment
// per calendar month-end, for the full tenure.
function nextMonthEnd(d) {
  const totalMonth = d.getMonth() + 1 + 1; // 1-indexed, +1 month ahead
  const year = d.getFullYear() + Math.floor((totalMonth - 1) / 12);
  const month = ((totalMonth - 1) % 12) + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, lastDay);
}

function computeMonthlyDates(investmentDateStr, tenureMonths) {
  let current = new Date(`${investmentDateStr}T00:00:00`);
  if (Number.isNaN(current.getTime())) return [];
  const dates = [];
  for (let i = 0; i < Math.max(Number(tenureMonths) || 0, 1); i++) {
    current = nextMonthEnd(current);
    dates.push(toISODate(current));
  }
  return dates;
}

// A native <input type="date"> always displays digits in the browser's own
// locale (Chrome defaults to MM/DD/YYYY) — that's browser chrome, not content,
// so formatDMY() can't touch it. This keeps the real date input (and its native
// picker) for editing, but hides its built-in text and overlays our own
// DD/MM/YYYY label on top — click/tap anywhere still opens the picker.
function DateFieldDMY({ value, onChange, style, wrapperStyle }) {
  return (
    <div style={{ position: 'relative', ...wrapperStyle }}>
      <input
        type="date"
        value={value}
        onChange={onChange}
        className="c1k-dmy-date"
        style={{ ...inp, width: '100%', ...style }}
      />
      <span style={{
        position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
        fontSize: 13, color: value ? '#1A1A2E' : '#9CA3AF', pointerEvents: 'none',
      }}>
        {value ? formatDMY(value) : 'dd/mm/yyyy'}
      </span>
    </div>
  );
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonthYear(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// Interest instalment due dates are always month-end by construction — showing
// the day is noise, so this collapses editing to month granularity and snaps
// back to the last day of whichever month is chosen.
function MonthYearField({ value, onChange, style, wrapperStyle }) {
  const monthValue = value ? value.slice(0, 7) : ''; // 'YYYY-MM'
  function handleChange(e) {
    const [y, m] = e.target.value.split('-').map(Number);
    if (!y || !m) return;
    const lastDay = new Date(y, m, 0).getDate();
    onChange(`${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  }
  return (
    <div style={{ position: 'relative', ...wrapperStyle }}>
      <input
        type="month"
        value={monthValue}
        onChange={handleChange}
        className="c1k-dmy-date"
        style={{ ...inp, width: '100%', ...style }}
      />
      <span style={{
        position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
        fontSize: 13, color: value ? '#1A1A2E' : '#9CA3AF', pointerEvents: 'none',
      }}>
        {value ? formatMonthYear(value) : 'mmm yyyy'}
      </span>
    </div>
  );
}

const INTEREST_PAYOUT_LABELS = { monthly: 'Monthly', quarterly: 'Quarterly', maturity: 'At Maturity' };

export default function AddInvestorModal({ schemes, onClose, onCreated }) {
  const [form, setForm] = useState({
    scheme: schemes[0]?.id || '', reference_name: '', reference_phone: '', name: '', phone: '', email: '', pan: '',
    amount_invested: '', investment_date: toISODate(new Date()), notes: '',
    interest_payout: schemes[0]?.interest_payout_options?.[0] || 'maturity',
    total_return_pct: schemes[0]?.total_return_pct ?? '',
  });
  const [documentFile, setDocumentFile] = useState(null); // {name, type, data(base64)}
  const [schedule, setSchedule] = useState([]); // [{due_date, amount_due, payout_type}] — editable preview
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refSuggestions, setRefSuggestions] = useState([]);
  const [refDropdownOpen, setRefDropdownOpen] = useState(false);

  const scheme = schemes.find((s) => String(s.id) === String(form.scheme));
  const maturityPreview = scheme ? computeMaturity(form.investment_date, scheme.tenure_months) : '';

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
    const interestTotal = (principal * totalReturn) / 100;
    const perInstalment = dates.length ? +(interestTotal / dates.length).toFixed(2) : 0;
    const rows = dates.map((due_date) => ({ due_date, amount_due: perInstalment, payout_type: 'interest' }));
    rows.push({ due_date: maturityPreview, amount_due: principal, payout_type: 'maturity' });
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
    setScheduleDirty(false);
    setForm((f) => ({
      ...f,
      scheme: id,
      interest_payout: s?.interest_payout_options?.[0] || 'maturity',
      total_return_pct: s?.total_return_pct ?? '',
    }));
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDocumentFile({ name: file.name, type: file.type, data: reader.result.split(',')[1] });
    reader.readAsDataURL(file);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (scheme && Number(form.amount_invested) < Number(scheme.min_ticket_size)) {
      setError(`Minimum ticket size for ${scheme.name} is ₹${Number(scheme.min_ticket_size).toLocaleString('en-IN')}.`);
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form };
      if (documentFile) payload.document_file = documentFile;
      if ((form.interest_payout === 'quarterly' || form.interest_payout === 'monthly') && schedule.length) payload.payout_schedule = schedule;
      const res = await apiFetch(CLUB1000_ENDPOINTS.investors, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.amount_invested?.[0] || data?.detail || 'Could not add investor.');
        return;
      }
      onCreated(data);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`
        .c1k-dmy-date { color: transparent; }
        .c1k-dmy-date::-webkit-calendar-picker-indicator { opacity: 1; }
      `}</style>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 18, boxShadow: '0 24px 80px rgba(24,35,80,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F0F3FA' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>Add Investor</div>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Scheme</label>
            <select style={inp} value={form.scheme} onChange={(e) => selectScheme(e.target.value)} required>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {scheme && (
              <div style={{ fontSize: 11, color: '#8492A6', marginTop: 5 }}>
                Min ticket ₹{Number(scheme.min_ticket_size).toLocaleString('en-IN')}
                {maturityPreview && <> · Matures {formatDMY(maturityPreview)}</>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Date of Investment</label>
              <DateFieldDMY value={form.investment_date} onChange={(e) => set('investment_date', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Date of Maturity</label>
              <input style={{ ...inp, backgroundColor: '#F8FAFC', color: '#8492A6' }} value={maturityPreview ? formatDMY(maturityPreview) : '—'} disabled />
            </div>
          </div>
          <div>
            <label style={lbl}>Amount Invested (₹)</label>
            <input style={inp} type="number" min="0" value={form.amount_invested} onChange={(e) => set('amount_invested', e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Interest Payout</label>
              <select style={inp} value={form.interest_payout} onChange={(e) => set('interest_payout', e.target.value)}>
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
                    {row.payout_type === 'maturity' ? (
                      <DateFieldDMY
                        value={row.due_date}
                        onChange={(e) => updateScheduleRow(idx, 'due_date', e.target.value)}
                        style={{ height: 32 }}
                        wrapperStyle={{ flex: 1 }}
                      />
                    ) : (
                      <MonthYearField
                        value={row.due_date}
                        onChange={(val) => updateScheduleRow(idx, 'due_date', val)}
                        style={{ height: 32 }}
                        wrapperStyle={{ flex: 1 }}
                      />
                    )}
                    <input
                      type="number"
                      step="0.01"
                      value={row.amount_due}
                      onChange={(e) => updateScheduleRow(idx, 'amount_due', e.target.value)}
                      style={{ ...inp, height: 32, flex: 1 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <label style={lbl}>Reference Name</label>
              <input
                style={inp}
                value={form.reference_name}
                onChange={(e) => { set('reference_name', e.target.value); setRefDropdownOpen(true); }}
                onFocus={() => setRefDropdownOpen(true)}
                onBlur={() => setTimeout(() => setRefDropdownOpen(false), 120)}
                autoComplete="off"
              />
              {refDropdownOpen && filteredRefSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4,
                  background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(24,35,80,0.14)', maxHeight: 160, overflowY: 'auto',
                }}>
                  {filteredRefSuggestions.map((r, i) => (
                    <div
                      key={`${r.reference_phone}-${i}`}
                      onMouseDown={() => selectReferenceSuggestion(r)}
                      style={{ padding: '8px 10px', fontSize: 13, cursor: 'pointer', borderTop: i > 0 ? '1px solid #F0F3FA' : 'none' }}
                    >
                      <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{r.reference_name}</span>
                      {r.reference_phone && <span style={{ color: '#8492A6' }}> — {r.reference_phone}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Reference Number</label>
              <input style={inp} value={form.reference_phone} onChange={(e) => set('reference_phone', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={lbl}>Investor Name</label>
            <input style={inp} value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Mobile Number</label>
              <input style={inp} value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={lbl}>PAN</label>
            <input style={inp} value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} />
          </div>
          <div>
            <label style={lbl}>Scan Document (KYC / ID proof)</label>
            <input type="file" accept="image/*,.pdf" onChange={handleFileChange} style={{ fontSize: 12 }} />
            {documentFile && <div style={{ fontSize: 11, color: '#2E7D32', marginTop: 4 }}>Selected: {documentFile.name}</div>}
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <input style={inp} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
          {error && <div style={{ fontSize: 12, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={busy} style={{ padding: '9px 20px', background: TEAL, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Saving…' : 'Add Investor'}
          </button>
        </div>
      </form>
    </div>
  );
}
