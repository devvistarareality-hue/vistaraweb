// Pratishtha flats are computed, not fixed: the sales team sets the Flat Rate and the
// Token and every other line follows. Shops have their own rules (see pratishthaShop).
//
//   Flat Rate           = Flat Price / Flat Area   (the price is what is entered)
//   Terrace Rate        = Flat Rate / 2
//   Add. Terrace Price  = Terrace Area x Terrace Rate
//   Box Price           = Flat Price + Terrace Price
//   Bank Loan           = Box Price - Token
//   Bank Processing     = Bank Loan x 4.5%
//   Dastavej Value      = (Box Price - Bank Processing) / 1.07   (Regular)
//                       = Box Price / 1.07                       (Down Payment)
//   Stamp Duty + Reg    = Dastavej Value x 6%   (Regular) / Box Price x 6% (DP)
//   GST                 = Dastavej Value x 1%   (Regular) / Box Price x 1% (DP)
//   Total (Regular)     = Bank Processing + Dastavej + Stamp Duty + GST = Box Price
//   Total (Down Payment)= Box Price + Legal & Other Charges + both maintenances
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
  // Regular backs the processing charge out of the box price first; Down Payment
  // divides the box price straight down, because its charges are added on top rather
  // than carved out.
  const dastavej_value  = Math.round(
    (isDownPayment ? box_price : box_price - bank_processing) / R.dastavejDivisor);
  // Regular taxes the agreement value; Down Payment taxes the box price, so its
  // Total Legal & Other Charges comes to Box Price x 7% plus the legal charge.
  const taxBase         = isDownPayment ? box_price : dastavej_value;
  const stamp_duty_reg  = Math.round(taxBase * R.stampDutyRegPct);
  const gst             = Math.round(taxBase * R.gstPct);
  // Regular is an all-inclusive box price: Processing + Dastavej + Stamp Duty + GST
  // works back out to exactly the Box Price, so that is the total. (Summing the four
  // rounded lines can land a rupee off, and the box price is the figure quoted.)
  //
  // Down Payment charges on top instead, and quotes four figures:
  //   Box Price + Total Legal & Other Charges + both maintenance amounts.
  const total_extra     = isDownPayment ? stamp_duty_reg + gst + legal : 0;
  // Everything charged on top of the unit price, as one figure.
  const total_legal_extra = isDownPayment ? total_extra + maint_adv_6m + maint_adv_12m : 0;
  const total           = isDownPayment ? box_price + total_legal_extra : box_price;

  return {
    ...pb, kind: 'flat', is_down_payment: isDownPayment,
    flat_area, terrace_area, flat_rate, terrace_rate,
    flat_price, terrace_price, box_price, token, bank_loan,
    bank_processing, maint_adv_6m, maint_adv_12m, legal,
    dastavej_value, stamp_duty_reg, gst, total_extra, total_legal_extra, total,
    // pbTotal()/pbTot() on the forms and the LOI read grand_total first.
    grand_total: total,
  };
}
