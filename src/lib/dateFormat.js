// Display-only formatting for ISO 'YYYY-MM-DD' strings coming from the API.
// Never use this on <input type="date"> values — those must stay ISO format,
// the HTML5 spec requires it regardless of display locale.
export function formatDMY(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = String(isoDate).split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}
