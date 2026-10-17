'use client';
// One person's whole relationship with the club: every investment under their number
// and name (each renewal counted), the schemes it is spread over, what is active and
// what was ever put in, payouts made and still due, and the people they brought in.
import { useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { errText } from '../../lib/apiError';
import Loader from '../../components/Loader';
import { fmtMoney } from './_StatCard';
import { C1Modal, C1Section, C1Error } from './_Form';

const STATUS = { active: 'Active', matured: 'Matured', redeemed: 'Redeemed', premature_redeemed: 'Redeemed early' };
const PAYOUT = { maturity: 'At maturity', monthly: 'Monthly', quarterly: 'Quarterly', half_yearly: 'Half-yearly', yearly: 'Yearly' };

export function PortfolioStats({ p }) {
  return (
    <div className="c1hx-stats c1pf-stats">
      <div><span>Times invested</span><b>{p.times_invested}</b>
        <small>{p.investments} investment{p.investments === 1 ? '' : 's'}{p.renewals ? ` + ${p.renewals} renewal${p.renewals === 1 ? '' : 's'}` : ''}</small></div>
      <div><span>Schemes</span><b>{p.schemes.length}</b><small>{p.schemes.map((s) => s.scheme).join(', ') || '—'}</small></div>
      <div><span>Active now</span><b>{fmtMoney(p.active_amount)}</b><small>Ever invested {fmtMoney(p.total_invested)}</small></div>
      <div><span>Paid out</span><b>{fmtMoney(p.paid_out)}</b><small>Interest {fmtMoney(p.interest_paid)}</small></div>
      <div className={Number(p.due_now) > 0 ? 'is-due' : ''}><span>Still to pay</span><b>{fmtMoney(p.pending_payouts)}</b>
        <small>{Number(p.due_now) > 0 ? `${fmtMoney(p.due_now)} due now` : 'Nothing due today'}</small></div>
      <div><span>People referred</span><b>{p.referrals}</b><small>Rewards {fmtMoney(p.rewards_earned)} · paid {fmtMoney(p.rewards_paid)}</small></div>
    </div>
  );
}

export default function PortfolioModal({ investorId, onClose }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');

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

  const totalEver = p ? Number(p.total_invested) || 1 : 1;
  return (
    <C1Modal wide title="Investor Portfolio" badge={p?.awaiting_approval ? `${p.awaiting_approval} awaiting approval` : null}
      sub={p ? `${p.name} · ${p.phone}${p.since ? ` · Investing since ${formatDMY(p.since)}` : ''}` : ''} onClose={onClose}
      footer={<button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Close</button>}>
      {!p && !err && <Loader size="sm" />}
      <C1Error>{err}</C1Error>
      {p && <>
        <PortfolioStats p={p} />

        <C1Section title="By scheme">
          {p.schemes.length === 0 ? <div className="c1-help">No approved investments yet.</div> : (
            <div className="c1pf-schemes">
              {p.schemes.map((s) => (
                <div key={s.scheme} className="c1pf-scheme">
                  <div className="c1pf-scheme-top">
                    <b>{s.scheme}</b>
                    <span>{s.count} investment{s.count === 1 ? '' : 's'} · active {fmtMoney(s.active)} · ever {fmtMoney(s.total)}</span>
                  </div>
                  <div className="c1pf-bar"><i style={{ width: `${Math.max(2, (Number(s.total) / totalEver) * 100)}%` }} /></div>{/* inline-ok: share of everything invested */}
                </div>
              ))}
            </div>
          )}
        </C1Section>

        <C1Section title={`Investments (${p.history.length})`}>
          <div className="c1pf-scroll">
            <table className="nx-table c1-table c1pf-table">
              <thead><tr><th>Investment</th><th>Amount</th><th>Term</th><th>Paid out</th><th>To pay</th><th>Status</th></tr></thead>
              <tbody>
                {p.history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <div className="c1-strong">{h.scheme}{h.renewal_count ? <span className="c1pf-tag">Renewed {h.renewal_count}×</span> : null}</div>
                      <div className="c1pf-phone">{[h.loi_no, PAYOUT[h.interest_payout] || h.interest_payout, h.return_pct ? `${Number(h.return_pct)}%` : ''].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="c1-strong">{fmtMoney(h.amount)}</td>
                    <td className="c1pf-nowrap">{formatDMY(h.investment_date)}<div className="c1pf-phone">to {formatDMY(h.maturity_date)}</div></td>
                    <td>{fmtMoney(h.paid_out)}</td>
                    <td>{fmtMoney(h.pending)}</td>
                    <td><span className={`c1pf-st ${h.approval_status === 'pending' ? 'wait' : h.status}`}>
                      {h.approval_status === 'pending' ? 'Awaiting approval' : (STATUS[h.status] || h.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </C1Section>

        <C1Section title={`People referred (${p.referred.length})`}>
          {p.referred.length === 0 ? <div className="c1-help">Nobody has joined with {p.name} as their reference yet.</div> : (
            <div className="c1pf-scroll">
              <table className="nx-table c1-table c1pf-table">
                <thead><tr><th>Name</th><th>Scheme</th><th>Invested</th><th>On</th><th>Reward</th></tr></thead>
                <tbody>
                  {p.referred.map((r) => (
                    <tr key={r.id}>
                      <td className="c1-strong">{r.name}<div className="c1pf-phone">{r.phone}</div></td>
                      <td>{r.scheme}</td>
                      <td>{fmtMoney(r.amount)}</td>
                      <td>{formatDMY(r.investment_date)}</td>
                      <td>{r.reward_status ? <>{fmtMoney(r.reward)} <span className={`c1r-status ${r.reward_status}`}>{r.reward_status === 'paid' ? 'Paid' : 'Pending'}</span></> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </C1Section>
      </>}
    </C1Modal>
  );
}
