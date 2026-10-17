'use client';
// One mobile number's whole relationship with the club, in a side panel: every
// investment under it (each renewal counted), the schemes, what is active and
// was ever put in, payouts made and still due, and the people it brought in.
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { errText } from '../../lib/apiError';
import Icon from '../../components/Icon';
import Loader from '../../components/Loader';
import { fmtMoney } from './_StatCard';

const STATUS = { active: 'Active', matured: 'Matured', redeemed: 'Redeemed', premature_redeemed: 'Redeemed early' };
const PAYOUT = { maturity: 'At maturity', monthly: 'Monthly', quarterly: 'Quarterly', half_yearly: 'Half-yearly', yearly: 'Yearly' };

// Initials on a tone picked from the number, so a person keeps their colour.
export function Avatar({ name, seed, big = false }) {
  const words = String(name || '?').replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
  const ini = ((words[0] || '?')[0] + (words[1] ? words[1][0] : '')).toUpperCase();
  const n = String(seed || name || '').split('').reduce((t, c) => t + c.charCodeAt(0), 0) % 6;
  return <span className={`c1pf-av t${n + 1}${big ? ' big' : ''}`}>{ini}</span>;
}

const yearsSince = (d) => {
  if (!d) return '';
  const y = (Date.now() - new Date(d).getTime()) / (365.25 * 864e5);
  return y >= 1 ? `${Math.floor(y)} yr${Math.floor(y) === 1 ? '' : 's'}` : `${Math.max(1, Math.floor(y * 12))} mo`;
};

export default function PortfolioModal({ investorId, onClose }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('investments');
  const [allNames, setAllNames] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch(CLUB1000_ENDPOINTS.investorPortfolio(investorId))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setP(d); else setErr(errText(d, 'Could not load the portfolio.'));
      })
      .catch(() => alive && setErr('Could not reach the server.'));
    return () => { alive = false; };
  }, [investorId]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const paid = p ? Number(p.paid_out) : 0;
  const toPay = p ? Number(p.pending_payouts) : 0;
  const paidPct = paid + toPay > 0 ? (paid / (paid + toPay)) * 100 : 0;
  const ever = p ? Number(p.total_invested) || 1 : 1;
  const TABS = p ? [['investments', `Investments · ${p.history.length}`], ['referrals', `Referred · ${p.referred.length}`], ['schemes', `Schemes · ${p.schemes.length}`]] : [];

  return (
    <div className="c1pf-back" onClick={onClose}>
      <aside className="c1pf-panel" onClick={(e) => e.stopPropagation()} aria-label="Investor portfolio">
        <button type="button" className="nx-btn nx-btn-md nx-icon-btn nx-btn-ghost c1pf-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        {!p && !err && <div className="c1pf-pad"><Loader size="sm" /></div>}
        {err && <div className="c1pf-pad"><div className="nx-note bad">{err}</div></div>}
        {p && <>
          <div className="c1pf-hero">
            <Avatar name={p.name} seed={p.phone} big />
            <div className="c1pf-hero-txt">
              <h2>{p.name}</h2>
              <div>{p.phone}{p.email ? ` · ${p.email}` : ''}</div>
              {p.since && <div>Investing since {formatDMY(p.since)} · {yearsSince(p.since)}</div>}
              {p.names?.length > 1 && (
                <div className="c1pf-names">Also under this number: {p.names.slice(1, allNames ? undefined : 5).map((n) => <em key={n}>{n}</em>)}
                  {p.names.length > 5 && (
                    <button type="button" className="c1pf-morebtn" onClick={() => setAllNames((v) => !v)}>{allNames ? 'Show less' : `+${p.names.length - 5} more`}</button>
                  )}
                </div>
              )}
              {p.awaiting_approval > 0 && <div className="c1pf-await">{p.awaiting_approval} investment{p.awaiting_approval === 1 ? '' : 's'} awaiting approval</div>}
            </div>
          </div>

          <div className="c1pf-big3">
            <div><span>Active now</span><b>{fmtMoney(p.active_amount)}</b></div>
            <div><span>Ever invested</span><b>{fmtMoney(p.total_invested)}</b></div>
            <div><span>Times invested</span><b>{p.times_invested}×</b>
              <small>{p.investments} investment{p.investments === 1 ? '' : 's'}{p.renewals ? ` + ${p.renewals} renewed` : ''}</small></div>
          </div>

          <div className="c1pf-money">
            <div className="c1pf-pi">
              <span /><span>Principal</span><span>Interest</span><span>Total</span>
              <span>Amount</span><b>{fmtMoney(p.principal_total)}</b><b>{fmtMoney(p.interest_total)}</b><b>{fmtMoney(Number(p.principal_total) + Number(p.interest_total))}</b>
              <span>Paid out</span><b className="ok">{fmtMoney(p.principal_paid)}</b><b className="ok">{fmtMoney(p.interest_paid)}</b><b className="ok">{fmtMoney(paid)}</b>
              <span>Still to pay</span><b>{fmtMoney(p.principal_pending)}</b><b>{fmtMoney(p.interest_pending)}</b><b>{fmtMoney(toPay)}</b>
            </div>
            <div className="c1pf-split"><i style={{ width: `${paidPct}%` }} /></div>{/* inline-ok: paid share of all payouts */}
            {Number(p.due_now) > 0
              ? <div className="c1pf-duenote"><Icon name="clock" /> {fmtMoney(p.due_now)} is due now — date passed, not yet paid</div>
              : <div className="c1pf-okdue"><Icon name="check-circle" /> Nothing due today</div>}
            <div className="c1pf-refline"><Icon name="users" /> Brought in <b>{p.referrals}</b> {p.referrals === 1 ? 'person' : 'people'} · rewards {fmtMoney(p.rewards_earned)} (paid {fmtMoney(p.rewards_paid)})</div>
          </div>

          <div className="c1pf-tabs" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>

          <div className="c1pf-pad">
            {tab === 'investments' && p.history.map((h) => {
              const wait = h.approval_status === 'pending';
              return (
                <div key={h.id} className="c1pf-inv">
                  <div className="c1pf-inv-date"><b>{formatDMY(h.investment_date).slice(0, 5)}</b><small>{String(h.investment_date).slice(0, 4)}</small></div>
                  <div className="c1pf-inv-body">
                    <div className="c1pf-inv-top">
                      <b>{h.scheme}</b>
                      {h.renewal_count > 0 && <em className="c1pf-tag">Renewed {h.renewal_count}×</em>}
                      <span className={`c1pf-st ${wait ? 'wait' : h.status}`}>{wait ? 'Awaiting approval' : (STATUS[h.status] || h.status)}</span>
                    </div>
                    <div className="c1pf-inv-sub">
                      {[p.names?.length > 1 ? h.name : '', h.loi_no, PAYOUT[h.interest_payout] || h.interest_payout, h.return_pct ? `${Number(h.return_pct)}%` : '',
                        `matures ${formatDMY(h.maturity_date)}`].filter(Boolean).join(' · ')}
                      {h.renewal_count > 0 && h.first_invested_on && h.first_invested_on !== h.investment_date ? ` · first in ${formatDMY(h.first_invested_on)}` : ''}
                    </div>
                    {h.past_terms?.length > 0 && (
                      <div className="c1pf-terms">
                        {h.past_terms.map((t, n) => (
                          <span key={t.start}>Term {n + 1} · {formatDMY(t.start)} · <b>{fmtMoney(t.principal)}</b> → renewed with {fmtMoney(t.renewed_with)}
                            {Number(t.taken_out) > 0 ? ` · ${fmtMoney(t.taken_out)} taken out` : Number(t.taken_out) < 0 ? ` · ${fmtMoney(-Number(t.taken_out))} added` : ''}</span>
                        ))}
                        <span>Now · {formatDMY(h.investment_date)} · <b>{fmtMoney(h.amount)}</b></span>
                      </div>
                    )}
                    <div className="c1pf-inv-nums">
                      <span>Principal <b>{fmtMoney(h.principal)}</b></span>
                      <span>Interest <b>{fmtMoney(h.interest)}</b></span>
                    </div>
                    <div className="c1pf-inv-nums">
                      <span>Paid · principal <b>{fmtMoney(h.principal_paid)}</b> · interest <b>{fmtMoney(h.interest_paid)}</b></span>
                      <span>To pay · principal <b>{fmtMoney(h.principal_pending)}</b> · interest <b>{fmtMoney(h.interest_pending)}</b></span>
                    </div>
                  </div>
                </div>
              );
            })}

            {tab === 'referrals' && (p.referred.length === 0
              ? <div className="c1-help">Nobody has joined with this number as their reference yet.</div>
              : p.referred.map((r) => (
                <div key={r.id} className="c1pf-refrow">
                  <Avatar name={r.name} seed={r.phone} />
                  <div className="c1pf-refrow-txt">
                    <b>{r.name}</b>
                    <small>{r.phone} · {r.scheme} · joined {formatDMY(r.investment_date)}</small>
                  </div>
                  <div className="c1pf-refrow-amt">
                    <b>{fmtMoney(r.amount)}</b>
                    {r.reward_status
                      ? <small>reward {fmtMoney(r.reward)} <span className={`c1r-status ${r.reward_status}`}>{r.reward_status === 'paid' ? 'Paid' : 'Pending'}</span></small>
                      : <small>no reward</small>}
                  </div>
                </div>
              )))}

            {tab === 'schemes' && p.schemes.map((s) => (
              <div key={s.scheme} className="c1pf-scheme">
                <div className="c1pf-scheme-top">
                  <b>{s.scheme}</b>
                  <span>{s.count} investment{s.count === 1 ? '' : 's'} · active {fmtMoney(s.active)} · ever {fmtMoney(s.total)}</span>
                </div>
                <div className="c1pf-bar"><i style={{ width: `${Math.max(2, (Number(s.total) / ever) * 100)}%` }} /></div>{/* inline-ok: share of everything invested */}
              </div>
            ))}
          </div>
        </>}
      </aside>
    </div>
  );
}
