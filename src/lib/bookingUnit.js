// What to call the thing a booking is for. A unit number when one was selected
// (plot_numbers / plot_number), otherwise the area — an area is not a unit, so it
// is labelled as an area rather than rendered as "Unit 80000", which read like a
// plot number that does not exist.
export function unitLabel(b) {
  const unit = b?.plot_numbers || b?.plot_number;
  if (unit) return { text: String(unit), isUnit: true };
  const area = b?.area;
  if (area) {
    const n = Number(String(area).replace(/[^\d.]/g, ''));
    const pretty = Number.isFinite(n) && n ? n.toLocaleString('en-IN') : String(area);
    return { text: `${pretty} ${b?.area_unit || 'sq.ft'}`, isUnit: false };
  }
  return { text: '—', isUnit: false };
}
