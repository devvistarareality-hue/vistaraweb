// Money for display. rupee: "₹ 1,23,45,678" (exact). inrShort: "₹3.02 Cr", "₹45.6 L",
// "₹12,340" for dashboards — put the exact figure in a title tooltip.
export const rupee = (n) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '−₹ ' : '₹ ') + Math.abs(v).toLocaleString('en-IN');
};

export const inrShort = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  // Drop trailing zeros after the decimal point only — never from a whole number (400 stays 400).
  const trim = (x, d) => (d ? x.toFixed(d).replace(/\.?0+$/, '') : x.toFixed(0));
  if (a >= 1e7) return `${sign}₹${trim(a / 1e7, a >= 1e9 ? 0 : 2)} Cr`;
  if (a >= 1e5) return `${sign}₹${trim(a / 1e5, 2)} L`;
  return `${sign}₹${Math.round(a).toLocaleString('en-IN')}`;
};

export const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
