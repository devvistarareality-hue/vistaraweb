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

// How a renewal's money was made up: "₹80,00,000 principal + ₹32,00,000 interest + ₹88,00,000 new money".
const madeOf = (t) => (t?.made_of ? [
  `${fmtMoney(t.made_of.principal)} principal renewed`,
  Number(t.made_of.interest) > 0 ? `${fmtMoney(t.made_of.interest)} interest added` : '',
  Number(t.made_of.fresh) > 0 ? `${fmtMoney(t.made_of.fresh)} new money` : '',
].filter(Boolean).join(' + ') + [
  Number(t.made_of.returned) > 0 ? ` · ${fmtMoney(t.made_of.returned)} principal paid back to him` : '',
  Number(t.made_of.interest_paid) > 0 ? ` · ${fmtMoney(t.made_of.interest_paid)} interest paid to him` : '',
].join('') : '');

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
          {/* One block per term — how it started, the money that moved in it, and how it
              ended. Money only carried into the next term is one line at the end, not rows. */}
          {(() => {
            const short = (t) => String(t?.label || '').split(' · ')[0];
            const isCarry = (e) => e.carried || (e.status === 'paid' && /added to the principal/i.test(e.notes || ''));
            // An investment with no term record yet reads as one Original term.
            const all = terms.length ? terms : [{ no: 0, label: 'Original', start: inv?.investment_date, maturity: inv?.maturity_date, principal: inv?.amount_invested, current: true }];
            const shown = termSel === 'original' ? all.filter((t) => t.no === 0)
              : termSel === 'renewals' ? (openRenewal ? [openRenewal] : [])
              : termSel === 'redemptions' ? all.filter((t) => rows.some((e) => (e.term ?? 0) === t.no))
              : all;
            if (!shown.length) {
              return <div className="nx-card c1lt-empty">{termSel === 'redemptions' ? 'Nothing has been redeemed early.' : 'No payouts yet.'}</div>;
            }
            let redCount = 0;
            return shown.map((t) => {
              const next = all.find((x) => x.no === t.no + 1);
              const pays = rows.filter((e) => (e.term ?? 0) === t.no && !isCarry(e));
              const mo = t.made_of;
              const nmo = next?.made_of;
              return (
                <div key={t.no} className={`nx-card c1lt${t.current ? ' is-cur' : ''}`}>
                  <div className="c1lt-head">
                    <div><b>{short(t)}</b> <span>{formatDMY(t.start)} → {formatDMY(t.maturity)}</span></div>
                    <em className={t.current ? 'cur' : 'done'}>{t.current ? 'Current' : next ? `Renewed into ${short(next)}` : 'Ended'}</em>
                  </div>
                  <div className="c1lt-start">
                    <span>{t.no === 0 ? 'Invested' : 'Started with'}</span><b>{fmtMoney(t.principal)}</b>
                    {mo && <small>{madeOf(t)}</small>}
                  </div>
                  {pays.length > 0 && (
                    <div className="c1lt-rows">
                      {pays.map((e, i) => {
                        const due = e.due_date || e.date;
                        const settledRaw = e.status === 'paid' ? settledTo(e.notes) : '';
                        const atRenewal = !!settledRaw;
                        const st = atRenewal ? 'paid'
                          : e.status === 'pending' ? (due > today ? 'upcoming' : 'pending')
                          : e.status === 'paid' && e.paid_date && e.paid_date < due ? 'paid early' : e.status;
                        const statusLabel = atRenewal ? settledRaw.replace('Settled to', 'Paid at') : st;
                        const isRed = e.type === 'premature_redemption';
                        if (isRed) redCount += 1;
                        const title = isRed ? `Redemption ${redCount}` : atRenewal && e.type === 'maturity' ? 'Principal paid back'
                          : e.type === 'maturity' ? (e.maturity_split ? 'Maturity · principal + interest' : 'Principal at maturity') : e.label;
                        const sub = isRed && e.redemption
                          ? `${fmtMoney(e.redemption.redeem_amount)} taken out of ${short(t)}${e.redemption.remaining_principal != null ? ` · ${fmtMoney(e.redemption.remaining_principal)} stays invested` : ''}`
                          : atRenewal ? 'Paid to him at the renewal'
                          : e.maturity_split ? `${fmtMoney(e.maturity_split.principal)} principal + ${fmtMoney(e.maturity_split.interest)} interest`
                          : e.period ? `${e.period.label} · ${e.period.days} days × ₹${Number(e.period.per_day).toLocaleString('en-IN')}` : '';
                        return (
                          <div key={i} className={`c1lt-row${isRed ? ' is-red' : ''}`}>
                            <div className="c1lt-what"><b>{title}</b>{sub ? <small>{sub}</small> : null}</div>
                            <div className="c1lt-date">{formatDMY(due)}</div>
                            <div className="c1lt-amt">{fmtMoney(e.amount)}
                              {e.paid_amount != null && Number(e.paid_amount) !== Number(e.amount) && <small>paid {fmtMoney(e.paid_amount)}</small>}</div>
                            <div className="c1lt-st"><Badge label={statusLabel} color={STATUS_COLOR[st] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' }} />
                              {e.paid_date && e.status === 'paid' ? <small>on {formatDMY(e.paid_date)}</small> : null}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {termSel !== 'redemptions' && (
                    <div className="c1lt-end">
                      {next ? (
                        <>
                          <span>At the end →</span>
                          <b>{fmtMoney(Number(nmo?.principal || 0) + Number(nmo?.interest || 0))} carried into {short(next)}</b>
                          {(Number(nmo?.returned) > 0 || Number(nmo?.interest_paid) > 0) && (
                            <small>{[Number(nmo.interest_paid) > 0 ? `${fmtMoney(nmo.interest_paid)} interest` : '', Number(nmo.returned) > 0 ? `${fmtMoney(nmo.returned)} principal` : ''].filter(Boolean).join(' + ')} paid to him</small>
                          )}
                        </>
                      ) : t.current ? (
                        <><span>Running</span><b>matures {formatDMY(t.maturity)}</b></>
                      ) : <span>Ended</span>}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </>
      )}
    </C1Modal>
  );
}
