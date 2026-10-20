'use client';
// Payouts ahead, by scheme: what has to be paid out in each coming month, financial
// quarter (Q1 Apr–Jun … Q4 Jan–Mar) or financial year — interest, principal, or both —
// as columns stacked by scheme. Anything already past its due date and still unpaid
// sits in the first column, "Overdue", so no rupee owed is left off the chart.
import { useEffect, useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { rupee, inrShort } from '../../lib/inr';
import { DashCard } from '../../components/Dash';
import { payoutPart, hasPart } from '../../lib/c1PayoutPart';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GRAINS = [['month', 'Month', 12], ['quarter', 'Quarter', 8], ['year', 'Year', 6]];
const KINDS = [['both', 'Interest + Principal'], ['interest', 'Interest'], ['principal', 'Principal']];

const fy = (y, m) => (m >= 4 ? y : y - 1);                        // financial year it falls in
const fyLabel = (f) => `FY${String(f).slice(2)}-${String(f + 1).slice(2)}`;
const fq = (m) => (m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 ? 3 : 4);

// The period a date falls in, as a sortable key and a label.
function bucketOf(iso, grain) {
  const [y, m] = String(iso).split('-').map(Number);
  if (grain === 'month') return { key: y * 100 + m, label: `${MONTHS[m - 1]} ${String(y).slice(2)}` };
  if (grain === 'quarter') { const f = fy(y, m), q = fq(m); return { key: f * 10 + q, label: `Q${q} ${fyLabel(f)}` }; }
  const f = fy(y, m); return { key: f, label: fyLabel(f) };
}

// The next N periods from today, in order (so empty ones still show).
function nextBuckets(grain, n, today) {
  const [y0, m0] = today.split('-').map(Number);
  const out = []; const seen = new Set();
  for (let i = 0; out.length < n && i < 120; i += 1) {
    const d = new Date(y0, m0 - 1 + i, 1);
    const b = bucketOf(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, grain);
    if (!seen.has(b.key)) { seen.add(b.key); out.push(b); }
  }
  return out;
}

// A round top for the scale just above the tallest column (quarter steps stay
// round: ₹12 Cr → ₹3 / 6 / 9 / 12 Cr), so the bars use the height they have.
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return ([1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((step) => f <= step) || 10) * p;
}
const TICKS = [1, 0.75, 0.5, 0.25, 0];

export default function PayoutsAhead({ schemeSel = [] }) {
  const [payouts, setPayouts] = useState(null);
  const [grain, setGrain] = useState('month');
  const [kind, setKind] = useState('both');
  const [hover, setHover] = useState(null);

  useEffect(() => {
    let alive = true;
    apiFetch(`${CLUB1000_ENDPOINTS.payouts}?status=pending`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (alive) setPayouts(Array.isArray(d) ? d : (d.results || [])); })
      .catch(() => alive && setPayouts([]));
    return () => { alive = false; };
  }, []);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const { columns, schemes, max, total, stats } = useMemo(() => {
    const rows = (payouts || []).filter((p) => (!schemeSel.length || schemeSel.includes(p.scheme_name))
      && hasPart(p, kind));
    // Scheme order is fixed by name so a scheme keeps its colour as filters change.
    const names = [...new Set((payouts || []).map((p) => p.scheme_name || '—'))].sort();
    const n = GRAINS.find((g) => g[0] === grain)[2];
    const ahead = nextBuckets(grain, n, today);
    const cols = [{ key: 'overdue', label: 'Overdue', overdue: true, by: {}, sum: 0 },
      ...ahead.map((b) => ({ ...b, by: {}, sum: 0 }))];
    const byKey = Object.fromEntries(cols.map((c) => [c.key, c]));
    for (const p of rows) {
      const amt = payoutPart(p, kind);
      const col = p.due_date < today ? byKey.overdue : byKey[bucketOf(p.due_date, grain).key];
      if (!col) continue;   // beyond the window shown
      const s = p.scheme_name || '—';
      col.by[s] = (col.by[s] || 0) + amt; col.sum += amt;
    }
    const shown = cols.filter((c) => !c.overdue || c.sum > 0);
    // The headline split, over the same window and schemes whatever is being drawn.
    const lastKey = ahead.length ? ahead[ahead.length - 1].key : null;
    const inWindow = (payouts || []).filter((p) => (!schemeSel.length || schemeSel.includes(p.scheme_name))
      && (p.due_date < today || (lastKey != null && bucketOf(p.due_date, grain).key <= lastKey)));
    const sumOf = (k, f = () => true) => inWindow.filter(f).reduce((t, p) => t + payoutPart(p, k), 0);
    const stats = {
      interest: sumOf('interest'),
      principal: sumOf('principal'),
      overdue: sumOf(kind, (p) => p.due_date < today),
    };
    const peak = Math.max(1, ...shown.map((c) => c.sum));
    return { columns: shown, schemes: names, max: niceMax(peak), total: shown.reduce((t, c) => t + c.sum, 0), stats };
  }, [payouts, grain, kind, schemeSel.join('|'), today]);

  const colorOf = (name) => `c1pa-s${(schemes.indexOf(name) % 6) + 1}`;
  const kindLabel = KINDS.find((k) => k[0] === kind)[1];

  return (
    <DashCard title="Payouts ahead" sub={`${kindLabel} to pay, by scheme`} icon={CalendarRange}
      total={inrShort(total)} totalTitle={rupee(total)}>
      <div className="c1pa-filters">
        <div className="c1pa-seg" role="tablist" aria-label="Period">
          {GRAINS.map(([k, label, n]) => (
            <button key={k} type="button" className={grain === k ? 'on' : ''} onClick={() => setGrain(k)} title={`Next ${n} ${label.toLowerCase()}s`}>{label}</button>
          ))}
        </div>
        <div className="c1pa-seg" role="tablist" aria-label="What to count">
          {KINDS.map(([k, label]) => (
            <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
      </div>

      {payouts === null ? <div className="ar-empty">Loading…</div> : total === 0 ? (
        <div className="ar-empty">Nothing to pay in this window.</div>
      ) : <>
        <div className="c1pa-stats">
          <div><span>Total</span><b title={rupee(total)}>{inrShort(total)}</b></div>
          <div><span>Interest</span><b title={rupee(stats.interest)}>{inrShort(stats.interest)}</b></div>
          <div><span>Principal</span><b title={rupee(stats.principal)}>{inrShort(stats.principal)}</b></div>
          <div className={stats.overdue ? 'bad' : ''}><span>Overdue</span><b title={rupee(stats.overdue)}>{stats.overdue ? inrShort(stats.overdue) : '—'}</b></div>
        </div>
        <div className="c1pa-plot">
          <div className="c1pa-axis">
            {TICKS.map((t) => <span key={t}>{t ? inrShort(max * t) : '₹0'}</span>)}
          </div>
          <div className={`c1pa-chart g-${grain}`}>
            <div className="c1pa-grid">{TICKS.map((t) => <i key={t} />)}</div>
            {columns.map((c) => {
              const h = c.sum ? Math.max(1.5, (c.sum / max) * 100) : 0;
              return (
                <div key={c.key} className={`c1pa-col${c.overdue ? ' overdue' : ''}${hover === c.key ? ' hot' : ''}`}
                  onMouseEnter={() => setHover(c.key)} onMouseLeave={() => setHover(null)}>
                  <div className="c1pa-bar">
                    {c.sum > 0 && <span className="c1pa-val" style={{ bottom: `calc(${h}% + 4px)` }} title={rupee(c.sum)}>{inrShort(c.sum)}</span>}{/* inline-ok: the label sits on its bar */}
                    <div className="c1pa-stack" style={{ height: `${h}%` }}>{/* inline-ok: the column's share of the scale */}
                      {schemes.filter((sc) => c.by[sc]).map((sc) => (
                        <i key={sc} className={c.overdue ? 'c1pa-over' : colorOf(sc)} style={{ flexGrow: c.by[sc] }} />/* inline-ok: the scheme's share of the column */
                      ))}
                    </div>
                  </div>
                  <span className="c1pa-lbl">{c.label}</span>
                  {hover === c.key && c.sum > 0 && (
                    <div className="c1pa-tip" role="tooltip">
                      <b>{c.overdue ? 'Overdue (unpaid)' : c.label} · {rupee(c.sum)}</b>
                      {schemes.filter((sc) => c.by[sc]).map((sc) => (
                        <span key={sc}><i className={colorOf(sc)} />{sc}<em>{rupee(c.by[sc])}</em></span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="c1pa-legend">
          {schemes.filter((s) => columns.some((c) => c.by[s])).map((s) => (
            <span key={s}><i className={colorOf(s)} />{s} <b>{inrShort(columns.reduce((t, c) => t + (c.by[s] || 0), 0))}</b></span>
          ))}
        </div>
      </>}
    </DashCard>
  );
}
