'use client';
// Closing an investment, step by step — the figures first, then what to save.
//   RedeemModal         before maturity: how much is coming out decides the rest.
//                       The withdrawn part earns the scheme's premature rate for the
//                       months held; anything left behind keeps its normal return and
//                       maturity date. Enter the full principal and the investment
//                       closes. Either way it goes for approval with a signed LOI —
//                       one button, one dialog, the figure decides.
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
import { downloadInvestorLOI } from '../../lib/investorLOI';
import { earlierTerms } from '../../lib/c1History';
import { useCurrentCompany } from '../../lib/currentCompany';

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

// The working for a proposed partial redemption, as of a date and an amount.
function useRedeemQuote(investorId, amount, on) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!amount || Number(amount) <= 0) { setData(null); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      apiFetch(CLUB1000_ENDPOINTS.investorRedeemQuote(investorId, amount, on))
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!alive) return;
          if (r.ok) { setData(d); setErr(''); } else setErr(errText(d, 'Could not work out the figures.'));
        })
        .catch(() => alive && setErr('Could not reach the server.'));
    }, 300);                                   // typing an amount should not spam the API
    return () => { alive = false; clearTimeout(t); };
  }, [investorId, amount, on]);
  return [data, err];
}

export function RedeemModal({ investor, scheme, onClose, onDone }) {
  const issuer = useCurrentCompany();
  const today = todayIST();
  const [on, setOn] = useState(today);
  const [amount, setAmount] = useState(String(Number(investor.amount_invested) || ''));
  const [notes, setNotes] = useState('');
  const [q, loadErr] = useRedeemQuote(investor.id, amount, on);
  const [loiDone, setLoiDone] = useState(false);
  const [loiBusy, setLoiBusy] = useState(false);
  const [loiFile, setLoiFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function pickLoi(e) {
    const file = e.target.files?.[0];
    if (!file) { setLoiFile(null); return; }
    const reader = new FileReader();
    reader.onload = () => setLoiFile({ name: file.name, type: file.type, data: reader.result.split(',')[1] });
    reader.readAsDataURL(file);
  }

  // The LOI carries the whole working, so what is signed and what is saved are
  // the same figures.
  async function getLoi() {
    setErr(''); setLoiBusy(true);
    try {
      // The schedule, maturity value and "interest a day" basis are all read
      // off amount_invested, so the LOI is built against what STAYS invested.
      // Handing it the investor unchanged printed the pre-redemption principal
      // and a schedule for money that is being taken out.
      const continuing = { ...investor, amount_invested: q.remaining_principal };
      // Earlier terms, the way the renewal LOI shows them — a redemption is a
      // point in this investment's history and the paper should show the rest
      // of it.
      // Always fetched now, not only for renewed investments: a first-term
      // investment can still have earlier redemptions to list.
      const past = await earlierTerms(investor.id);
      await downloadInvestorLOI(continuing, scheme, {
        companyName: issuer.name, companyLogoUrl: issuer.logoUrl, redemption: q,
        ...(past.history?.length ? { history: past.history } : {}),
        ...(past.redemptions?.length ? { pastRedemptions: past.redemptions } : {}),
      });
      setLoiDone(true);
    } catch (_) {
      setErr('Could not generate the LOI. Please try again.');
    } finally {
      setLoiBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!q || !q.can_redeem) return;
    if (!loiFile) { setErr('Download the redemption LOI, get it signed, and upload it before submitting.'); return; }
    setBusy(true); setErr('');
    const res = await apiFetch(CLUB1000_ENDPOINTS.investorRedeemRequest(investor.id), {
      method: 'POST',
      body: JSON.stringify({ amount, redemption_date: on, notes, loi_file: loiFile }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = res ? await res.json().catch(() => ({})) : {};
      setErr(errText(d, 'Could not submit the redemption.'));
      return;
    }
    notify(`Redemption of ${rupee(amount)} sent for approval`, 'success');
    onDone();
  }

  const blocked = q && !q.can_redeem;
  return (
    <C1Modal title="Redeem part of this investment"
      sub={`${investor.name} · ${investor.scheme_name || ''}${investor.loi_no ? ` · ${investor.loi_no}` : ''}`}
      onClose={onClose} onSubmit={submit}
      footer={<>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="nx-btn nx-btn-md nx-btn-warning" disabled={busy || !q || blocked || !loiFile}>
          {busy ? 'Submitting…' : 'Submit for approval'}
        </button>
      </>}>
      <C1Error>{loadErr}</C1Error>

      <C1Section title="1 · How much is coming out">
        <C1Field label="Currently invested"><C1Value>{rupee(investor.amount_invested)}</C1Value></C1Field>
        <C1Field label="Amount to redeem (₹)" required hint="The principal being taken out — the rest stays invested">
          <input className="nx-input" type="text" inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
        </C1Field>
        <C1Field label="Redemption date" required hint="Today or earlier">
          <input className="nx-input" type="date" max={today} min={investor.investment_date}
            value={on} onChange={(e) => setOn(e.target.value || today)} />
        </C1Field>
      </C1Section>

      {!q && !loadErr ? <Loader size="sm" /> : null}
      {blocked ? <div className="nx-note warn c1-error">{q.blocked_reason}</div> : null}

      {q && !blocked && (
        <>
          <C1Section title="2 · The working">
            <div className="c1c-calc">
              <div><span>Principal redeemed</span><b>{rupee(q.redeem_amount)}</b></div>
              <div>
                <span>+ Premature interest <small>{q.days_held} days × {rupee(q.daily_interest)} a day
                  — {Number(q.rate_per_month)}% a month on the redeemed amount, by the day</small></span>
                <b>{rupee(q.premature_interest)}</b>
              </div>
              <div className="total"><span>Payable</span><b>{rupee(q.payable)}</b></div>
            </div>
            {Number(q.interest_paid_share) > 0 && (
              <div className="c1-help">
                {rupee(q.interest_paid_share)} of interest has already been paid on this share at the
                normal rate. It is not deducted here — the payable above is principal plus premature interest.
              </div>
            )}
          </C1Section>

          <C1Section title={q.is_full ? '3 · Nothing stays invested' : '3 · What stays invested'}>
            {q.is_full ? (
              <div className="c1-help">The whole investment is being redeemed, so it will be closed once approved.</div>
            ) : (
              <>
                <C1Field label="Remaining principal"><C1Value>{rupee(q.remaining_principal)}</C1Value></C1Field>
                <C1Field label="Carries on at"><C1Value>{Number(q.normal_return_pct)}% · matures {formatDMY(q.maturity_date)}</C1Value></C1Field>
                <div className="c1-help">
                  The part left behind is not penalised: it keeps the scheme&apos;s normal return and its
                  original maturity date. Only its payout schedule is resized to the smaller principal.
                </div>
              </>
            )}
          </C1Section>

          <C1Section title="4 · Sign off">
            <C1Field label="Reason / remarks">
              <input className="nx-input" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Why the investor is taking money out early" />
            </C1Field>
            <button type="button" className="nx-btn nx-btn-md nx-btn-secondary c1c-loi-btn"
              onClick={getLoi} disabled={loiBusy}>
              {loiBusy ? 'Generating…' : 'Download redemption LOI'}
            </button>
            {loiDone && <div className="c1-help ok">LOI downloaded — get it signed and upload it below.</div>}
            <C1Field label="Upload signed LOI" required>
              <input type="file" accept="image/*,.pdf" onChange={pickLoi} />
            </C1Field>
            {loiFile && <div className="c1-help ok">Selected: {loiFile.name}</div>}
            <div className="c1-help">
              A redemption changes what is owed, so it goes to an approver. Nothing moves until it is approved.
            </div>
          </C1Section>
        </>
      )}
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
// The term that ended, and how he is renewing it — four plain choices that fill in
// the new amount. Its unpaid interest (quarterly instalments still due, or an
// at-maturity scheme's interest inside the maturity payout) is paid to him or goes
// into the renewal; money he takes beyond the interest is principal paid back;
// money he adds is fresh money.
export function RenewalSummary({ investorId, newAmount, onRenewal, payNow, onPayNow }) {
  const [st] = useSettlement(investorId);
  const [how, setHow] = useState('');        // all | interest_out | take | more — '' = amount typed by hand
  const [take, setTake] = useState('');
  const [extra, setExtra] = useState('');
  // Hold its place while the figures load — appearing late it pushed the form down.
  if (!st) return <C1Section title="The term that ended"><div className="c1r-wait"><Loader size="sm" /></div></C1Section>;
  const principal = Number(st.principal) || 0;
  const atMaturity = st.pending.filter((p) => p.payout_type === 'maturity').reduce((t, p) => t + (Number(p.amount_due) || 0), 0);
  const unpaid = Math.round((st.pending.filter((p) => p.payout_type === 'interest').reduce((t, p) => t + (Number(p.amount_due) || 0), 0)
    + Math.max(atMaturity - principal, 0)) * 100) / 100;
  const plan = (mode, t = take, e = extra) => {
    const tk = mode === 'interest_out' ? unpaid : mode === 'take' ? Math.max(Number(t) || 0, 0) : 0;
    const ex = mode === 'more' ? Math.max(Number(e) || 0, 0) : 0;
    const added = Math.max(unpaid - tk, 0);
    return { amount: Math.max(Math.round((principal + unpaid + ex - tk) * 100) / 100, 0), added };
  };
  const choose = (mode, t = take, e = extra) => {
    setHow(mode);
    const p = plan(mode, t, e);
    onRenewal && onRenewal({ amount: p.amount, interest_added: p.added, interest_choice: p.added > 0 ? 'reinvest' : 'pay' });
  };
  // What actually happens with the amount on the form.
  const next = Number(newAmount) || 0;
  // An amount typed by hand, not one of the choices: interest goes in first.
  const custom = !how || Math.abs(plan(how).amount - next) > 0.5;
  const added = custom ? Math.min(unpaid, Math.max(next - principal, 0)) : plan(how).added;
  const toHim = Math.max(unpaid - added, 0);
  const back = Math.max(principal - next, 0);
  const fresh = Math.max(next - principal - added, 0);
  const OPTS = [
    ['all', 'Renew everything', `principal + interest → ${rupee(principal + unpaid)}`],
    ['interest_out', 'He takes the interest, principal renewed', `${rupee(unpaid)} paid to him → ${rupee(principal)}`],
    ['take', 'He takes some money out', 'enter how much he takes'],
    ['more', 'Renew everything and he adds more', 'enter the extra he adds'],
  ];
  return (
    <C1Section title="The term that ended">
      <div className="c1c-calc">
        <div><span>Principal of the term</span><b>{rupee(principal)}</b></div>
        <div><span>Interest paid so far</span><b>{rupee(st.interest_paid)}</b></div>
        <div><span>Interest still unpaid</span><b>{rupee(unpaid)}</b></div>
        <div className="total"><span>Principal + unpaid interest</span><b>{rupee(principal + unpaid)}</b></div>
      </div>
      {onRenewal && (
        <div className="c1r-how">
          <span className="c1r-how-q">How is he renewing?</span>
          {OPTS.map(([k, label, hint]) => (
            <div key={k} className={`c1r-opt${!custom && how === k ? ' is-on' : ''}`}>
              <label>
                <input type="radio" name="renew-how" checked={!custom && how === k} onChange={() => choose(k)} />
                <b>{label}</b><small>{hint}</small>
              </label>
              {how === 'take' && k === 'take' && (
                <input className="nx-input c1r-opt-amt" inputMode="decimal" placeholder="Amount he takes (₹)" value={take}
                  onChange={(e) => { setTake(e.target.value); choose('take', e.target.value); }} />
              )}
              {how === 'more' && k === 'more' && (
                <input className="nx-input c1r-opt-amt" inputMode="decimal" placeholder="Extra he adds (₹)" value={extra}
                  onChange={(e) => { setExtra(e.target.value); choose('more', take, e.target.value); }} />
              )}
            </div>
          ))}
        </div>
      )}
      {next > 0 && (
        <div className="c1c-calc c1r-out">
          <div className="total"><span>New amount invested</span><b>{rupee(next)}</b></div>
          <div><span>Principal renewed</span><b>{rupee(Math.min(next, principal))}</b></div>
          {added > 0 && <div><span>Interest added into the renewal</span><b>{rupee(added)}</b></div>}
          {fresh > 0 && <div><span>Fresh money he adds</span><b>{rupee(fresh)}</b></div>}
          {toHim > 0 && <div><span>Interest paid to him</span><b>{rupee(toHim)}</b></div>}
          {back > 0 && <div><span>Principal paid back to him</span><b>{rupee(back)}</b></div>}
        </div>
      )}
      {next > 0 && (toHim + back) > 0 && onPayNow && (
        <div className="c1r-settle">
          <span>The {rupee(toHim + back)} he takes is <b>paid to him at the renewal</b> — this term is settled and nothing from it stays due.</span>
          <input className="nx-input" placeholder="UTR / cheque no. (optional)" value={payNow?.notes || ''}
            onChange={(e) => onPayNow({ notes: e.target.value })} />
        </div>
      )}
    </C1Section>
  );
}
