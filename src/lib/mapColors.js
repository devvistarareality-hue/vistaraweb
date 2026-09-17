// Unit-map colours are fixed, not themed: the site plan image is light in both
// themes, and SVG fill/stroke attributes can't read CSS variables anyway.
const MAP = {
  available: '#1FA35C',
  sold:      '#E0474F',
  hold:      '#3B82D6',
  pending:   '#E8962B',
  resale:    '#7A5AF8',
  drafted:   '#8A94A3',
};
const BY_TOKEN = {
  'var(--success)': MAP.available, 'var(--danger)': MAP.sold, 'var(--accent)': MAP.hold,
  'var(--warning-2)': MAP.pending, '#a2d2ff': MAP.resale, '#A2D2FF': MAP.resale,
  'var(--faint)': MAP.drafted, 'var(--text-2)': MAP.drafted,
};
export const mapHex = (c) => BY_TOKEN[c] || (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : MAP.hold);
export const MAP_SELECTED = '#2F6DB5';
export const MAP_INK = '#0C182B';
// Tooltip over the map stays dark in both themes.
export const MAP_TIP_BG = 'rgba(10,14,22,0.94)';
