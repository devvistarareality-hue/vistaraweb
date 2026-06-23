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
  const isIndustrial = formulaSet === 'industrial';
  const isTundav     = isIndustrial && projectName === 'tundav';

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
  const devAgreement = devAgreementRate * area;
  const applyRegFee    = inp.applyRegFee    || 'Yes';
  const applyStampDuty = inp.applyStampDuty || 'Yes';
  const applyGst       = inp.applyGst       || 'Yes';

  // Plot Basic
  const plotBasic = area * landRate;

  // Plot Dev (Kalrav: Plot Area × Dev Rate; Ankhol: Const Area × Dev Rate; Industrial: none)
  let plotDev = 0;
  if (isAnkhol) plotDev = constArea * devRate;
  else if (!isIndustrial) plotDev = area * devRate;

  // Construction Amount (none for Industrial)
  const constAmt = isIndustrial ? 0 : (constArea * constRate);

  // Maintenance
  const maintBase = isAnkhol ? constArea : area;
  const maint = isIndustrial ? (area * maintRate) : (maintBase * maintRate * maintMonths);

  // Sale Deed / Stamp / Reg / GST per formula set
  let saleDeed = 0, stampDuty = 0, regFees = 0, gst = 0, maintDeposit = 0, maintAdvance = 0;
  if (isAnkhol) {
    saleDeed     = 0.60 * (plotBasic + constAmt + plotDev + premiumLocation - discount);
    stampDuty    = saleDeed * 0.049;
    regFees      = (saleDeed * 0.01) + 1500;
    gst          = saleDeed * 0.05;
    maintDeposit = maint; maintAdvance = maint;
  } else if (isIndustrial) {
    saleDeed     = saleDeedRate * area;
    stampDuty    = saleDeed * 0.049;
    regFees      = gender === 'Female' ? 1500 : (saleDeed * 0.01 + 1500);
    gst          = isTundav ? (saleDeed * 0.67 * 0.18) : (devAgreement * 0.18);
    maintDeposit = maint; maintAdvance = maint;
  } else { // kalrav
    stampDuty = lsd * 0.049;
    regFees   = gender === 'Female' ? 1500 : (lsd * 0.01 + 1500);
    gst       = constAgr * 0.18;
  }

  if (applyRegFee === 'No') regFees = 0;
  if (isAnkhol && applyStampDuty === 'No') stampDuty = 0;
  if (isAnkhol && applyGst === 'No') gst = 0;

  // Total Extra Charges
  let totalExtra;
  if (isAnkhol)          totalExtra = stampDuty + regFees + gst + maintDeposit + maintAdvance + legal + premiumLocation;
  else if (isIndustrial) totalExtra = stampDuty + regFees + gst + maintDeposit + maintAdvance + legal;
  else                   totalExtra = stampDuty + regFees + gst + maint + legal;

  // Final Amount
  const finalAmt = isIndustrial
    ? (plotBasic + totalExtra + extraWorkAmt - discount)
    : (plotBasic + plotDev + constAmt + totalExtra + extraWorkAmt - discount);

  return {
    formulaSet, isTundav, area, landRate, devRate, constArea, constRate, discount,
    lsd, constAgr, gender, plotBasic, plotDev, constAmt, saleDeed,
    saleDeedRate, devAgreementRate, devAgreement, stampDuty, regFees, gst,
    maint, maintRate, maintMonths, maintDeposit, maintAdvance, legal, premiumLocation,
    applyRegFee, applyStampDuty, applyGst, totalExtra, extraWorkAmt,
    extraWorkDesc: inp.extraWorkDesc || '', finalAmt,
  };
}

// Installment base (what the % installments are computed against) — varies per set.
export function installmentBase(v) {
  if (v.formulaSet === 'industrial') return v.plotBasic - v.discount;
  return v.plotBasic + v.plotDev + v.constAmt - v.discount;
}

export const rupee = (n) => '₹ ' + Math.round(num(n)).toLocaleString('en-IN');
