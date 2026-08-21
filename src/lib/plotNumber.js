// A plot number is shown "short" in space-constrained places (map labels, booking
// titles, the LOI) by stripping a redundant leading cluster-type prefix that's
// already shown elsewhere as its own badge -- e.g. "Karuna24" -> "24".
//
// Two kinds of prefix are NOT redundant and must survive:
//   - a hyphenated block ("A-1", "D-12A", "A-101"), and
//   - a single letter ("B1", "B12A"), which is a block designation too.
// In both cases the letter is the only thing telling the plot apart from the same
// number in another block: Kalrav has a plot "1" of 4112 sq.yd and a plot "B1" of
// 932 sq.yd, and stripping made both render as "1" on the site map.
// A longer prefix is a cluster name shown as its own badge, so it still goes.
export function stripPlotPrefix(n) {
  const s = (n || '').toString();
  if (s.includes('-')) return s;
  const m = s.match(/^([^0-9]*)(\d.*)$/);
  if (!m) return s;
  if (m[1].trim().length <= 1) return s;   // "" (plain number) or a block letter
  return m[2] || s;
}
