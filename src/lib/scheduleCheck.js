// A booking's payment schedule must add up to its deal. Same rule the server
// enforces on submit (sales/views.py _schedule_gap): every sale-deed and Extra Work
// (NSD) installment, the "Extra" row (Legal & Other Charges incl. stamp duty and
// registration) and any extra-work installments, against the final amount, within
// Rs 10 of rounding. EOIs (token only) and schedules with no amounts are not checked.
export const SCHEDULE_TOLERANCE = 10;

export function scheduleGap(p) {
  if (!p || p.eoi || String(p.plot_numbers || '').toUpperCase().startsWith('EOI')) return null;
  const amt = (x) => Number((x && x.amt) || 0) || 0;
  const inst = Array.isArray(p.installments) ? p.installments : [];
  const isExtraRow = (i) => String((i && i.no) ?? '').trim().toLowerCase() === 'extra';
  // Only a schedule whose unit / Extra Work installments carry amounts is checked.
  if (!inst.some((i) => !isExtraRow(i) && amt(i) > 0)) return null;
  const ew = Array.isArray(p.extra_work_inst) ? p.extra_work_inst : [];
  let total = inst.reduce((t, i) => t + amt(i), 0) + ew.reduce((t, i) => t + amt(i), 0);
  if (!inst.some(isExtraRow)) total += Number(p.total_extra || 0) || 0;
  return Math.round(total - (Number(p.final_amount || 0) || 0));
}

// Installment dates whose year can't be real ("0026-01-26" for 2026) — AR would
// read the unit as two thousand years overdue.
export const MIN_INST_YEAR = 2015;
export const MAX_INST_YEAR = 2100;

export function badInstallmentDates(p) {
  const bad = [];
  ['installments', 'extra_work_inst'].forEach((key) => {
    (Array.isArray(p?.[key]) ? p[key] : []).forEach((i) => {
      const d = String((i && i.date) || '');
      const y = Number(d.slice(0, 4));
      if (d.length >= 4 && /^\d{4}$/.test(d.slice(0, 4)) && (y < MIN_INST_YEAR || y > MAX_INST_YEAR)) {
        bad.push(`#${(i && i.no) ?? '?'} is ${d}`);
      }
    });
  });
  return bad;
}

export function scheduleError(p) {
  const bad = badInstallmentDates(p);
  if (bad.length) {
    return `Check the installment date${bad.length === 1 ? '' : 's'}: ${bad.slice(0, 5).join(', ')}. `
      + `The year must be between ${MIN_INST_YEAR} and ${MAX_INST_YEAR}.`;
  }
  const gap = scheduleGap(p);
  if (gap === null || Math.abs(gap) <= SCHEDULE_TOLERANCE) return '';
  return `The payment schedule is ₹${Math.abs(gap).toLocaleString('en-IN')} ${gap < 0 ? 'short of' : 'more than'} the total deal. `
    + 'Adjust the installments so they add up to the deal amount exactly.';
}
