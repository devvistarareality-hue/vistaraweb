// Pure date-series helper, kept out of _TrendCharts so importing it does not
// drag recharts into a page bundle.
export function fillDates(rows, dateFrom, dateTo) {
  const map = {}, amtMap = {};
  rows.forEach(r => { map[r.date] = r.count; if (r.amount != null) amtMap[r.date] = r.amount; });

  const result = [];
  const cur = new Date(dateFrom);
  const end = new Date(dateTo);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    result.push({ date: key, count: map[key] ?? 0, amount: amtMap[key] ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}
