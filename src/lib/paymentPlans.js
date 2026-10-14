// Predefined payment plans (Project.payment_plans) — what prefills a new booking's
// schedule. Two plans per project: an LOI booked directly, and an EOI converted to an
// LOI. Each has Extra Work Amount and Unit Price installments ({pct, days, stage}) and
// one Legal & Other Charges line ({days, stage}); `days` counts from the booking date.
// Kept identical to Vistarafront/src/lib/paymentPlans.js — copy it across on every change.

export const PLAN_KEYS = [['direct', 'Direct LOI'], ['eoi', 'EOI → LOI']];

export const emptyPlan = () => ({ extra: [], unit: [], legal: { days: '', stage: '' } });

// 'YYYY-MM-DD' + n days → 'YYYY-MM-DD' (calendar arithmetic in UTC, so no time-zone drift).
export function addDays(ymd, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() + (parseInt(days, 10) || 0));
  return d.toISOString().slice(0, 10);
}

// Whether a plan has anything to prefill.
export function hasPlan(plan) {
  return !!plan && ((plan.extra || []).length > 0 || (plan.unit || []).length > 0
    || String(plan.legal?.days ?? '') !== '' || !!String(plan.legal?.stage || '').trim());
}

// The plan the booking form uses: EOI → LOI for a conversion, otherwise Direct LOI.
export function planFor(project, isEoiConversion) {
  const p = (project && project.payment_plans) || {};
  const plan = p[isEoiConversion ? 'eoi' : 'direct'];
  return hasPlan(plan) ? plan : null;
}

// Plan rows → booking-form rows. Amounts are left for the form to work out from the %
// (they depend on the price, which may not be filled yet); `days` stays on the row so a
// change of booking date moves the date, until the date is edited by hand.
export function planRows(rows, bookingDate) {
  return (rows || []).map((r) => ({
    date: addDays(bookingDate, r.days), pct: String(r.pct ?? ''), amt: '',
    stage: r.stage || '', days: parseInt(r.days, 10) || 0,
  }));
}

// Total % of a plan section, for the setup screen's check.
export const pctTotal = (rows) => (rows || []).reduce((a, r) => a + (parseFloat(r.pct) || 0), 0);
