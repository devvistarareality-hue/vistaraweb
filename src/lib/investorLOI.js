// Investment Proposal Form (Club 1000 LOI) — jsPDF generator styled to match
// the sales LOI/EOI letterhead exactly (same matte-blue/orange palette, section
// headers, info grid, terms layout, signature blocks, footer). Content is the
// Club 1000 investment terms; presentation mirrors bookingLOI.buildLOIPdf.
import { ensureJsPDF, loadLogo } from './bookingLOI';

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  return y && m && d ? `${d}-${m}-${y}` : iso;
}

function tenureLabel(months) {
  if (!months) return '—';
  if (months % 12 === 0) { const y = months / 12; return `${y} YEAR${y > 1 ? 'S' : ''}`; }
  return `${months} MONTH${months > 1 ? 'S' : ''}`;
}

// investor: InvestorListSerializer shape. scheme: SchemeSerializer shape.
export function buildInvestorLOIPdf(jsPDF, investor, scheme, opts = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, M = 15, CW = PW - 2 * M;
  let y = 0, pageNum = 1, rowAlt = false;

  // Same palette as bookingLOI's minimalist matte-blue / white / orange-accent scheme.
  const MB = [46, 74, 120], MB2 = [92, 124, 172], WASH = [237, 242, 249], WHT = [255, 255, 255], ORG = [255, 107, 43];
  const DK = [30, 41, 59], MD = [71, 85, 105], LT = [148, 163, 184], LN = [226, 232, 240], P3 = [232, 240, 254];

  const sf = (a) => doc.setFillColor(a[0], a[1], a[2]);
  const sd = (a) => doc.setDrawColor(a[0], a[1], a[2]);
  const st = (a) => doc.setTextColor(a[0], a[1], a[2]);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function gradH(x, y0, w, h, ca, cb, steps = 60) {
    const sw = w / steps;
    for (let i = 0; i < steps; i++) { sf(lerp(ca, cb, i / (steps - 1))); doc.rect(x + sw * i, y0, sw + 0.3, h, 'F'); }
  }
  function gradV(x, y0, w, h, ca, cb, steps = 60) {
    const sh = h / steps;
    for (let i = 0; i < steps; i++) { sf(lerp(ca, cb, i / (steps - 1))); doc.rect(x, y0 + sh * i, w, sh + 0.3, 'F'); }
  }
  const money = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const chk = (n) => { if (y + n > 272) np(); };
  function np() { drawFooter(); doc.addPage(); pageNum++; y = 18; drawBorder(); }
  function drawBorder() { sd(P3); doc.setLineWidth(1.2); doc.rect(5, 5, PW - 10, PH - 10, 'S'); sd(MB2); doc.setLineWidth(0.3); doc.rect(6.5, 6.5, PW - 13, PH - 13, 'S'); }
  function drawFooter(cp, tp) {
    const pageLabel = cp || pageNum; const totalLabel = tp ? ' of ' + tp : '';
    sf(MB); doc.rect(0, PH - 11, PW, 11, 'F'); sf(ORG); doc.rect(0, PH - 11, PW, 0.6, 'F');
    st([255, 255, 255]); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('Vistara Group • Investment Proposal • ' + new Date().toLocaleDateString('en-IN'), PW / 2, PH - 5.5, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.text('Page ' + pageLabel + totalLabel, PW - 12, PH - 5.5, { align: 'right' });
  }
  function secHead(title) {
    chk(14); sf(MB); doc.roundedRect(M, y, CW, 8, 2.2, 2.2, 'F');
    sf(ORG); doc.roundedRect(M + 1.4, y + 2, 1.7, 4, 0.85, 0.85, 'F');
    st(WHT); doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text(title.toUpperCase(), M + 5.5, y + 5.5); y += 12;
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

  const principalFreq = scheme.principal_payout === 'maturity' ? 'AT END OF TENURE' : (scheme.principal_payout || '—').toUpperCase();
  const returnFreq = (investor.interest_payout || '').toUpperCase() || '—';
  const prematureExit = scheme.premature_redemption_allowed
    ? `AFTER ${scheme.premature_redemption_lock_months || 0} MONTHS (${scheme.premature_redemption_rate_pct_per_month}%/MONTH)`
    : 'NA';
  const security = investor.security || 'NA';
  const loiDate = fmtDate(new Date().toISOString().slice(0, 10));

  // ── Minimalist letterhead — matte-blue → white fade, with a small orange accent ──
  const HDR_H = 30;
  gradV(0, 0, PW, HDR_H, WASH, WHT);
  gradH(0, 0, PW, 1.8, MB, MB2);
  sf(ORG); doc.rect(0, 1.8, PW, 0.4, 'F');

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

  st(MB); doc.setFontSize(17); doc.setFont('helvetica', 'bold');
  doc.text('CLUB 1000', PW / 2, 16, { align: 'center' });

  const spacedTitle = 'INVESTMENT PROPOSAL FORM'.split('').join(' ');
  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); st(MB2);
  doc.text(spacedTitle, PW / 2, 24.5, { align: 'center' });
  sf(ORG); doc.roundedRect(PW / 2 - 12, 26.4, 24, 0.9, 0.45, 0.45, 'F');

  const half = (PW - 2 * M) / 2;
  gradH(M, HDR_H, half, 0.6, WHT, MB);
  gradH(PW / 2, HDR_H, half, 0.6, MB, WHT);

  st(MB); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('LOI No: ' + (investor.loi_no || '—'), M, HDR_H + 6);
  doc.text('LOI Date: ' + loiDate, PW - M, HDR_H + 6, { align: 'right' });
  y = HDR_H + 10; drawBorder();

  // Investor box — mirrors the client box on the sales LOI.
  chk(30); sf(WASH); doc.roundedRect(M, y, CW, 24, 2, 2, 'F'); sd([206, 217, 235]); doc.setLineWidth(0.4); doc.roundedRect(M, y, CW, 24, 2, 2, 'S');
  sf(ORG); doc.roundedRect(M, y, 3, 24, 1, 1, 'F');
  st(MB); doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(investor.name || '—', M + 6, y + 8);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); st(MD);
  if (investor.phone) doc.text('Ph: ' + investor.phone, M + 6, y + 14);
  const pairs = [['Scheme', scheme.name || '—'], ['Investment Date', fmtDate(investor.investment_date)]];
  const colW = CW / pairs.length;
  pairs.forEach((p, i) => {
    const cx = M + 6 + colW * i;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); st(LT); doc.text(p[0], cx, y + 18);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); st(DK); doc.text(String(p[1]), cx, y + 22.5);
    if (i < pairs.length - 1) { sd(LN); doc.setLineWidth(0.3); doc.line(M + colW * (i + 1), y + 16, M + colW * (i + 1), y + 24); }
  });
  y += 30;

  // Investment Amount — highlighted total bar.
  secHead('Investment Value'); rowAlt = false;
  chk(11); sf(MB); doc.roundedRect(M, y - 5.5, CW, 11, 2.2, 2.2, 'F'); sf(ORG); doc.roundedRect(M + 1.4, y - 3.5, 1.7, 7, 0.85, 0.85, 'F');
  st(WHT); doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text('Investment Amount', M + 7, y);
  doc.text('Rs. ' + money(investor.amount_invested), PW - M - 3, y, { align: 'right' }); y += 13;

  // Investment terms — mirrors the "Details" info grid.
  secHead('Investment Terms');
  infoGrid([
    ['ROI (Per Annum)', `${scheme.total_return_pct}%`],
    ['Tenure²', tenureLabel(scheme.tenure_months)],
    ['Principal Pay Out Frequency³', principalFreq],
    ['Return Pay Out Frequency³', returnFreq],
    ['Lock-in Period²', tenureLabel(scheme.premature_redemption_lock_months)],
    ['Premature Exit Option¹', prematureExit],
    ['Security', security],
  ]);

  // ── Terms & Conditions — same styled rows as the sales LOI's terms section ──
  const terms = [
    ['1. Premature Exit Option', 'Rise - No premature redumption can be made during tenure of investment. BuyBack - Premature redumption can be made after completion of 1 year from date of innvestment*. Equity - No premature redumption can be made during tenure of investment. *Wherever premature redemption is applicable & client excercised the same then ROI is set to 1% per month receivable to investor from the date of investment till the date of early redumption.'],
    ['2. Tenure and Lock-in Period', 'The tenure of investment shall be as mentioned above from the date of receipt of funds. The Investment shall be subject to a lock-in period as mentioned above, during which the Investor shall not withdraw the Investment Amount. Upon completion of tenure as mentioned above, investment may be renewed on mutually agreed terms through written consent of both Parties.'],
    ['3. Interest and Payout Terms', 'The Borrower agrees to pay interest at the rate as mentioned above on the Investment Amount. Interest shall be payable at a frequency as mentioned above. Interest shall be paid within 7 days from the end of frequency period of interest amount as mentioned above. Principal amount shall be paid within 7 days from the end of frequency period of principal amount as mentioned above.'],
    ['4. Default', 'In case of Failure to pay interest, or Failure to repay principal upon maturity, the Investor shall have the right to Present the Post-Dated Cheque (PDC) for encashment.'],
  ];
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  const termHeights = terms.map((t) => Math.max(9, doc.splitTextToSize(t[1] || '', CW - 50).length * 4 + 4));
  const totalTermsH = 4 + 12 + termHeights.reduce((a, b) => a + b, 0);
  chk(totalTermsH); y += 4; secHead('Terms & Conditions');
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
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); st(LT); doc.text('INVESTOR SIGNATURE', M + BW / 2, y + 5, { align: 'center' }); doc.text('BORROWER SIGNATURE', PW - M - BW / 2, y + 5, { align: 'center' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); st(DK); doc.text(investor.name || '—', M + BW / 2, y + 22, { align: 'center' }); doc.text('Vistara Group', PW - M - BW / 2, y + 22, { align: 'center' });
  doc.setFontSize(8.5); st(MD); doc.text('Date: ________________________', PW / 2, y + 32, { align: 'center' });
  chk(16); y += 40; sf(WASH); doc.roundedRect(M, y, CW, 12, 2, 2, 'F'); sd(MB2); doc.setLineWidth(0.4); doc.roundedRect(M, y, CW, 12, 2, 2, 'S');
  sf(ORG); doc.roundedRect(M + 1.2, y + 2, 1.7, 8, 0.85, 0.85, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'italic'); st(MB);
  doc.text('I hereby declare that I have read, understood, and agreed to all terms and conditions.', PW / 2, y + 7.5, { align: 'center', maxWidth: CW - 10 });

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) { doc.setPage(p); drawFooter(p, total); }
  return doc;
}

function loiFilename(investor) {
  return `LOI_${(investor.loi_no || investor.name || 'investor').replace(/[\\/:*?"<>|]+/g, '_')}.pdf`;
}

export async function downloadInvestorLOI(investor, scheme) {
  const jsPDF = await ensureJsPDF();
  const companyLogo = await loadLogo('/vistara-logo.png');
  const doc = buildInvestorLOIPdf(jsPDF, investor, scheme, { companyLogo });
  doc.save(loiFilename(investor));
  return true;
}

// Returns { name, type, data(base64) } ready for the upload-loi endpoint.
export async function generateInvestorLOIBase64(investor, scheme) {
  const jsPDF = await ensureJsPDF();
  const companyLogo = await loadLogo('/vistara-logo.png');
  const doc = buildInvestorLOIPdf(jsPDF, investor, scheme, { companyLogo });
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1];
  return { name: loiFilename(investor), type: 'application/pdf', data: base64 };
}
