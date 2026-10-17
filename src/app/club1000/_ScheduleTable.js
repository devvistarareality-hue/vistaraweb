'use client';
// The payout schedule in the Add / Revise / Renew forms, as one table: each interest
// instalment's financial-year quarter, the dates it covers, its days, the working
// (days × interest a day) and its payout date and amount — both still editable.
import { formatDMY } from '../../lib/dateFormat';
import { perDayInterest, tenureDays } from '../../lib/c1Periods';

const inr = (n, d = 2) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: d });

export default function ScheduleTable({ schedule, periods, principal, pct, from, to, renderDate, onAmount, onReset }) {
  const perDay = perDayInterest(principal, pct, from, to);
  const days = tenureDays(from, to);
  const interestRows = schedule.filter((r) => r.payout_type !== 'maturity');
  const totalInterest = interestRows.reduce((t, r) => t + (Number(r.amount_due) || 0), 0);
  const totalDays = periods.reduce((t, p) => t + (p ? p.days : 0), 0);

  return (
    <div className="c1st">
      <div className="c1st-basis">
        <div>
          <span>Interest a day</span>
          <b>₹{inr(perDay)}</b>
        </div>
        <small>₹{inr(principal, 0)} × {Number(pct) || 0}% ÷ {days} days</small>
      </div>

      <div className="c1st-table">
        <div className="c1st-head">
          <span>Period</span>
          <span>Covers · working</span>
          <span className="mid">Days</span>
          <span>Payout date</span>
          <span className="num">Amount</span>
        </div>
        {schedule.map((row, idx) => {
          const per = periods[idx];
          const principalRow = row.payout_type === 'maturity';
          const edited = per && Math.abs(Number(row.amount_due) - per.computed) > 0.5;
          const [q, part] = per ? per.label.split(' (') : [];
          return (
            <div key={idx} className={`c1st-row${principalRow ? ' principal' : ''}${edited ? ' edited' : ''}`}>
              <span className="c1st-period">
                <b>{principalRow ? 'Principal' : q || 'Interest'}</b>
                {part ? <em>Part</em> : null}
              </span>
              <span className="c1st-covers">
                {principalRow ? <span>Returned at maturity</span> : per ? <>
                  <span>{formatDMY(per.from)} – {formatDMY(per.to)}</span>
                  <small className={edited ? 'edited' : ''}>
                    {edited ? `Edited · worked out ₹${inr(per.computed)}` : `${per.days} × ₹${inr(perDay)} = ₹${inr(per.computed)}`}
                  </small>
                </> : '—'}
              </span>
              <span className="mid">{per ? <span className="c1st-days">{per.days}</span> : <span className="c1st-dash">—</span>}</span>
              <span className="c1st-date">{renderDate(row, idx)}</span>
              <span className="c1st-amt">
                <i>₹</i>
                <input className="nx-input" type="number" step="0.01" value={row.amount_due}
                  onChange={(e) => onAmount(idx, e.target.value)}
                  onBlur={(e) => { const v = Number(e.target.value); if (e.target.value !== '' && !Number.isNaN(v)) onAmount(idx, v.toFixed(2)); }} />
              </span>
            </div>
          );
        })}
        <div className="c1st-foot">
          <span>Total interest</span>
          <span className="mid"><span className="c1st-days total">{totalDays || 0}</span></span>
          <span className="num"><b>₹{inr(totalInterest)}</b></span>
        </div>
        <div className="c1st-foot grand">
          <span>Principal + interest at the end</span>
          <span />
          <span className="num"><b>₹{inr(totalInterest + (Number(principal) || 0))}</b></span>
        </div>
      </div>
      <div className="c1st-actions">
        <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={onReset}>↺ Reset to worked-out amounts</button>
      </div>
    </div>
  );
}
