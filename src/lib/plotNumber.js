// A plot number is shown "short" in space-constrained places (map labels, booking
// titles, the LOI) by stripping a redundant leading cluster-type prefix that's
// already shown elsewhere as its own badge -- e.g. "Karuna24" -> "24".
//
// A block-prefixed number (Block-wise Industrial, or a multi-block Pratishtha
// tower -- "A-1", "D-12A", "A-101") is NOT redundant: the block letter is the
// only thing disambiguating it from the same number in another block, so it must
// stay in the displayed/printed number. Recognised by the hyphen separator.
export function stripPlotPrefix(n) {
  const s = (n || '').toString();
  if (s.includes('-')) return s;
  return s.replace(/^[^0-9]*/, '') || s;
}
