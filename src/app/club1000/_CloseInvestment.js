'use client';
// Closing an investment, step by step — the figures first, then what to save.
//   RedeemModal         before maturity: principal + redemption interest − interest
//                       already paid = payable; date, amount, remarks, pay now or later.
//   MaturityPayoutModal at maturity: every pending payout (principal and any unpaid
//                       interest) with target / actual paid / paid on / remarks;
//                       the ticked ones are paid and the investment is closed.
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { rupee } from '../../lib/inr';
import { notify } from '../../lib/notify';
import { errText } from '../../lib/apiError';
import Loader from '../../components/Loader';
import { C1Modal, C1Section, C1Field, C1Value, C1Error } from './_Form';

const TYPE_LABELS = { interest: 'Interest', maturity: 'Principal', premature_redemption: 'Redemption' };
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// The settlement figures for one investor, as of a date.
function useSettlement(investorId, on) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    apiFetch(CLUB1000_ENDPOINTS.investorSettlement(investorId, on))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) { setData(d); setErr(''); } else setErr(errText(d, 'Could not work out the figures.'));
      })
      .catch(() => alive && setErr('Could not reach the server.'));
    return () => { alive = false; };
  }, [investorId, on]);
  return [data, err];
}

export function RedeemModal({ investor, onClose, onDone }) {
  const today = todayIST();
  const [on, setOn] = useState(today);
  const [st, loadErr] = useSettlement(investor.id, on);
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [payNow, setPayNow] = useState(false);
  const [paidOn, setPaidOn] = useState(today);
  const [payRemarks, setPayRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // The payable follows the working until someone types their own figure.
  useEffect(() => { if (st && !touched) setAmount(String(Number(st.payable) || 0)); }, [st, touched]);

  async function submit(e) {
    e.preventDefault();
    if (amount === '' || Number.isNaN(Number(amount)) || Number(amount) < 0) { setErr('Enter the amount payable.'); return; }
    if (payNow && (!paidOn || paidOn > today)) { setErr('The paid date must be today or earlier.'); return; }
    setBusy(true); setErr('');
    const body = { redemption_date: on, amount, notes };
    if (payNow) body.pay_now = { paid_date: paidOn, amount, notes: payRemarks };
    const res = await apiFetch(CLUB1000_ENDPOINTS.investorRedeem(investor.id), { method: 'POST', body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = res ? await res.json().catch(() => ({})) : {};
      setErr(errText(d, 'Could not redeem.'));
      return;
    }
    notify(payNow ? `Redeemed and paid · ${rupee(amount)}` : `Redeemed · ${rupee(amount)} is now due on Payouts`, 'success');
    onDone();
  }

  const blocked = st && !st.can_redeem;
  return (
    <C1Modal title="Redeem before maturity" sub={`${investor.name} · ${investor.scheme_name || ''}${investor.loi_no ? ` · ${investor.loi_no}` : ''}`}
      onClose={onClose} onSubmit={submit}
      footer={<>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="nx-btn nx-btn-md nx-btn-warning" disabled={busy || !st || blocked}>
          {busy ? 'Saving…' : payNow ? `Redeem and pay · ${rupee(amount)}` : `Redeem · ${rupee(amount)}`}
        </button>
      </>}>
      {!st && !loadErr ? <Loader size="sm" /> : null}
      <C1Error>{loadErr}</C1Error>
      {st && <>
        <C1Section title="1 · The investment">
          <C1Field label="Principal"><C1Value>{rupee(st.principal)}</C1Value></C1Field>
          <C1Field label="Invested on"><C1Value>{formatDMY(st.investment_date)} · matures {formatDMY(st.maturity_date)}</C1Value></C1Field>
          <C1Field label="Redemption date" required hint="Today or earlier">
            <input className="nx-input" type="date" max={today} min={st.investment_date} value={on} onChange={(e) => { setOn(e.target.value || today); setTouched(false); }} />
          </C1Field>
          <C1Field label="Held for"><C1Value>{st.months_elapsed} month{st.months_elapsed === 1 ? '' : 's'} · lock-in {st.lock_months} month{st.lock_months === 1 ? '' : 's'}{st.lock_until ? ` (free from ${formatDMY(st.lock_until)})` : ''}</C1Value></C1Field>
        </C1Section>

        {blocked ? (
          <div className="nx-note warn c1-error">{st.redeem_blocked_reason}</div>
        ) : <>
          <C1Section title="2 · The working">
            <div className="c1c-calc">
              <div><span>Principal</span><b>{rupee(st.principal)}</b></div>
              <div><span>+ Redemption interest <small>{st.months_elapsed} mo × {Number(st.rate_per_month)}% a month</small></span><b>{rupee(st.redemption_interest)}</b></div>
              <div><span>− Interest already paid</span><b>{rupee(st.interest_paid)}</b></div>
              <div className="total"><span>Payable</span><b>{rupee(st.payable)}</b></div>
            </div>
            {st.pending.length > 0 && (
              <div className="c1-help">
                The {st.pending.length} payout{st.pending.length === 1 ? '' : 's'} still scheduled ({rupee(st.pending_total)}) are replaced by this one redemption, so nothing is paid twice.
              </div>
            )}
          </C1Section>

          <C1Section title="3 · Settle">
            <C1Field label="Amount payable (₹)" required hint={touched && Number(amount) !== Number(st.payable) ? `Working says ${rupee(st.payable)}` : ''}>
              <input className="nx-input" type="text" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setTouched(true); }} />
            </C1Field>
            <C1Field label="Reason / remarks">
              <input className="nx-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why the investor is leaving early" />
            </C1Field>
            <C1Field label="Paid now?">
              <label className="c1s-opt"><input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} /> The money is paid out today — otherwise it waits on Payouts</label>
            </C1Field>
            {payNow && <>
              <C1Field label="Paid on" required>
                <input className="nx-input" type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
              </C1Field>
              <C1Field label="Payment remarks">
                <input className="nx-input" value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} placeholder="UTR / cheque no." />
              </C1Field>
            </>}
          </C1Section>
        </>}
      </>}
      <C1Error>{err}</C1Error>
    </C1Modal>
  );
}

export function MaturityPayoutModal({ investor, onClose, onDone }) {
  const today = todayIST();
  const [st, loadErr] = useSettlement(investor.id);
  const [lines, setLines] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (st && !lines) {
      setLines(Object.fromEntries(st.pending.map((p) => [p.id, { on: true, amount: String(Number(p.amount_due) || 0), date: today, notes: '' }])));
    }
  }, [st, lines, today]);

  const setLine = (id, patch) => setLines((l) => ({ ...l, [id]: { ...l[id], ...patch } }));
  const pending = st?.pending || [];
  const picked = lines ? pending.filter((p) => lines[p.id]?.on) : [];
  const total = picked.reduce((t, p) => t + (Number(lines[p.id].amount) || 0), 0);

  async function submit(e) {
    e.preventDefault();
    if (picked.some((p) => !lines[p.id].date || lines[p.id].date > today)) { setErr('Each paid date must be today or earlier.'); return; }
    setBusy(true); setErr('');
    const payments = picked.map((p) => ({ id: p.id, amount: lines[p.id].amount, paid_date: lines[p.id].date, notes: lines[p.id].notes }));
    const res = await apiFetch(CLUB1000_ENDPOINTS.investorMaturePayout(investor.id), { method: 'POST', body: JSON.stringify({ payments }) }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = res ? await res.json().catch(() => ({})) : {};
      setErr(errText(d, 'Could not close the investment.'));
      return;
    }
    notify(picked.length ? `Paid ${rupee(total)} and closed` : 'Closed — the payouts wait on Payouts', 'success');
    onDone();
  }

  const left = pending.length - picked.length;
  return (
    <C1Modal wide title="Payout at maturity" sub={`${investor.name} · ${investor.scheme_name || ''}${investor.loi_no ? ` · ${investor.loi_no}` : ''}`}
      onClose={onClose} onSubmit={submit}
      footer={<>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="nx-btn nx-btn-md nx-btn-success" disabled={busy || !st}>
          {busy ? 'Saving…' : picked.length ? `Pay ${rupee(total)} and close` : 'Close without paying now'}
        </button>
      </>}>
      {!st && !loadErr ? <Loader size="sm" /> : null}
      <C1Error>{loadErr}</C1Error>
      {st && lines && <>
        <C1Section title="1 · The investment">
          <C1Field label="Principal"><C1Value>{rupee(st.principal)}</C1Value></C1Field>
          <C1Field label="Term"><C1Value>{formatDMY(st.investment_date)} → matured {formatDMY(st.maturity_date)}</C1Value></C1Field>
          <C1Field label="Interest paid so far"><C1Value>{rupee(st.interest_paid)}</C1Value></C1Field>
          <C1Field label="Still owed"><C1Value>{rupee(st.pending_total)} · {pending.length} payout{pending.length === 1 ? '' : 's'}</C1Value></C1Field>
        </C1Section>

        <C1Section title="2 · Pay out">
          {pending.length === 0 ? <div className="c1-help">Nothing is pending — closing just marks the investment redeemed.</div> : (
            <div className="c1p-grid">
              <div className="c1p-grid-head">
                <span /><span>Payout</span><span className="num">Target</span><span>Actual paid (₹)</span><span>Paid on</span><span>Remarks</span>
              </div>
              {pending.map((p) => {
                const l = lines[p.id];
                const late = p.due_date < today;
                return (
                  <div key={p.id} className={`c1p-grid-row${l.on ? '' : ' off'}`}>
                    <input type="checkbox" checked={l.on} onChange={(e) => setLine(p.id, { on: e.target.checked })} aria-label="Pay this one now" />
                    <span className="c1p-pay-what">
                      <b>{TYPE_LABELS[p.payout_type] || p.payout_type}{p.period ? ` · ${p.period.label}` : ''}</b>
                      <span className={`c1p-pay-when${late ? ' late' : ''}`}>Due {formatDMY(p.due_date)}{late ? ' · late' : ''}</span>
                      {p.period && <span className="c1p-why">{formatDMY(p.period.from)} – {formatDMY(p.period.to)} · {p.period.days} days × ₹{Number(p.period.per_day).toLocaleString('en-IN')}/day</span>}
                    </span>
                    <span className="num c1p-target">{rupee(p.amount_due)}</span>
                    <span className="c1p-cell">
                      <input className="nx-input" type="text" inputMode="decimal" value={l.amount} disabled={!l.on} onChange={(e) => setLine(p.id, { amount: e.target.value })} />
                      {l.on && Number(l.amount) < Number(p.amount_due) - 0.5 && <small className="c1p-diff">₹{(Number(p.amount_due) - Number(l.amount)).toLocaleString('en-IN', { maximumFractionDigits: 2 })} stays due as a balance</small>}
                    </span>
                    <input className="nx-input" type="date" max={today} value={l.date} disabled={!l.on} onChange={(e) => setLine(p.id, { date: e.target.value })} />
                    <input className="nx-input" value={l.notes} disabled={!l.on} placeholder="UTR / cheque no." onChange={(e) => setLine(p.id, { notes: e.target.value })} />
                  </div>
                );
              })}
            </div>
          )}
          <div className="c1p-total">
            <span>Paying now{picked.length ? ` · ${picked.length}` : ''}</span>
            <span>{rupee(total)}</span>
          </div>
          {left > 0 && <div className="c1-help">{left} unticked payout{left === 1 ? '' : 's'} stay pending on Payouts after closing.</div>}
        </C1Section>
      </>}
      <C1Error>{err}</C1Error>
    </C1Modal>
  );
}

// The old term's position, shown at the top of the Renew dialog: what rolls over,
// what is paid out, what is fresh money — and unpaid interest that stays owed.
// What becomes of the term that ended, as the renewal is filled in. Its unpaid
// interest (quarterly instalments still due, or an at-maturity scheme's interest
// inside the maturity payout) is either paid to the investor — it stays due on
// Payouts — or added to the renewal, settled into the new principal.
export function RenewalSummary({ investorId, newAmount, choice, onChoice, onAmount }) {
  const [st] = useSettlement(investorId);
  if (!st) return null;
  const principal = Number(st.principal) || 0;
  const next = Number(newAmount) || 0;
  const unpaidRows = st.pending.filter((p) => p.payout_type === 'interest');
  const atMaturity = st.pending.filter((p) => p.payout_type === 'maturity').reduce((t, p) => t + (Number(p.amount_due) || 0), 0);
  const unpaid = unpaidRows.reduce((t, p) => t + (Number(p.amount_due) || 0), 0) + Math.max(atMaturity - principal, 0);
  const mode = choice || (next > principal ? 'reinvest' : 'pay');
  const rolled = mode === 'reinvest' ? Math.min(unpaid, Math.max(next - principal, 0)) : 0;
  const lines = [
    ['Principal of the term', rupee(principal)],
    ['Interest paid so far', rupee(st.interest_paid)],
    ['Interest still unpaid', rupee(unpaid)],
  ];
  const out = [];
  out.push(['Principal renewed', rupee(Math.min(next, principal))]);
  if (rolled > 0) out.push(['Interest added to the renewal', rupee(rolled)]);
  if (next > principal + rolled) out.push(['Fresh money added', rupee(next - principal - rolled)]);
  if (next > 0 && next < principal) out.push(['Principal paid back to him', rupee(principal - next)]);
  if (unpaid - rolled > 0) out.push(['Interest paid to him', rupee(unpaid - rolled)]);
  return (
    <C1Section title="The term that ended">
      <div className="c1c-calc">
        {lines.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
      </div>
      {unpaid > 0 && onChoice && (
        <div className="c1r-choice">
          <span>Its unpaid interest ({rupee(unpaid)})</span>
          <label className={mode === 'pay' ? 'is-on' : ''}>
            <input type="radio" name="int-choice" checked={mode === 'pay'} onChange={() => onChoice('pay')} />
            Pay it to him <small>— stays due on Payouts</small>
          </label>
          <label className={mode === 'reinvest' ? 'is-on' : ''}>
            <input type="radio" name="int-choice" checked={mode === 'reinvest'} onChange={() => onChoice('reinvest')} />
            Add it to the renewal <small>— settled into the new principal</small>
          </label>
        </div>
      )}
      {onAmount && (
        <div className="c1r-quick">
          <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => { onAmount(principal); onChoice && onChoice('pay'); }}>
            Principal only · {rupee(principal)}
          </button>
          {unpaid > 0 && (
            <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => { onAmount(Math.round((principal + unpaid) * 100) / 100); onChoice && onChoice('reinvest'); }}>
              Principal + interest · {rupee(principal + unpaid)}
            </button>
          )}
        </div>
      )}
      {next > 0 && (
        <div className="c1c-calc c1r-out">
          {out.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
        </div>
      )}
    </C1Section>
  );
}
