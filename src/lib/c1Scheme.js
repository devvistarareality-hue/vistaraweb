// A scheme as the pickers show it: its return per annum and its lock-in —
// "BUY-BACK · 20% p.a. · locked in 24 months". Schemes store the TOTAL return by
// maturity per payout option, so the yearly figure is that ÷ the tenure in years.
const trim = (n) => String(Math.round(n * 100) / 100);

export function schemePerAnnum(s) {
  const months = Number(s?.tenure_months) || 0;
  const rates = Object.values(s?.payout_rates || {}).map(Number).filter((n) => n > 0);
  if (!months || !rates.length) return '';
  const pa = rates.map((r) => (r * 12) / months);
  const lo = Math.min(...pa), hi = Math.max(...pa);
  return lo === hi ? `${trim(lo)}% p.a.` : `${trim(lo)}–${trim(hi)}% p.a.`;
}

export function schemeLockIn(s) {
  if (!s) return '';
  if (!s.premature_redemption_allowed) return `locked in ${s.tenure_months} months`;
  const m = Number(s.premature_redemption_lock_months) || 0;
  return m > 0 ? `lock-in ${m} months` : 'no lock-in';
}

export function schemeLabel(s) {
  return [s?.name, schemePerAnnum(s), schemeLockIn(s)].filter(Boolean).join(' · ');
}
