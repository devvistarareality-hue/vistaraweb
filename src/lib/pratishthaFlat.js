// Pratishtha flats are computed, not fixed: the sales team sets the Flat Rate and the
// Token and every other line follows. Shops have their own rules (see pratishthaShop).
//
//   Flat Rate           = Flat Price / Flat Area   (the price is what is entered)
//   Terrace Rate        = Flat Rate / 2
//   Add. Terrace Price  = Terrace Area x Terrace Rate
//   Box Price           = Flat Price + Terrace Price
//   Bank Loan           = Box Price - Token
//   Bank Processing     = Bank Loan x 4.5%
//   Dastavej Value      = (Box Price - Bank Processing) / 1.07
//   Stamp Duty + Reg    = Dastavej Value x 6%
//   GST                 = Dastavej Value x 1%
//   Total               = Bank Processing + Dastavej + Stamp Duty + GST
//
// The set is self-consistent: because 1.07 x Dastavej = Box - Processing and stamp+GST
// come to 7% of Dastavej, Total always works back out to exactly the Box Price. That
// is the all-inclusive figure the buyer is quoted, so it is what gets booked.
export const FLAT_RULES = {
  terraceRateDivisor: 2,
  bankProcessingPct: 0.045,
  dastavejDivisor: 1.07,
  stampDutyRegPct: 0.06,
  gstPct: 0.01,
  // Down Payment maintenance: Rs 1.5 per sq.ft per month. Areas are held in sq.yd,
  // hence the x9.
  maintPerSqFtMonth: 1.5,
  sqYdToSqFt: 9,
  maintAdvMonths: 6,
  maintDepMonths: 12,
  legalCharge: 10000,
};

// The flat rate a stored book implies, so the form opens on today's figures.
export function impliedFlatRate(pb) {
  const area = Number(pb?.flat_area) || 0;
  if (!area) return 0;
  return +((Number(pb?.flat_price) || 0) / area).toFixed(4);
}

export function computeFlat(pb, edit = {}) {
  const R = FLAT_RULES;
  const flat_area = Number(pb.flat_area) || 0;
  const terrace_area = Number(pb.terrace_area) || 0;
  // The Flat Price is the driver and the rate is derived from it: a price is what
  // actually gets negotiated, so entering one should not require back-calculating a
  // per-sq.yd rate by hand. Everything downstream still keys off the rate, including
  // the terrace at half of it.
  const flat_price = edit.flatPrice === '' || edit.flatPrice == null
    ? Math.round(Number(pb.flat_price) || 0)
    : Math.round(Number(edit.flatPrice) || 0);
  const flat_rate = flat_area ? flat_price / flat_area : 0;
  const token = edit.token === '' || edit.token == null
    ? (Number(pb.token) || 0) : (Number(edit.token) || 0);

  const terrace_rate    = flat_rate / R.terraceRateDivisor;
  const terrace_price   = Math.round(terrace_area * terrace_rate);
  const box_price       = flat_price + terrace_price;
  const bank_loan       = box_price - token;
  // A Down Payment plan carries no bank processing charge; maintenance is charged
  // instead, at Rs 1.5 per sq.ft per month over the flat plus its terrace (x9 converts
  // sq.yd to sq.ft). The two maintenance amounts take over the exact role bank
  // processing played -- deducted before the 1.07 divisor -- so Final Unit Price +
  // Stamp Duty + GST + the deductions still comes back to the Box Price.
  const isDownPayment   = edit.plan === 'Down Payment';
  const maintPerMonth   = R.maintPerSqFtMonth * R.sqYdToSqFt * (flat_area + terrace_area);
  const maint_adv_6m    = isDownPayment ? Math.round(maintPerMonth * R.maintAdvMonths) : 0;
  const maint_adv_12m   = isDownPayment ? Math.round(maintPerMonth * R.maintDepMonths) : 0;
  const legal           = isDownPayment ? R.legalCharge : 0;
  // Rounded at each step, not only at the end — that is what reproduces the
  // originally sanctioned figures to the rupee.
  const bank_processing = isDownPayment ? 0 : Math.round(bank_loan * R.bankProcessingPct);
  const deduction       = isDownPayment ? (maint_adv_6m + maint_adv_12m + legal) : bank_processing;
  const dastavej_value  = Math.round((box_price - deduction) / R.dastavejDivisor);
  const stamp_duty_reg  = Math.round(dastavej_value * R.stampDutyRegPct);
  const gst             = Math.round(dastavej_value * R.gstPct);
  // Total is Processing + Dastavej + Stamp Duty + GST, which in exact arithmetic is
  // precisely the Box Price. Summing the four *rounded* lines can land a rupee off
  // (dastavej rounding up carries through stamp duty and GST), so the box price is
  // taken as the total: it is the all-inclusive figure actually quoted and booked,
  // and it keeps the LOI's own Box Price and Total rows agreeing.
  const total           = box_price;

  return {
    ...pb, kind: 'flat', is_down_payment: isDownPayment,
    flat_area, terrace_area, flat_rate, terrace_rate,
    flat_price, terrace_price, box_price, token, bank_loan,
    bank_processing, maint_adv_6m, maint_adv_12m, legal,
    dastavej_value, stamp_duty_reg, gst, total,
  };
}
