// Club 1000 interest working — what each interest instalment pays for and how it
// is worked out. Mirrors backend club1000/services.py (interest_periods,
// period_label, accrual_end): periods run back to back from the day after the
// investment, each ending the day before its payout month (the last one at
// maturity); interest = days × (principal × total return % ÷ the tenure's days).
// Quarterly instalments are named by the financial-year quarter they cover —
// Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar — monthly ones by the month.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86400000;
const d0 = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00`);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function accrualEnd(due, maturity) {
  if (due >= maturity) return maturity;
  return new Date(due.getFullYear(), due.getMonth(), 0);
}

export function periodLabel(fromIso, toIso, cadence) {
  const start = d0(fromIso);
  const end = d0(toIso);
  const m = end.getMonth() + 1;
  if (cadence === 'monthly') {
    const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    const part = start.getDate() !== 1 || start.getMonth() !== end.getMonth() || end.getDate() !== lastDay;
    return `${MONTHS[end.getMonth()]} ${end.getFullYear()}${part ? ' (part)' : ''}`;
  }
  const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 ? 3 : 4;
  const fy = m >= 4 ? end.getFullYear() : end.getFullYear() - 1;
  const firstMonth = { 1: 4, 2: 7, 3: 10, 4: 1 }[q];
  const qStart = new Date(q === 4 ? fy + 1 : fy, firstMonth - 1, 1);
  const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0);
  const part = start > qStart || end < qEnd;
  return `Q${q} FY${String(fy).slice(2)}-${String(fy + 1).slice(2)}${part ? ' (part)' : ''}`;
}

// The working for each interest row of a schedule ([{due_date, payout_type, …}]),
// by index: {label, from, to, days, perDay, computed}. Rows that are not interest,
// or whose period has no days, get null.
export function schedulePeriods(rows, investmentDate, maturityDate, principal, totalReturnPct, cadence) {
  if (!investmentDate || !maturityDate) return rows.map(() => null);
  const start = d0(investmentDate);
  const maturity = d0(maturityDate);
  const tenureDays = Math.round((maturity - start) / DAY);
  if (tenureDays <= 0) return rows.map(() => null);
  const perDay = ((Number(principal) || 0) * (Number(totalReturnPct) || 0)) / 100 / tenureDays;
  const order = rows.map((r, i) => [r, i]).filter(([r]) => r.payout_type === 'interest' && r.due_date)
    .sort((a, b) => String(a[0].due_date).localeCompare(String(b[0].due_date)));
  const out = rows.map(() => null);
  let prev = start;
  for (const [r, i] of order) {
    const end = accrualEnd(d0(r.due_date), maturity);
    const days = Math.round((end - prev) / DAY);
    if (days <= 0) continue;
    const from = iso(new Date(prev.getTime() + DAY));
    out[i] = { label: periodLabel(from, iso(end), cadence), from, to: iso(end), days, perDay, computed: +(perDay * days).toFixed(2) };
    prev = end;
  }
  return out;
}

export function perDayInterest(principal, totalReturnPct, investmentDate, maturityDate) {
  if (!investmentDate || !maturityDate) return 0;
  const days = Math.round((d0(maturityDate) - d0(investmentDate)) / DAY);
  return days > 0 ? ((Number(principal) || 0) * (Number(totalReturnPct) || 0)) / 100 / days : 0;
}

export function tenureDays(investmentDate, maturityDate) {
  if (!investmentDate || !maturityDate) return 0;
  return Math.round((d0(maturityDate) - d0(investmentDate)) / DAY);
}

// An "At Maturity" investment pays once: the whole term's interest and the principal,
// both on the maturity date. The same working as a schedule, for display only.
export function maturityWorking(principal, totalReturnPct, investmentDate, maturityDate) {
  if (!investmentDate || !maturityDate) return { rows: [], periods: [] };
  const days = tenureDays(investmentDate, maturityDate);
  if (days <= 0) return { rows: [], periods: [] };
  const perDay = perDayInterest(principal, totalReturnPct, investmentDate, maturityDate);
  const interest = +(perDay * days).toFixed(2);
  const from = iso(new Date(d0(investmentDate).getTime() + DAY));
  const to = String(maturityDate).slice(0, 10);
  return {
    rows: [
      { due_date: to, payout_type: 'interest', amount_due: interest.toFixed(2) },
      { due_date: to, payout_type: 'maturity', amount_due: (Number(principal) || 0).toFixed(2) },
    ],
    periods: [{ label: 'Interest for the full term', from, to, days, perDay, computed: interest }, null],
  };
}
