// LOI / EOI PDF generator — faithful port of the GAS buildPDF (jsPDF).
// Loads jsPDF from the same CDN/version the GAS app uses (no npm dependency),
// so the document matches the existing LOI.

const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

export function ensureJsPDF() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'));
    if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf.jsPDF);
    const existing = document.querySelector(`script[src="${JSPDF_CDN}"]`);
    if (existing) { existing.addEventListener('load', () => resolve(window.jspdf.jsPDF)); return; }
    const s = document.createElement('script');
    s.src = JSPDF_CDN;
    s.onload = () => resolve(window.jspdf.jsPDF);
    s.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(s);
  });
}

// meta: { clientName, phoneNumber, gender, address, project, plotNo, bookingDate, villaType, bunglowType, cpName, loggedInUser }
// v: computeFormulas() output. installments: [{no,date,pct,amt,isExtra}]
// opts: { formulaSet, projectName, isRevision, revNo, extraTerms[], extraWorkInst[] }
export function buildLOIPdf(jsPDF, meta, v, installments, opts = {}) {
  const formulaSet = opts.formulaSet || 'kalrav';
  const projNamePdf = (opts.projectName || meta.project || '').toString();
  const isRevision = !!opts.isRevision;
  const revNo = opts.revNo || 0;
  const extraTerms = opts.extraTerms || [];
  const extraWorkInst = opts.extraWorkInst || [];

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297;
  const isLOI = true;
  const isEOI = meta.plotNo && meta.plotNo.toString().trim().toUpperCase().indexOf('EOI') === 0;
  const isAnkholPdf = formulaSet === 'ankhol';
  const isIndustrialPdf = formulaSet === 'industrial';
  const isTundavPdf = isIndustrialPdf && projNamePdf.trim().toLowerCase() === 'tundav';
  // Honour the booking form's unit toggle; fall back to the formula default.
  const chosenUnit = opts.areaUnit || meta.areaUnit || '';
  let areaUnit;
  if (chosenUnit === 'sq.m') areaUnit = 'sq.mtr';
  else if (chosenUnit) areaUnit = chosenUnit + '.';        // 'sq.yd' -> 'sq.yd.'
  else if (isAnkholPdf || isIndustrialPdf) areaUnit = 'sq.ft.';
  else areaUnit = 'sq.yd.';

  const P = [13, 47, 97], P2 = [26, 115, 232], P3 = [232, 240, 254];
  const G = [196, 149, 60], G2 = [252, 245, 225];
  const DK = [30, 41, 59], MD = [71, 85, 105], LT = [148, 163, 184], LN = [226, 232, 240];
  // Minimalist matte-blue / white palette + a small orange accent.
  const MB = [46, 74, 120], MB2 = [92, 124, 172], WASH = [237, 242, 249], WHT = [255, 255, 255], ORG = [255, 107, 43];
  const M = 15, CW = PW - 2 * M;
  let y = 0, pageNum = 1, rowAlt = false;
  const RS_COL = PW - M - 28, NUM_COL = PW - M - 3;

  const sf = (a) => doc.setFillColor(a[0], a[1], a[2]);
  const sd = (a) => doc.setDrawColor(a[0], a[1], a[2]);
  const st = (a) => doc.setTextColor(a[0], a[1], a[2]);
  // Stepped-rectangle gradients (jsPDF has no native gradient) — used for the soft
  // matte-blue → white fades in the letterhead.
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function gradH(x, y0, w, h, ca, cb, steps = 60) {
    const sw = w / steps;
    for (let i = 0; i < steps; i++) { sf(lerp(ca, cb, i / (steps - 1))); doc.rect(x + sw * i, y0, sw + 0.3, h, 'F'); }
  }
  function gradV(x, y0, w, h, ca, cb, steps = 60) {
    const sh = h / steps;
    for (let i = 0; i < steps; i++) { sf(lerp(ca, cb, i / (steps - 1))); doc.rect(x, y0 + sh * i, w, sh + 0.3, 'F'); }
  }
  const chk = (n) => { if (y + n > 272) np(); };
  const num = (n) => Number(n || 0).toLocaleString('en-IN');
  function fmtDate(s) { if (!s) return '—'; const p = String(s).split('-'); if (p.length === 3 && p[0].length === 4) return p[2] + '-' + p[1] + '-' + p[0]; return s; }
  function rs(n) {
    let s = Math.round(n).toString(); const neg = s[0] === '-'; if (neg) s = s.slice(1);
    let result = ''; if (s.length <= 3) result = s;
    else { result = s.slice(-3); s = s.slice(0, -3); while (s.length > 2) { result = s.slice(-2) + ',' + result; s = s.slice(0, -2); } result = s + ',' + result; }
    return (neg ? '-' : '') + result;
  }
  function np() { drawFooter(); doc.addPage(); pageNum++; y = 18; drawBorder(); }
  function drawBorder() { sd(P3); doc.setLineWidth(1.2); doc.rect(5, 5, PW - 10, PH - 10, 'S'); sd(MB2); doc.setLineWidth(0.3); doc.rect(6.5, 6.5, PW - 13, PH - 13, 'S'); }
  function drawFooter(cp, tp) {
    const pageLabel = cp || pageNum; const totalLabel = tp ? ' of ' + tp : '';
    sf(MB); doc.rect(0, PH - 11, PW, 11, 'F'); sf(ORG); doc.rect(0, PH - 11, PW, 0.6, 'F');
    st([255, 255, 255]); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    const docType = isEOI ? 'Expression of Interest' : 'Letter of Intent';
    doc.text('Vistara Group • ' + docType + ' • ' + new Date().toLocaleDateString('en-IN'), PW / 2, PH - 5.5, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.text('Page ' + pageLabel + totalLabel, PW - 12, PH - 5.5, { align: 'right' });
  }

  // ── Minimalist letterhead — matte-blue → white fade, with a small orange accent ──
  const HDR_H = 30;
  gradV(0, 0, PW, HDR_H, WASH, WHT);              // soft matte-blue → white wash
  gradH(0, 0, PW, 1.8, MB, MB2);                  // matte-blue gradient bar at the top
  sf(ORG); doc.rect(0, 1.8, PW, 0.4, 'F');        // hairline touch of orange under it

  // Company (left) + selected project's logo (right) placed directly on the header.
  function placeLogo(logo, boxX, boxW, boxH, boxY) {
    if (!logo || !logo.dataURL) return;
    const ar = (logo.w || 1) / (logo.h || 1);
    let w = boxW, h = boxW / ar;
    if (h > boxH) { h = boxH; w = boxH * ar; }
    const x = boxX + (boxW - w) / 2, yy = boxY + (boxH - h) / 2;
    try { doc.addImage(logo.dataURL, 'PNG', x, yy, w, h); } catch (e) {}
  }
  const LOGO_W = 32, LOGO_H = 19, LOGO_Y = 5.5;
  placeLogo(opts.companyLogo, M - 1, LOGO_W, LOGO_H, LOGO_Y);
  placeLogo(opts.projectLogo, PW - M + 1 - LOGO_W, LOGO_W, LOGO_H, LOGO_Y);

  // Project name — primary heading (the company is already shown by the logo).
  st(MB); doc.setFontSize(17); doc.setFont('helvetica', 'bold');
  doc.text(meta.project || '', PW / 2, 16, { align: 'center' });

  // Document title — matte blue, letter-spaced (baked-in spaces = exact centering),
  // underscored by a small ORANGE accent bar (the little touch of orange).
  let titleText = isEOI ? 'EXPRESSION OF INTEREST' : 'LETTER OF INTENT';
  if (isRevision) titleText = isEOI ? ('REVISED EOI · R' + revNo) : ('REVISED LOI · R' + revNo);
  const spacedTitle = titleText.split('').join(' ');
  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); st(MB2);
  doc.text(spacedTitle, PW / 2, 24.5, { align: 'center' });
  sf(ORG); doc.roundedRect(PW / 2 - 12, 26.4, 24, 0.9, 0.45, 0.45, 'F');

  // Header/body separator — matte-blue rule that fades out to white at both edges.
  const half = (PW - 2 * M) / 2;
  gradH(M, HDR_H, half, 0.6, WHT, MB);
  gradH(PW / 2, HDR_H, half, 0.6, MB, WHT);

  // Booking Date (right) + Plot No (left) — below the header.
  const plotNumOnly = (meta.plotNo || '—').toString().replace(/^[^0-9]*/, '') || (meta.plotNo || '—');
  st(MB); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('Plot No: ' + plotNumOnly, M, HDR_H + 6);
  doc.text('Booking Date: ' + fmtDate(meta.bookingDate), PW - M, HDR_H + 6, { align: 'right' });
  y = HDR_H + 10; drawBorder();

  // Client box
  chk(30); sf(WASH); doc.roundedRect(M, y, CW, 24, 2, 2, 'F'); sd([206, 217, 235]); doc.setLineWidth(0.4); doc.roundedRect(M, y, CW, 24, 2, 2, 'S');
  sf(ORG); doc.roundedRect(M, y, 3, 24, 1, 1, 'F');
  st(MB); doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(meta.clientName || '—', M + 6, y + 8);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); st(MD);
  if (meta.phoneNumber) doc.text('Ph: ' + meta.phoneNumber, M + 6, y + 14);
  const pairs = [['Gender', meta.gender || '—'], ['Project', meta.project || '—']];
  const colW = CW / pairs.length;
  pairs.forEach((p, i) => {
    const cx = M + 6 + colW * i;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); st(LT); doc.text(p[0], cx, y + 18);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); st(DK); doc.text(String(p[1]), cx, y + 22.5);
    if (i < pairs.length - 1) { sd(LN); doc.setLineWidth(0.3); doc.line(M + colW * (i + 1), y + 16, M + colW * (i + 1), y + 24); }
  });
  y += 30;

  // Section header — rounded matte-blue bar with a small inset orange accent.
  function secHead(title) { chk(14); sf(MB); doc.roundedRect(M, y, CW, 8, 2.2, 2.2, 'F'); sf(ORG); doc.roundedRect(M + 1.4, y + 2, 1.7, 4, 0.85, 0.85, 'F'); st(WHT); doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text(title.toUpperCase(), M + 5.5, y + 5.5); y += 12; }
  function tRow(label, n, o) {
    const subline = o && o.subline; const valStr = o && o.valStr;
    chk(subline ? 13 : 8); const isTotal = o && o.total, isSub = o && o.sub, isGreen = o && o.green;
    const h = isTotal ? 10 : (subline ? 12 : 7.5); const LX = M + 3;
    if (isTotal) { sf(MB); doc.roundedRect(M, y - 5.5, CW, h + 1, 2.2, 2.2, 'F'); sf(ORG); doc.roundedRect(M + 1.4, y - 3.5, 1.7, h - 3, 0.85, 0.85, 'F'); st(WHT); doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(label, M + 7, y); doc.text('Rs. ' + (valStr || rs(n)), NUM_COL, y, { align: 'right' }); y += h + 2; rowAlt = false; return; }
    if (isSub) { sf(P3); doc.rect(M, y - 5, CW, h, 'F'); st(MB); doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text(label, LX, y); doc.text('Rs. ' + (valStr || rs(n)), NUM_COL, y, { align: 'right' }); y += h + 1; rowAlt = false; return; }
    if (rowAlt) { sf([248, 250, 254]); doc.rect(M, y - 5, CW, h, 'F'); }
    rowAlt = !rowAlt;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); st(isGreen ? [22, 163, 74] : MD); doc.text(label, LX, y);
    doc.setFont('helvetica', 'bold'); st(isGreen ? [22, 163, 74] : DK); doc.text('Rs. ' + (valStr || rs(n)), NUM_COL, y, { align: 'right' });
    if (subline) { doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); st(LT); doc.text(subline, LX + 2, y + 4.5); }
    sd(LN); doc.setLineWidth(0.2); doc.line(M, y + (subline ? 6.5 : 2), PW - M, y + (subline ? 6.5 : 2)); y += h;
  }
  function infoGrid(pairs2) {
    for (let i = 0; i < pairs2.length; i += 2) {
      chk(10); if (Math.floor(i / 2) % 2 === 0) { sf([248, 250, 254]); doc.rect(M, y - 5.5, CW, 9, 'F'); }
      const LX1 = M + 2, LX2 = 108;
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); st(LT); doc.text(pairs2[i][0].toUpperCase(), LX1, y - 1);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); st(DK); doc.text(String(pairs2[i][1] || '—'), LX1, y + 3.5);
      if (pairs2[i + 1]) {
        sd(LN); doc.setLineWidth(0.3); doc.line(104, y - 5.5, 104, y + 4);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); st(LT); doc.text(pairs2[i + 1][0].toUpperCase(), LX2, y - 1);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); st(DK); doc.text(String(pairs2[i + 1][1] || '—'), LX2, y + 3.5);
      }
      y += 11;
    }
    y += 2;
  }

  // Details
  secHead('Details', P);
  if (isIndustrialPdf) {
    const areaSqMtr = v.area > 0 ? (v.area / 10.764).toFixed(2) + ' sq.mtr' : '—';
    infoGrid([
      ...((chosenUnit && chosenUnit !== 'sq.ft')
        ? [['Plot Area', v.area + ' ' + areaUnit]]
        : [['Plot Area (sq.ft)', v.area + ' sq.ft.'], ['Plot Area (sq.mtr)', areaSqMtr]]),
      ['CP / Channel Partner', meta.cpName || '—'], ['STM Name', meta.loggedInUser || '—'],
      ['Source of Inquiry', meta.source || '—'], ['Address', meta.address || '—'],
    ]);
  } else {
    const typeLabel = isAnkholPdf ? 'Bunglow Type' : 'Villa Type';
    const typeValue = isAnkholPdf ? (meta.bunglowType || '5B2HK + SR') : (meta.villaType || '—');
    infoGrid([
      ['Plot Area', v.area + ' ' + areaUnit], ['Construction Area', v.constArea + ' ' + areaUnit],
      [typeLabel, typeValue], ['CP / Channel Partner', meta.cpName || '—'],
      ['STM Name', meta.loggedInUser || '—'], ['Source of Inquiry', meta.source || '—'], ['Address', meta.address || '—'],
    ]);
  }

  // Agreement Amount
  if (isAnkholPdf) {
    const sdPct = v.saleDeedPct != null ? v.saleDeedPct : 60;
    const fmt2 = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    secHead('Deal Value', [71, 85, 105]);
    infoGrid([
      ['Unit Price', 'Rs. ' + num(v.saleDeed)],
      ['Additional Extra Work Charges', 'Rs. ' + fmt2(v.nonSaleDeedDoc)],
    ]);
  }
  else if (isIndustrialPdf) {
    secHead('Agreement Amount', [71, 85, 105]);
    const rows = [['Sale Deed', 'Rs. ' + num(v.saleDeed) + ' (SD Rate x Plot Area)']];
    if (!isTundavPdf) rows.push(['Development Agreement', 'Rs. ' + num(v.devAgreement) + ' (Dev Rate x Plot Area)']);
    infoGrid(rows);
  } else { secHead('Agreement Amount', [71, 85, 105]); infoGrid([['Land Sale Deed', 'Rs. ' + num(v.lsd)], ['Construction Agreement', 'Rs. ' + num(v.constAgr)]]); }

  // Extra Charges — reserve the full section height so the Total Extra
  // Charges sub-row is never split onto the next page.
  const nExtra = isAnkholPdf ? 6 : isIndustrialPdf ? 6 : 5;
  chk(14 + nExtra * 7.5 + 12); secHead('Extra Charges', [124, 58, 237]); rowAlt = false;
  if (isAnkholPdf) {
    tRow(v.applyStampDuty === 'No' ? 'Stamp Duty (Not Applicable)' : 'Stamp Duty (4.9% of Sale Deed)', v.applyStampDuty === 'No' ? 0 : v.stampDuty);
    tRow(v.applyRegFee === 'No' ? 'Registration Fees (Not Applicable)' : ('Registration Fees (1% of Sale Deed' + (v.applyPageFee === 'No' ? ')' : ' + Rs.1,500)')), v.applyRegFee === 'No' ? 0 : v.regFees);
    tRow(v.applyGst === 'No' ? 'GST (Not Applicable)' : 'GST (5% of Sale Deed)', v.applyGst === 'No' ? 0 : v.gst);
    tRow('Maintenance Deposit', v.maintDeposit); tRow('Maintenance Advance', v.maintAdvance); tRow('Legal Charges & Others', v.legal);
  } else if (isIndustrialPdf) {
    tRow('Stamp Duty (4.9% of Sale Deed)', v.stampDuty);
    tRow(v.applyRegFee === 'No' ? 'Registration Fees (Not Applicable)' : ('Registration Fees (' + (v.gender === 'Female' ? ('Female - ' + (v.applyPageFee === 'No' ? 'Rs.0' : 'Rs.1,500')) : ('Male - 1% Sale Deed' + (v.applyPageFee === 'No' ? '' : ' + Rs.1,500'))) + ')'), v.applyRegFee === 'No' ? 0 : v.regFees);
    tRow(isTundavPdf ? 'GST on Sale Deed (18% of 67% of Sale Deed)' : 'GST on Developed Plot (18% of Development Agreement)', v.gst);
    tRow('Maintenance Deposit', v.maintDeposit); tRow('Maintenance Advance', v.maintAdvance); tRow('Legal Charges & Others', v.legal);
  } else {
    tRow('Stamp Duty (4.9% of Land Sale Deed)', v.stampDuty);
    tRow(v.applyRegFee === 'No' ? 'Registration Fees (Not Applicable)' : ('Registration Fees (' + (v.gender === 'Female' ? ('Female - ' + (v.applyPageFee === 'No' ? 'Rs.0' : 'Rs.1,500')) : ('Male - 1% LSD' + (v.applyPageFee === 'No' ? '' : ' + Rs.1,500'))) + ')'), v.applyRegFee === 'No' ? 0 : v.regFees);
    tRow('GST (18% of Construction Agreement)', v.gst); tRow('Maintenance', v.maint); tRow('Legal Charges & Others', v.legal);
  }
  y += 2; tRow('Total Extra Charges', v.totalExtra, { sub: true });

  if (v.extraWorkAmt > 0) { chk(20); secHead('Extra Work', [22, 163, 74]); rowAlt = false; tRow(v.extraWorkDesc || 'Extra Work Charges', v.extraWorkAmt); y += 2; }

  // Payment Schedule — 3 separate sections
  const unitInstPdf = installments.filter(i => !i.isExtra && !i.isExtraWork && !i.isNsd);
  const ewcRawPdf = [
    ...installments.filter(i => i.isNsd),
    ...extraWorkInst.map(r => ({ no: 'W' + r.no, date: r.date, pct: r.pct, amt: r.amt, isExtraWork: true, desc: v.extraWorkDesc })),
  ];
  const legalInstPdf = installments.filter(i => i.isExtra && Math.round(i.amt || 0) > 0);
  const hasSchedule = unitInstPdf.length + ewcRawPdf.length + legalInstPdf.length > 0;

  if (hasSchedule) {
    const DC_NUM = M + 8, DC_DATE = M + 18, DC_PCT = M + 82, DC_RS = PW - M - 28, DC_AMT = PW - M - 3;

    const drawSchedHeader = () => {
      chk(10); sf(MB); doc.roundedRect(M, y - 5.5, CW, 9, 2.2, 2.2, 'F'); st(WHT); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
      doc.text('#', DC_NUM, y, { align: 'center' }); doc.text('Due Date', DC_DATE, y); doc.text('%', DC_PCT, y); doc.text('Amount (Rs.)', DC_RS, y);
      y += 10;
    };

    const drawSubTotal = (label, n) => {
      chk(12); sf(WASH); doc.roundedRect(M, y - 5, CW, 10, 1.5, 1.5, 'F'); sd(MB2); doc.setLineWidth(0.5); doc.roundedRect(M, y - 5, CW, 10, 1.5, 1.5, 'S');
      sf(ORG); doc.roundedRect(M + 1.2, y - 3, 1.7, 6, 0.85, 0.85, 'F');
      const nStr = n % 1 === 0 ? rs(n) : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      st(MB); doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(label, DC_DATE, y + 1); doc.text('Rs. ' + nStr, DC_AMT, y + 1, { align: 'right' });
      y += 16;
    };

    let grand = 0;

    if (unitInstPdf.length > 0) {
      // pre-check full section height so it never splits across pages
      chk(4 + 12 + 3 + 10 + unitInstPdf.length * 10 + 16);
      y += 4; secHead('Unit Price Payment Schedule'); y += 3; rowAlt = false;
      drawSchedHeader();
      let grandUnit = 0;
      unitInstPdf.forEach((inst, idx) => {
        const amt = Math.round(inst.amt || 0); grandUnit += amt; grand += amt;
        if (idx % 2 === 0) { sf([248, 250, 254]); doc.rect(M, y - 5.5, CW, 9, 'F'); }
        sf(MB); doc.circle(DC_NUM, y - 1, 3.5, 'F'); st([255, 255, 255]); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.text(String(inst.no), DC_NUM, y + 0.5, { align: 'center' });
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); st(DK); doc.text(fmtDate(inst.date) || '—', DC_DATE, y); doc.text((inst.pct || 0) + '%', DC_PCT, y);
        doc.setFont('helvetica', 'bold'); doc.text('Rs. ' + rs(amt), DC_AMT, y, { align: 'right' });
        sd(LN); doc.setLineWidth(0.2); doc.line(M, y + 3.5, PW - M, y + 3.5); y += 10;
      });
      drawSubTotal('SUB TOTAL', grandUnit);
    }

    if (ewcRawPdf.length > 0) {
      chk(4 + 12 + 3 + 10 + ewcRawPdf.length * 10 + 16);
      y += 4; secHead('Additional Extra Work Charges Schedule'); y += 3; rowAlt = false;
      drawSchedHeader();
      let grandEwc = 0;
      ewcRawPdf.forEach((inst, idx) => {
        if (inst.isNsd) {
          const docAmt = (inst.amt || 0) / 100; grandEwc += docAmt; grand += docAmt;
          const docStr = docAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          if (idx % 2 === 0) { sf([248, 250, 254]); doc.rect(M, y - 5.5, CW, 9, 'F'); }
          sf(MB); doc.circle(DC_NUM, y - 1, 3.5, 'F'); st([255, 255, 255]); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.text(String(idx + 1), DC_NUM, y + 0.5, { align: 'center' });
          doc.setFontSize(9); doc.setFont('helvetica', 'normal'); st(DK); doc.text(fmtDate(inst.date) || '—', DC_DATE, y); doc.text((inst.pct || 0) + '%', DC_PCT, y);
          doc.setFont('helvetica', 'bold'); doc.text('Rs. ' + docStr, DC_AMT, y, { align: 'right' });
        } else {
          const amt = Math.round(inst.amt || 0); grandEwc += amt; grand += amt;
          if (idx % 2 === 0) { sf([248, 250, 254]); doc.rect(M, y - 5.5, CW, 9, 'F'); }
          sf(MB); doc.circle(DC_NUM, y - 1, 3.5, 'F'); st([255, 255, 255]); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.text(String(idx + 1), DC_NUM, y + 0.5, { align: 'center' });
          doc.setFontSize(9); doc.setFont('helvetica', 'normal'); st(DK); doc.text(fmtDate(inst.date) || '—', DC_DATE, y); doc.text((inst.pct || 0) + '%', DC_PCT, y);
          doc.setFont('helvetica', 'bold'); doc.text('Rs. ' + rs(amt), DC_AMT, y, { align: 'right' });
        }
        sd(LN); doc.setLineWidth(0.2); doc.line(M, y + 3.5, PW - M, y + 3.5); y += 10;
      });
      drawSubTotal('SUB TOTAL', grandEwc);
    }

    if (legalInstPdf.length > 0) {
      chk(4 + 12 + 3 + 10 + legalInstPdf.length * 10 + 16);
      y += 4; secHead('Legal & Other Charges Schedule'); y += 3; rowAlt = false;
      drawSchedHeader();
      let grandLegal = 0;
      legalInstPdf.forEach((inst, idx) => {
        const amt = Math.round(inst.amt || 0); grandLegal += amt; grand += amt;
        if (idx % 2 === 0) { sf([248, 250, 254]); doc.rect(M, y - 5.5, CW, 9, 'F'); }
        sf(MB); doc.circle(DC_NUM, y - 1, 3.5, 'F'); st([255, 255, 255]); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.text(String(idx + 1), DC_NUM, y + 0.5, { align: 'center' });
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); st(DK); doc.text(fmtDate(inst.date) || '—', DC_DATE, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); st(DK); doc.text('Legal & Other Charges', DC_PCT, y);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.text('Rs. ' + rs(amt), DC_AMT, y, { align: 'right' });
        sd(LN); doc.setLineWidth(0.2); doc.line(M, y + 3.5, PW - M, y + 3.5); y += 10;
      });
      drawSubTotal('SUB TOTAL', grandLegal);
    }

  }

  // Terms
  const terms = [
    ['Payment Mode', 'All payments via cheque or bank transfer only. No cash accepted.'],
    ['Late Payment', 'Delay >10 days attracts 2% per month penalty on the due installment.'],
    ['Cancellation', 'Delay >15 days allows developer to cancel; refund after 10% deduction within 3 months.'],
    ['Extra Charges', 'Extra charges may vary per Govt. Rules. Developer not liable for variation.'],
    ['Early Payment', '1% per month discount applicable on land cost for early payments.'],
    ['Plot Area', 'Plot area measured from centre line of compound walls.'],
  ];
  extraTerms.forEach((t) => { if (t.title || t.desc) terms.push([t.title || 'Note', t.desc || '']); });
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  const termHeights = terms.map(t => Math.max(9, doc.splitTextToSize(t[1] || '', CW - 50).length * 4 + 4));
  const totalTermsH = 4 + 12 + termHeights.reduce((a, b) => a + b, 0);
  chk(totalTermsH); y += 4; secHead('Terms & Conditions', [71, 85, 105]);
  terms.forEach((t, idx) => {
    const descLines = doc.splitTextToSize(t[1] || '', CW - 50); const rowH = termHeights[idx];
    if (idx % 2 === 0) { sf([249, 250, 251]); doc.rect(M, y - 5, CW, rowH, 'F'); }
    sf(ORG); doc.circle(M + 3, y - 0.5, 1.2, 'F'); doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); st(MB); doc.text(t[0], M + 7, y);
    doc.setFont('helvetica', 'normal'); st(MD); doc.text(descLines, M + 48, y); y += rowH;
  });

  // Signatures + declaration
  chk(44); y += 8; const BW = 75, BH = 26;
  sd(LN); doc.setLineWidth(0.5); doc.roundedRect(M, y, BW, BH, 2, 2, 'S'); doc.roundedRect(PW - M - BW, y, BW, BH, 2, 2, 'S');
  sd([200, 200, 210]); doc.setLineWidth(0.4); doc.line(M + 8, y + 17, M + BW - 8, y + 17); doc.line(PW - M - BW + 8, y + 17, PW - M - 8, y + 17);
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); st(LT); doc.text('BUYER SIGNATURE', M + BW / 2, y + 5, { align: 'center' }); doc.text('SELLER SIGNATURE', PW - M - BW / 2, y + 5, { align: 'center' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); st(DK); doc.text(meta.clientName || '—', M + BW / 2, y + 22, { align: 'center' }); doc.text('Vistara Group', PW - M - BW / 2, y + 22, { align: 'center' });
  doc.setFontSize(8.5); st(MD); doc.text('Date: ________________________', PW / 2, y + 32, { align: 'center' });
  chk(16); y += 40; sf(WASH); doc.roundedRect(M, y, CW, 12, 2, 2, 'F'); sd(MB2); doc.setLineWidth(0.4); doc.roundedRect(M, y, CW, 12, 2, 2, 'S');
  sf(ORG); doc.roundedRect(M + 1.2, y + 2, 1.7, 8, 0.85, 0.85, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'italic'); st(MB);
  doc.text('I hereby declare that I have read, understood, and agreed to all terms and conditions.', PW / 2, y + 7.5, { align: 'center', maxWidth: CW - 10 });

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) { doc.setPage(p); drawFooter(p, total); }
  return doc;
}

// Load an image URL → { dataURL(PNG), w, h } via canvas. Returns null on any failure
// (missing image, CORS-tainted canvas, …) so the LOI still renders without the logo.
function loadLogo(url) {
  return new Promise((resolve) => {
    if (!url || typeof window === 'undefined') return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataURL: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function downloadLOI(meta, v, installments, opts = {}) {
  const jsPDF = await ensureJsPDF();
  const [companyLogo, projectLogo] = await Promise.all([
    loadLogo('/vistara-logo.png'),   // whitespace-trimmed company logo
    loadLogo(opts.projectLogoUrl),
  ]);
  const doc = buildLOIPdf(jsPDF, meta, v, installments, { ...opts, companyLogo, projectLogo });
  const name = 'LOI_' + (meta.project || '') + '_Plot' + (meta.plotNo || '') + '_' + (meta.clientName || '').replace(/\s+/g, '_') + '.pdf';
  doc.save(name);
  return true;
}
