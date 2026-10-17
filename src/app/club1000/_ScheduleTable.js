'use client';
// The payout schedule in the Add / Revise / Renew forms. Read first, edit only when
// needed: three headline figures (interest a day, total interest, at maturity),
// then one line per payout — its date as a calendar chip, the financial-year
// quarter it pays for with the dates and days it covers, a bar for its share of
// the term, and the amount with its working. ✎ opens a line's date and amount.
import { useState } from 'react';
import { perDayInterest, tenureDays } from '../../lib/c1Periods';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const inr = (n, d = 2) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: d ? 2 : 0, maximumFractionDigits: d });
const parts = (iso) => {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  return y ? { y, m, d } : null;
};
// "18 Oct – 31 Dec 2026", or "18 Oct 2026 – 10 Jan 2027" across years.
function span(from, to) {
  const a = parts(from); const b = parts(to);
  if (!a || !b) return '';
  return a.y === b.y
    ? `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`
    : `${a.d} ${MONTHS[a.m - 1]} ${a.y} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
}

function DateChip({ iso, principal }) {
  const p = parts(iso);
  return (
    <div className={`c1sc-chip${principal ? ' principal' : ''}`}>
      <b>{p ? p.d : '—'}</b>
      <span>{p ? `${MONTHS[p.m - 1]} ${String(p.y).slice(2)}` : ''}</span>
    </div>
  );
}

export default function ScheduleTable({ schedule, periods, principal, pct, from, to, renderDate, onAmount, onReset }) {
  const [editing, setEditing] = useState(null);
  const perDay = perDayInterest(principal, pct, from, to);
  const days = tenureDays(from, to);
  const interestRows = schedule.filter((r) => r.payout_type !== 'maturity');
  const totalInterest = interestRows.reduce((t, r) => t + (Number(r.amount_due) || 0), 0);
  const anyEdited = schedule.some((r, i) => periods[i] && Math.abs(Number(r.amount_due) - periods[i].computed) > 0.5);

  return (
    <div className="c1sc">
      <div className="c1sc-stats">
        <div>
          <span>Interest a day</span>
          <b>₹{inr(perDay)}</b>
          <small>₹{inr(principal, 0)} × {Number(pct) || 0}% ÷ {days} days</small>
        </div>
        <div>
          <span>Total interest</span>
          <b>₹{inr(totalInterest, 0)}</b>
          <small>{interestRows.length} payout{interestRows.length === 1 ? '' : 's'} · {days} days</small>
        </div>
        <div className="good">
          <span>At maturity</span>
          <b>₹{inr(totalInterest + (Number(principal) || 0), 0)}</b>
          <small>principal + interest</small>
        </div>
      </div>

      <div className="c1sc-list">
        {schedule.map((row, idx) => {
          const per = periods[idx];
          const isPrincipal = row.payout_type === 'maturity';
          const edited = per && Math.abs(Number(row.amount_due) - per.computed) > 0.5;
          const [q, part] = per ? per.label.split(' (') : [];
          const open = editing === idx;
          const share = per && days ? Math.max(2, Math.round((per.days / days) * 100)) : 0;
          return (
            <div key={idx} className={`c1sc-row${isPrincipal ? ' principal' : ''}${edited ? ' edited' : ''}${open ? ' open' : ''}`}>
              <DateChip iso={row.due_date} principal={isPrincipal} />
              <div className="c1sc-what">
                <div className="c1sc-title">
                  <b>{isPrincipal ? 'Principal returned' : q || 'Interest'}</b>
                  {part ? <em>Part quarter</em> : null}
                </div>
                {per && <div className="c1sc-sub">{span(per.from, per.to)} · <strong>{per.days} days</strong></div>}
                {isPrincipal && <div className="c1sc-sub">The amount invested, paid back with the last interest</div>}
                {per && (
                  <div className="c1sc-bar" title={`${per.days} of ${days} days`}>
                    <i style={{ width: `${share}%` }} />{/* inline-ok: the period's share of the term */}
                  </div>
                )}
              </div>
              <div className="c1sc-amt">
                <b>₹{inr(row.amount_due)}</b>
                {per && <small className={edited ? 'edited' : ''}>{edited ? `edited · worked out ₹${inr(per.computed)}` : `${per.days} × ₹${inr(perDay)}`}</small>}
              </div>
              <button type="button" className={`c1sc-edit${open ? ' on' : ''}`} onClick={() => setEditing(open ? null : idx)}
                aria-label={open ? 'Done' : 'Edit this payout'} title={open ? 'Done' : 'Edit date or amount'}>
                {open ? '✓' : '✎'}
              </button>
              {open && (
                <div className="c1sc-editor">
                  <label><span>Payout date</span>{renderDate(row, idx)}</label>
                  <label>
                    <span>Amount (₹)</span>
                    <input className="nx-input" type="number" step="0.01" value={row.amount_due} autoFocus
                      onChange={(e) => onAmount(idx, e.target.value)}
                      onBlur={(e) => { const v = Number(e.target.value); if (e.target.value !== '' && !Number.isNaN(v)) onAmount(idx, v.toFixed(2)); }} />
                  </label>
                  {per && <button type="button" className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => onAmount(idx, per.computed.toFixed(2))}>Use ₹{inr(per.computed)}</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {anyEdited && (
        <div className="c1sc-actions">
          <span>Some amounts differ from the working.</span>
          <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => { setEditing(null); onReset(); }}>↺ Reset all to worked-out amounts</button>
        </div>
      )}
    </div>
  );
}
