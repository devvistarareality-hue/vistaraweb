// Pratishtha ground-floor shops are computed, not fixed: the sales team sets the Rate
// and the Total Unit Price (either a % of the shop amount or an exact figure) and every
// other line follows. Flats stay on their fixed price book.
//
//   Amount            = Sq.ft x Rate
//   Total Unit Price  = % of Amount, or an entered amount
//   Stamp Duty & Reg  = 6% of Total Unit Price
//   GST               = 5% of Total Unit Price
//   AUDA              = Rs 400 per sq.ft
//   Maint. advance    = Rs 1.5 per sq.ft per month x 6
//   Maint. deposit    = Rs 1.5 per sq.ft per month x 12
//   Legal             = Rs 10,000 flat
//   Grand Total       = Amount + Total Extra
export const SHOP_RULES = {
  sdRegPct: 0.06,
  gstPct: 0.05,
  audaPerSqft: 400,
  maintPerSqftMonth: 1.5,
  maintAdvMonths: 6,
  maintDepMonths: 12,
  legal: 10000,
};

// The unit-price % a stored book implies, so the form opens on today's figures.
export function impliedUnitPct(pb) {
  const amt = Number(pb?.amount) || 0;
  if (!amt) return 50;
  return +((Number(pb?.loan_amount) || 0) / amt * 100).toFixed(4);
}

export function computeShop(pb, edit = {}) {
  const R = SHOP_RULES;
  const sq = Number(pb.sq_feet) || 0;
  const rate = edit.rate === '' || edit.rate == null ? (Number(pb.rate) || 0) : (Number(edit.rate) || 0);
  const amount = Math.round(sq * rate);
  // 'amount' mode takes the figure verbatim; otherwise it's a percentage of the amount.
  const unit = edit.mode === 'amount'
    ? Math.round(Number(edit.unitAmount) || 0)
    : Math.round(amount * ((edit.unitPct === '' || edit.unitPct == null ? impliedUnitPct(pb) : Number(edit.unitPct) || 0)) / 100);

  const stamp_duty_reg = Math.round(unit * R.sdRegPct);
  const gst            = Math.round(unit * R.gstPct);
  const auda           = Math.round(sq * R.audaPerSqft);
  const maint_adv_6m   = Math.round(sq * R.maintPerSqftMonth * R.maintAdvMonths);
  const maint_dep_12m  = Math.round(sq * R.maintPerSqftMonth * R.maintDepMonths);
  const legal          = R.legal;
  const total_extra    = stamp_duty_reg + gst + auda + maint_adv_6m + maint_dep_12m + legal;

  return {
    ...pb, kind: 'shop', sq_feet: sq, rate, amount,
    // loan_amount is the stored key behind the "Final Unit Price" row.
    loan_amount: unit,
    stamp_duty_reg, gst, auda, maint_adv_6m, maint_dep_12m, legal,
    total_extra, grand_total: amount + total_extra,
  };
}
