'use client';
import { Fragment, useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { fmtMoney } from './_StatCard';
import { notify } from '../../lib/notify';
import { settledTo, settledRemark } from '../../lib/c1Settled';
import { printStatement } from '../m/[module]/_ar';

import Loader from '../../components/Loader';
import { errText } from '../../lib/apiError';
import { C1Modal, C1Error } from './_Form';

const TYPE_COLOR = {
  investment: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  interest: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  maturity: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  premature_redemption: { bg: 'var(--warning-soft)', fg: 'var(--warning-2)' },
};
const STATUS_COLOR = {
  completed: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  paid: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  // Paid before its due date.
  'paid early': { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  // Closed by a renewal — settled into / at that renewal, not paid on its own.
  settled: { bg: 'var(--surface-2)', fg: 'var(--accent-deep)' },
  // Due and not yet paid to the investor.
  pending: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  // Not yet due.
  upcoming: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
};

// Type / status pill — the colour comes from the maps above.
function Badge({ label, color }) {
  return <span className="c1l-badge" style={{ background: color.bg, color: color.fg }}>{label.replace(/_/g, ' ')}</span>;{/* inline-ok: colour per type/status */}
}

export default function LedgerModal({ investorId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  // 'all' | 'original' | 'renewals' | 'redemptions'. Grouped rather than one
  // chip per term: a five-times-renewed investment had six chips to read
  // through, and what anyone actually asks is "the original", "the renewals"
  // or "what has been taken out".
  const [termSel, setTermSel] = useState('all');
  // Which renewal is open inside the Renewals tab. Defaults to the first one
  // through `openRenewal` below rather than an effect, so it is right on the
  // very first render instead of after a flicker.
  const [renewalSel, setRenewalSel] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(CLUB1000_ENDPOINTS.investorLedger(investorId))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.ok) setData(d); else setErr(errText(d, 'Could not load the ledger.'));
      })
      .catch((e) => !cancelled && setErr(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [investorId]);

  const inv = data?.investor;
  const terms = data?.terms || [];
  const originalTerm = terms.find((t) => t.no === 0) || null;
  const renewals = terms.filter((t) => t.no > 0);
  const hasRenewals = renewals.length > 0;
  // The renewal being shown: the one picked, else the first — "Renewal 1" is
  // open by default rather than an empty tab.
  const openRenewal = renewals.find((t) => t.no === renewalSel) || renewals[0] || null;
  const hasRedemptions = (data?.entries || []).some((e) => e.type === 'premature_redemption');
  // Original and each renewal are single terms, so each has a summary of its
  // own. "All terms" and "Redemptions" span several, and adding their
  // principals would double-count money that rolled from one into the next —
  // they show the whole investment's figures rather than an invented total.
  const term = termSel === 'original' ? originalTerm
    : termSel === 'renewals' ? openRenewal
    : null;
  const s = term ? term.summary : data?.summary;
  const first = terms[0];
  const principalHint = term ? `${term.no === 0 ? 'invested' : 'renewed'} ${formatDMY(term.start)}`
    : first ? `${terms.length > 1 ? 'first invested' : 'invested'} ${formatDMY(first.start)}`
    : inv?.investment_date ? `invested ${formatDMY(inv.investment_date)}` : '';
  const rows = (data?.entries || []).filter((e) => {
    if (e.type === 'investment') return false;
    if (termSel === 'original') return (e.term ?? 0) === 0;
    if (termSel === 'renewals') return openRenewal ? (e.term ?? 0) === openRenewal.no : false;
    if (termSel === 'redemptions') return e.type === 'premature_redemption';
    return true;
  });
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  // The statement to give the investor — the server's page, printed to PDF.
  async function statement() {
    const e = await printStatement(CLUB1000_ENDPOINTS.investorStatement(investorId), apiFetch);
    if (e) notify(e, 'error');
  }

  return (
    <C1Modal wide title={`Ledger${inv ? ` — ${inv.name}` : ''}`} sub={inv ? `${inv.phone} · ${inv.scheme_name}` : null} onClose={onClose}>
      {loading ? <Loader label="Loading…" /> : err ? <C1Error>{err}</C1Error> : (
        <>
          <div className="c1l-actions">
            <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={statement}>Statement PDF</button>
            <span>to give the investor — every term, payout and payment</span>
          </div>
          {/* A redemption on a never-renewed investment still needs its tab, so
              the strip is not gated on the term count alone. */}
          {(terms.length > 1 || hasRedemptions) && (
            <div className="c1l-terms" role="tablist">
              {/* Renewals and Redemptions appear only once there are any — an
                  investment that has simply run its course shows neither. */}
              {[
                ['all', 'All terms', true],
                ['original', 'Original', true],
                ['renewals', `Renewals (${terms.filter((t) => t.no > 0).length})`, hasRenewals],
                ['redemptions', 'Redemptions', hasRedemptions],
              ].filter(([, , show]) => show).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={termSel === key}
                  className={termSel === key ? 'is-on' : ''} onClick={() => setTermSel(key)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {/* LOIs are opened from the investor card's LOIs button, not here. */}
          {termSel === 'original' && originalTerm && (
            <div className="c1l-termline">
              {formatDMY(originalTerm.start)} → {formatDMY(originalTerm.maturity)} · principal {fmtMoney(originalTerm.principal)}
            </div>
          )}
          {termSel === 'renewals' && openRenewal && (
            <>
              {/* Picking a renewal opens that renewal — its figures and its
                  payouts below. */}
              <div className="c1l-loirow" role="tablist">
                {renewals.map((t) => (
                  <button key={t.no} type="button" role="tab"
                    aria-selected={t.no === openRenewal.no}
                    className={`nx-btn nx-btn-sm ${t.no === openRenewal.no ? 'nx-btn-primary' : 'nx-btn-secondary'}`}
                    onClick={() => setRenewalSel(t.no)}>{t.label}</button>
                ))}
              </div>
              <div className="c1l-termline">
                {formatDMY(openRenewal.start)} → {formatDMY(openRenewal.maturity)} · principal {fmtMoney(openRenewal.principal)}
              </div>
            </>
          )}
          <div className="c1l-cards">
            {[
              ['Principal', s.principal ?? s.total_invested, '', principalHint],
              ['Interest', s.interest, ''],
              ['Total', s.total ?? s.total_payout_due, 'sum', 'principal + interest'],
              ['Due till today', s.due_till_today, 'info'],
              ['Paid out', s.paid_out ?? s.total_paid, 'good'],
              ['Upcoming interest', s.upcoming_interest, 'warn', 'not yet due'],
            ].map(([label, val, tone, hint]) => (
              <div key={label} className={`c1l-card ${tone}`}>
                <span>{label}</span><b>{fmtMoney(val)}</b>{hint ? <small>{hint}</small> : null}
              </div>
            ))}
          </div>
          <div className="nx-card c1l-table">
            <table className="nx-table">
              <thead>
                <tr><th>Type</th><th className="num">Amount</th><th>Due date</th><th>Paid on</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="c1l-muted">
                    {termSel === 'redemptions' ? 'Nothing has been redeemed early.'
                      : termSel === 'renewals' ? 'No payouts in this renewal.'
                      : termSel === 'original' ? 'No payouts in the original term.'
                      : 'No payouts yet.'}
                  </td></tr>
                )}
                {rows.map((e, i) => {
                  // Unpaid: Pending once its date has come, Upcoming before that.
                  const due = e.due_date || e.date;
                  const settled = e.status === 'paid' ? settledTo(e.notes) : '';
                  const st = settled ? 'settled'
                    : e.status === 'pending' ? (due > today ? 'upcoming' : 'pending')
                    : e.status === 'paid' && e.paid_date && e.paid_date < due ? 'paid early' : e.status;
                  const grouped = termSel === 'all' || termSel === 'redemptions';
                  const head = grouped && terms.length > 1 && (i === 0 || (rows[i - 1].term ?? 0) !== (e.term ?? 0))
                    ? terms.find((t) => t.no === (e.term ?? 0)) : null;
                  return (
                    <Fragment key={i}>
                    {head && (
                      <tr className="c1l-termrow"><td colSpan={5}>{head.label} · {formatDMY(head.start)} → {formatDMY(head.maturity)} · {fmtMoney(head.principal)}</td></tr>
                    )}
                    <tr>
                      <td>
                        <Badge label={e.label} color={TYPE_COLOR[e.type] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' }} />
                        {e.type === 'premature_redemption' && (
                          <div className="c1p-why">Redeemed on <b>{formatDMY(e.redemption?.redemption_date || e.due_date || e.date)}</b>{e.redemption?.days_held != null ? ` · held ${e.redemption.days_held} days` : ''}</div>
                        )}
                        {e.carried && (
                          <div className="c1p-why">Not a payment — {e.type === 'interest' ? 'added into' : 'renewed into'} the next term</div>
                        )}
                        {e.maturity_split && (
                          <div className="c1p-why">{fmtMoney(e.maturity_split.principal)} principal + <b>{fmtMoney(e.maturity_split.interest)} interest</b></div>
                        )}
                        {e.period && (
                          <div className="c1p-why"><b>{e.period.label}</b> · {e.period.days} days × ₹{Number(e.period.per_day).toLocaleString('en-IN')}</div>
                        )}
                        {!!e.notes && !e.is_balance && (settled ? (settledRemark(e.notes) && <div className="c1l-note">{settledRemark(e.notes)}</div>)
                          : <div className="c1l-note">{e.notes}</div>)}
                      </td>
                      <td className="num c1l-amt">
                        {fmtMoney(e.amount)}
                        {e.paid_amount != null && Number(e.paid_amount) !== Number(e.amount) && <div className="c1l-paid">Paid {fmtMoney(e.paid_amount)}</div>}
                      </td>
                      <td className="c1l-date">{formatDMY(e.due_date || e.date)}</td>
                      <td className="c1l-date">{e.paid_date ? formatDMY(e.paid_date) : <span className="c1l-muted">—</span>}</td>
                      <td><Badge label={settled || st} color={STATUS_COLOR[st] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' }} /></td>
                    </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </C1Modal>
  );
}
