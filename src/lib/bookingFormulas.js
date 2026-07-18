// Booking pricing engine — faithful port of the GAS computeFormulas / getFormulaFieldFlags.
// Three formula sets: kalrav, ankhol, industrial (+ Tundav special case for GST).
// Keep this in sync with the GAS index.html so totals match rupee-for-rupee.

export function fieldFlags(formulaSet) {
  if (formulaSet === 'ankhol') return {
    areaUnit: 'sq.ft', bunglowTypeFixed: '5B2HK + SR', bunglowTypeIsDropdown: false,
    hasPremiumLocation: true, hasConstructionAgreement: false, hasLandSaleDeed: false,
    hasSaleDeed: true, hasSaleDeedRate: false, hasDevAgreement: false,
    hasConstructionFields: true, hasMaintDeposit: true, hasMaintAdvance: true, hasAreaSqMtr: false,
  };
  if (formulaSet === 'industrial') return {
    areaUnit: 'sq.ft', bunglowTypeFixed: null, bunglowTypeIsDropdown: false,
    hasPremiumLocation: false, hasConstructionAgreement: false, hasLandSaleDeed: false,
    hasSaleDeed: true, hasSaleDeedRate: true, hasDevAgreement: true,
    hasConstructionFields: false, hasMaintDeposit: true, hasMaintAdvance: true, hasAreaSqMtr: true,
  };
  return { // kalrav (default)
    areaUnit: 'sq.yd', bunglowTypeFixed: null, bunglowTypeIsDropdown: true,
    hasPremiumLocation: false, hasConstructionAgreement: true, hasLandSaleDeed: true,
    hasSaleDeed: false, hasSaleDeedRate: false, hasDevAgreement: false,
    hasConstructionFields: true, hasMaintDeposit: false, hasMaintAdvance: false, hasAreaSqMtr: false,
  };
}

const num = (v) => parseFloat(v) || 0;

export function computeFormulas(inp = {}) {
  const formulaSet   = inp.formulaSet || 'kalrav';
  const projectName  = (inp.projectName || '').toString().trim().toLowerCase();
  const isAnkhol     = formulaSet === 'ankhol';
  const isKalrav     = formulaSet === 'kalrav';
  const isIndustrial = formulaSet === 'industrial';
  const isTundav     = isIndustrial && projectName === 'tundav';
  // Kalrav 3 special case: Stamp Duty, Registration Fee, and GST are computed off the
  // Unit Price (Land Sale Deed + Construction Agreement) instead of LSD/Const Agreement
  // separately, and GST is a flat 5% instead of 18%. Other Kalrav-set projects unaffected.
  const isKalrav3    = isKalrav && projectName === 'kalrav 3';

  const area       = num(inp.area);
  const landRate   = num(inp.landRate);
  const devRate    = num(inp.devRate);
  const constArea  = num(inp.constArea);
  const constRate  = num(inp.constRate);
  const discount   = num(inp.discount);
  const legal      = num(inp.legalCharges);
  const maintRate  = num(inp.maintRate);
  const maintMonths = num(inp.maintMonths);
  const extraWorkAmt = num(inp.extraWorkAmt);
  const gender     = inp.gender || '';
  const lsd        = num(inp.landSaleDeed);
  const constAgr   = num(inp.constAgreement);
  const premiumLocation = num(inp.premiumLocation);
  const saleDeedRate    = num(inp.saleDeedRate);
  const devAgreementRate = num(inp.devAgreementRate);
  // Ankhol sale-deed percentage — editable per booking, defaults to 60%.
  const saleDeedPct = (inp.saleDeedPct === '' || inp.saleDeedPct == null) ? 60 : num(inp.saleDeedPct);
  // Exact Unit Price override (Ankhol): when the user types a Unit Price directly, use
  // it verbatim instead of re-deriving from the 2-decimal %, so 90,00,000 stays exact.
  const saleDeedAmount = num(inp.saleDeedAmount);
  const devAgreement = devAgreementRate * area;
  const applyRegFee    = inp.applyRegFee    || 'Yes';
  const applyStampDuty = inp.applyStampDuty || 'Yes';
  const applyGst       = inp.applyGst       || 'Yes';
  // ₹1,500 fixed page fee inside the registration fee — can be toggled off.
  const applyPageFee   = inp.applyPageFee   || 'Yes';
  const pageFee        = applyPageFee === 'No' ? 0 : 1500;

  // Plot Basic
  const plotBasic = area * landRate;

  // Plot Dev (Kalrav: Plot Area × Dev Rate; Ankhol: Const Area × Dev Rate; Industrial: none)
  let plotDev = 0;
  if (isAnkhol) plotDev = constArea * devRate;
  else if (!isIndustrial) plotDev = area * devRate;

  // Construction Amount (none for Industrial)
  const constAmt = isIndustrial ? 0 : (constArea * constRate);

  // Maintenance — Ankhol/Industrial: Deposit and Advance are each the base unit amount and
  // the displayed Maintenance Amount is their sum. Kalrav 3: Deposit and Advance are each
  // half of the Maintenance Amount (a breakdown that leaves the total unchanged).
  const maintBase = isAnkhol ? constArea : area;
  const maintUnit = isIndustrial ? (area * maintRate) : (maintBase * maintRate * maintMonths);

  // Sale Deed / Stamp / Reg / GST per formula set
  let saleDeed = 0, stampDuty = 0, regFees = 0, gst = 0, maintDeposit = 0, maintAdvance = 0;
  if (isAnkhol) {
    saleDeed     = saleDeedAmount > 0 ? saleDeedAmount : (saleDeedPct / 100) * (plotBasic + constAmt + plotDev + premiumLocation);
    stampDuty    = saleDeed * 0.049;
    regFees      = (saleDeed * 0.01) + pageFee;
    gst          = saleDeed * 0.05;
    maintDeposit = maintUnit; maintAdvance = maintUnit;
  } else if (isIndustrial) {
    // Industrial now uses the sale-deed % split: Unit Price = % of Plot Basic.
    // Tax is UNCHANGED — still on the Sale Deed value (SD Rate × Area) & Dev Agreement.
    const saleDeedTax = saleDeedRate * area;
    saleDeed     = saleDeedAmount > 0 ? saleDeedAmount : (saleDeedPct / 100) * plotBasic;
    stampDuty    = saleDeedTax * 0.049;
    regFees      = gender === 'Female' ? pageFee : (saleDeedTax * 0.01 + pageFee);
    gst          = isTundav ? (saleDeedTax * 0.67 * 0.18) : (devAgreement * 0.18);
    maintDeposit = maintUnit; maintAdvance = maintUnit;
  } else { // kalrav
    // Kalrav Unit Price = Land Sale Deed + Construction Agreement (entered directly).
    // The Sale Deed % is derived from this (read-only in the form).
    saleDeed  = lsd + constAgr;
    if (isKalrav3) {
      // Kalrav 3: Stamp Duty, Registration Fee, and GST are all based on Unit Price.
      stampDuty = saleDeed * 0.049;
      regFees   = gender === 'Female' ? pageFee : (saleDeed * 0.01 + pageFee);
      gst       = saleDeed * 0.05;
      // Kalrav 3 splits the Maintenance Amount into a Deposit and an Advance, each half of
      // the amount. This is only a breakdown — the total maintenance (maint) is unchanged.
      maintDeposit = maintUnit / 2; maintAdvance = maintUnit / 2;
    } else {
      // All other Kalrav-set projects: tax is UNCHANGED — still on the Land Sale Deed
      // & Construction Agreement respectively.
      stampDuty = lsd * 0.049;
      regFees   = gender === 'Female' ? pageFee : (lsd * 0.01 + pageFee);
      gst       = constAgr * 0.18;
    }
  }

  // Maintenance Amount = Deposit + Advance where both exist (Ankhol/Industrial);
  // otherwise the standalone unit value (Kalrav has no Deposit/Advance fields).
  const maint = (isAnkhol || isIndustrial) ? (maintDeposit + maintAdvance) : maintUnit;

  if (applyRegFee === 'No') regFees = pageFee; // 1% removed but page fee stays independent
  // All three sets can toggle stamp duty / GST off.
  if (applyStampDuty === 'No') stampDuty = 0;
  if (applyGst === 'No') gst = 0;

  // Total Extra Charges
  let totalExtra;
  if (isAnkhol)          totalExtra = stampDuty + regFees + gst + maintDeposit + maintAdvance + legal;
  else if (isIndustrial) totalExtra = stampDuty + regFees + gst + maintDeposit + maintAdvance + legal;
  else                   totalExtra = stampDuty + regFees + gst + maint + legal;

  // Non-sale deed portion (all sets): the remaining % shown at ÷100 in the LOI.
  // Ankhol's basic total includes premium location; Kalrav uses plot+dev+const;
  // Industrial splits Plot Basic.
  const hasSaleDeedSplit = isAnkhol || isKalrav || isIndustrial;
  const saleDeedBase = isAnkhol ? (plotBasic + constAmt + plotDev + premiumLocation)
    : isKalrav ? (plotBasic + plotDev + constAmt)
    : isIndustrial ? plotBasic : 0;
  const nonSaleDeed = hasSaleDeedSplit ? (saleDeedBase - saleDeed) : 0;
  const nonSaleDeedDoc = hasSaleDeedSplit ? nonSaleDeed / 100 : 0;
  const docTotal = hasSaleDeedSplit ? saleDeed + nonSaleDeedDoc : 0;
  // Kalrav's Unit Price is entered (LSD + Const Agreement), so its % is derived for display.
  const effSaleDeedPct = isKalrav ? (saleDeedBase > 0 ? (saleDeed / saleDeedBase * 100) : 0) : saleDeedPct;

  // Final Amount
  const finalAmt = isIndustrial
    ? (plotBasic + totalExtra + extraWorkAmt - discount)
    : isAnkhol
    ? (saleDeed + nonSaleDeed - discount + totalExtra + extraWorkAmt)
    : (plotBasic + plotDev + constAmt + totalExtra + extraWorkAmt - discount);

  return {
    formulaSet, isTundav, isKalrav3, area, landRate, devRate, constArea, constRate, discount,
    lsd, constAgr, gender, plotBasic, plotDev, constAmt, saleDeed,
    saleDeedRate, saleDeedPct: effSaleDeedPct, devAgreementRate, devAgreement, stampDuty, regFees, gst,
    maint, maintRate, maintMonths, maintDeposit, maintAdvance, legal, premiumLocation,
    applyRegFee, applyStampDuty, applyGst, applyPageFee, totalExtra, extraWorkAmt,
    nonSaleDeed, nonSaleDeedDoc, docTotal,
    extraWorkDesc: inp.extraWorkDesc || '', finalAmt,
  };
}

// Installment base (what the % installments are computed against) — varies per set.
export function installmentBase(v) {
  // All sets: unit-price installments run on the sale-deed (Unit Price) portion.
  return v.saleDeed;
}

export const rupee = (n) => '₹ ' + Math.round(num(n)).toLocaleString('en-IN');
