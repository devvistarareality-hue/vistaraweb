// Pratishtha flats are computed, not fixed: the sales team sets the Flat Rate and the
// Token and every other line follows. Shops have their own rules (see pratishthaShop).
//
//   Flat Price          = Flat Area x Flat Rate
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
  const flat_rate = edit.rate === '' || edit.rate == null
    ? impliedFlatRate(pb) : (Number(edit.rate) || 0);
  const token = edit.token === '' || edit.token == null
    ? (Number(pb.token) || 0) : (Number(edit.token) || 0);

  const flat_price      = Math.round(flat_area * flat_rate);
  const terrace_rate    = flat_rate / R.terraceRateDivisor;
  const terrace_price   = Math.round(terrace_area * terrace_rate);
  const box_price       = flat_price + terrace_price;
  const bank_loan       = box_price - token;
  // Rounded at each step, not only at the end — that is what reproduces the
  // originally sanctioned figures to the rupee.
  const bank_processing = Math.round(bank_loan * R.bankProcessingPct);
  const dastavej_value  = Math.round((box_price - bank_processing) / R.dastavejDivisor);
  const stamp_duty_reg  = Math.round(dastavej_value * R.stampDutyRegPct);
  const gst             = Math.round(dastavej_value * R.gstPct);
  // Total is Processing + Dastavej + Stamp Duty + GST, which in exact arithmetic is
  // precisely the Box Price. Summing the four *rounded* lines can land a rupee off
  // (dastavej rounding up carries through stamp duty and GST), so the box price is
  // taken as the total: it is the all-inclusive figure actually quoted and booked,
  // and it keeps the LOI's own Box Price and Total rows agreeing.
  const total           = box_price;

  return {
    ...pb, kind: 'flat',
    flat_area, terrace_area, flat_rate, terrace_rate,
    flat_price, terrace_price, box_price, token, bank_loan,
    bank_processing, dastavej_value, stamp_duty_reg, gst, total,
  };
}
