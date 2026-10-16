// Booking pricing engine — faithful port of the GAS computeFormulas / getFormulaFieldFlags.
// Three formula sets: kalrav, ankhol, industrial (+ Tundav special case for GST).
// Keep this in sync with the GAS index.html so totals match rupee-for-rupee.

export function fieldFlags(formulaSet) {
  if (formulaSet === 'ankhol') return {
    areaUnit: 'sq.ft', bunglowTypeFixed: '5B2HK + SR', bunglowTypeIsDropdown: false,
    hasPremiumLocation: true, hasConstructionAgreement: false, hasLandSaleDeed: false,
    hasSaleDeed: true, hasSaleDeedRate: false, hasDevAgreement: false,
    hasConstructionFields: true, hasMaintDeposit: true, hasMaintAdvance: true, hasAreaSqMtr: false,
    hasPlcRate: false,
  };
  if (formulaSet === 'industrial') return {
    areaUnit: 'sq.ft', bunglowTypeFixed: null, bunglowTypeIsDropdown: false,
    hasPremiumLocation: false, hasConstructionAgreement: false, hasLandSaleDeed: false,
    hasSaleDeed: true, hasSaleDeedRate: true, hasDevAgreement: true,
    hasConstructionFields: false, hasMaintDeposit: true, hasMaintAdvance: true, hasAreaSqMtr: true,
    hasPlcRate: false,
  };
  return { // kalrav (default)
    areaUnit: 'sq.yd', bunglowTypeFixed: null, bunglowTypeIsDropdown: true,
    hasPremiumLocation: false, hasConstructionAgreement: true, hasLandSaleDeed: true,
    hasSaleDeed: false, hasSaleDeedRate: false, hasDevAgreement: false,
    hasConstructionFields: true, hasMaintDeposit: false, hasMaintAdvance: false, hasAreaSqMtr: false,
    // PLC (Premium Location Charge): a rate × Plot Area field, same shape as Dev Rate —
    // distinct from Ankhol's hasPremiumLocation above, which is a flat, manually-typed
    // amount rather than something computed from a rate. Switched OFF (30 Sep) at the
    // owner's request until they define how it should work; flip back to true to
    // restore the field, the price-book rate and the amount in the total.
    hasPlcRate: false,
    // PLC as it works now: a fixed amount per plot for a Corner plot and for a Club
    // House Facing one (either or both). Preset in the project's Rate Master
    // (plc_corner_price / plc_clubhouse_price), editable per booking, and part of the
    // Extra Work Amount — it raises the basic total, not the Unit Price.
    // Only for a Kalrav-set project: this default branch also answers for sets it
    // doesn't name (e.g. pratishtha), which must not get PLC.
    hasPlcFixed: !formulaSet || formulaSet === 'kalrav',
    // Kalrav rates beside the agreement amounts (LSD = rate × Plot Area, Construction
    // Agreement = rate × Construction Area), and a Development Agreement (rate × Plot
    // Area) that is part of the Unit Price; the LOI does not print it as its own line.
    // Kalrav-set projects only, as with PLC.
    hasLsdRate: !formulaSet || formulaSet === 'kalrav',
    hasConstAgreementRate: !formulaSet || formulaSet === 'kalrav',
    hasDevAgreementInfo: !formulaSet || formulaSet === 'kalrav',
  };
}

const num = (v) => parseFloat(v) || 0;

// PLC for the picked plots, from the project's Rate Master. A plot marked Corner is
// charged plc_corner_price, Common Plot Facing plc_clubhouse_price, and a plot that is
// both plc_both_price — one combined figure, not the two added up (falls back to the
// sum when no combined price is set). The combined charge is split across the two
// lines in proportion to the single prices (equal prices -> half each), so the
// breakdown still adds up to exactly the combined figure.
export function plcAmounts(plots = [], rm = {}) {
  const c = num(rm && rm.plc_corner_price);
  const k = num(rm && rm.plc_clubhouse_price);
  const both = num(rm && rm.plc_both_price) || c + k;
  let corner = 0, club = 0, cornerOn = false, clubOn = false;
  for (const p of plots) {
    if (p.is_corner && p.is_clubhouse_facing) {
      const share = c + k ? Math.round(both * c / (c + k)) : Math.round(both / 2);
      corner += share; club += both - share;
      cornerOn = clubOn = true;
    } else if (p.is_corner) { corner += c; cornerOn = true; }
    else if (p.is_clubhouse_facing) { club += k; clubOn = true; }
  }
  return { corner, club, cornerOn, clubOn };
}

export function computeFormulas(inp = {}) {
  const formulaSet   = inp.formulaSet || 'kalrav';
  const projectName  = (inp.projectName || '').toString().trim().toLowerCase();
  const isAnkhol     = formulaSet === 'ankhol';
  const isKalrav     = formulaSet === 'kalrav';
  const isIndustrial = formulaSet === 'industrial';
  // Variant comes from the project record, not its name: this branch changes GST,
  // so a rename must never silently reprice a booking. Falls back to the old name
  // test only when the caller hasn't supplied the field (older cached project).
  const loiVariant   = (inp.loiVariant || '').toString().trim().toLowerCase();
  const isTundav     = isIndustrial && (loiVariant ? loiVariant === 'tundav' : projectName === 'tundav');
  // Kalrav 3 special case: Stamp Duty, Registration Fee, and GST are computed off the
  // Unit Price (Land Sale Deed + Development + Construction Agreement) instead of LSD/Const Agreement
  // separately, and GST is a flat 5% instead of 18%. Other Kalrav-set projects unaffected.
  const isKalrav3    = isKalrav && (loiVariant ? loiVariant === 'kalrav3' : projectName === 'kalrav 3');

  const area       = num(inp.area);
  const landRate   = num(inp.landRate);
  const devRate    = num(inp.devRate);
  const constArea  = num(inp.constArea);
  const constRate  = num(inp.constRate);
  const discount   = num(inp.discount);
  const legal      = num(inp.legalCharges);
  const maintRate  = num(inp.maintRate);
  // Industrial and Kalrav: the Advance's own rate (maintRate is then the Deposit's).
  const maintAdvanceRate = num(inp.maintAdvanceRate);
  const maintMonths = num(inp.maintMonths);
  // Industrial and Kalrav: the Advance's own months (maintMonths is then the Deposit's).
  const maintAdvanceMonths = num(inp.maintAdvanceMonths);
  const extraWorkAmt = num(inp.extraWorkAmt);
  const gender     = inp.gender || '';
  const lsd        = num(inp.landSaleDeed);
  const constAgr   = num(inp.constAgreement);
  const plcRate    = num(inp.plcRate);
  // Kalrav: PLC Amount is computed here (Plot Area × plc_rate), same shape as Plot
  // Development Amount. Other sets keep premiumLocation as whatever flat amount the
  // caller passed in (Ankhol's own manually-typed field) — plcRate is unused there.
  // Kalrav PLC: the Corner / Common Plot Facing amounts the booking applies (the form
  // passes 0 for an unticked one).
  const plcCorner    = isKalrav && fieldFlags(formulaSet).hasPlcFixed ? num(inp.plcCorner) : 0;
  const plcClubhouse = isKalrav && fieldFlags(formulaSet).hasPlcFixed ? num(inp.plcClubhouse) : 0;
  const premiumLocation = isKalrav
    ? (fieldFlags(formulaSet).hasPlcRate ? area * plcRate : 0) + plcCorner + plcClubhouse
    : num(inp.premiumLocation);
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
    // Industrial Unit Price = Sale Deed value (SD Rate × Area) + Dev Agreement (Dev
    // Agreement Rate × Area), and the Sale Deed % follows from it: Unit Price ÷ Plot
    // Basic, i.e. (SD Rate + Dev Rate) ÷ Land Rate (owner, 16 Oct 2026 — it was a typed
    // %, 60 by default). Tax is UNCHANGED — still on the Sale Deed value & Dev Agreement.
    const saleDeedTax = saleDeedRate * area;
    saleDeed     = saleDeedTax + devAgreement;
    stampDuty    = saleDeedTax * 0.049;
    regFees      = gender === 'Female' ? pageFee : (saleDeedTax * 0.01 + pageFee);
    gst          = isTundav ? (saleDeedTax * 0.67 * 0.18) : (devAgreement * 0.18);
    // Deposit and Advance each with their own rate and months (owner, 16 Oct 2026),
    // as Kalrav: Plot Area × Rate × Months. It was one rate × area, charged twice.
    maintDeposit = area * maintRate * maintMonths;
    maintAdvance = area * maintAdvanceRate * maintAdvanceMonths;
  } else { // kalrav
    // Kalrav Unit Price = Land Sale Deed + Development Agreement + Construction
    // Agreement (owner, 14 Oct 2026). The Sale Deed % is derived from this.
    const kalDev = fieldFlags(formulaSet).hasDevAgreementInfo ? Math.round(devAgreement) : 0;
    saleDeed  = lsd + kalDev + constAgr;
    if (isKalrav3) {
      // Kalrav 3: Stamp Duty, Registration Fee, and GST are all based on Unit Price.
      stampDuty = saleDeed * 0.049;
      regFees   = gender === 'Female' ? pageFee : (saleDeed * 0.01 + pageFee);
      gst       = saleDeed * 0.05;
    } else {
      // All other Kalrav-set projects: tax is UNCHANGED — still on the Land Sale Deed
      // & Construction Agreement respectively.
      stampDuty = lsd * 0.049;
      regFees   = gender === 'Female' ? pageFee : (lsd * 0.01 + pageFee);
      // GST 18% on the Construction Agreement and, since 14 Oct 2026, the Development
      // Agreement too (it joined the Unit Price that day).
      gst       = (constAgr + kalDev) * 0.18;
    }
    // Every Kalrav project (owner, 16 Oct 2026): a Deposit and an Advance, each with its
    // own rate and months — Plot Area × Rate × Months. It was one rate × months, which
    // Kalrav 3 then split half-and-half.
    // (This branch also answers for sets it doesn't name, e.g. pratishtha — they keep
    // their single Maintenance line.)
    if (isKalrav) {
      maintDeposit = area * maintRate * maintMonths;
      maintAdvance = area * maintAdvanceRate * maintAdvanceMonths;
    }
  }

  // Maintenance Amount = Deposit + Advance where both exist (Ankhol/Industrial/Kalrav);
  // otherwise the standalone unit value.
  const maint = (isAnkhol || isIndustrial || isKalrav) ? (maintDeposit + maintAdvance) : maintUnit;

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
  // Ankhol's basic total includes premium location; Kalrav uses plot+dev+const+PLC
  // (PLC Amount folds in exactly like Plot Development Amount does); Industrial
  // splits Plot Basic.
  const hasSaleDeedSplit = isAnkhol || isKalrav || isIndustrial;
  const saleDeedBase = isAnkhol ? (plotBasic + constAmt + plotDev + premiumLocation)
    : isKalrav ? (plotBasic + plotDev + constAmt + premiumLocation)
    : isIndustrial ? plotBasic : 0;
  const nonSaleDeed = hasSaleDeedSplit ? (saleDeedBase - saleDeed) : 0;
  const nonSaleDeedDoc = hasSaleDeedSplit ? nonSaleDeed / 100 : 0;
  const docTotal = hasSaleDeedSplit ? saleDeed + nonSaleDeedDoc : 0;
  // Kalrav's and Industrial's Unit Price is built from its parts, so their % is derived.
  const effSaleDeedPct = (isKalrav || isIndustrial) ? (saleDeedBase > 0 ? (saleDeed / saleDeedBase * 100) : 0) : saleDeedPct;

  // Final Amount
  const finalAmt = isIndustrial
    ? (plotBasic + totalExtra + extraWorkAmt - discount)
    : isAnkhol
    ? (saleDeed + nonSaleDeed - discount + totalExtra + extraWorkAmt)
    : (plotBasic + plotDev + constAmt + premiumLocation + totalExtra + extraWorkAmt - discount);

  return {
    formulaSet, isTundav, isKalrav3, area, landRate, devRate, constArea, constRate, discount,
    plcRate, lsd, constAgr, gender, plotBasic, plotDev, constAmt, saleDeed,
    saleDeedRate, saleDeedPct: effSaleDeedPct, devAgreementRate, devAgreement, stampDuty, regFees, gst,
    maint, maintRate, maintAdvanceRate, maintMonths, maintAdvanceMonths, maintDeposit, maintAdvance, legal, premiumLocation, plcCorner, plcClubhouse,
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
