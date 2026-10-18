'use client';
import { Fragment, useEffect, useState } from 'react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { formatDMY } from '../../lib/dateFormat';
import { fmtMoney } from './_StatCard';
import { notify } from '../../lib/notify';

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
  const [termSel, setTermSel] = useState('all');   // 'all', or a term's number (0 = the original)

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
  const term = termSel === 'all' ? null : terms.find((t) => t.no === termSel);
  const s = term ? term.summary : data?.summary;
  const first = terms[0];
  const principalHint = term ? `${term.no === 0 ? 'invested' : 'renewed'} ${formatDMY(term.start)}`
    : first ? `${terms.length > 1 ? 'first invested' : 'invested'} ${formatDMY(first.start)}`
    : inv?.investment_date ? `invested ${formatDMY(inv.investment_date)}` : '';
  // A term's own signed LOI — the running one, or an earlier term's kept copy.
  async function openTermLoi(t) {
    const r = await apiFetch(`${CLUB1000_ENDPOINTS.investorLoiUrl(investorId)}${t.current ? '' : `?term=${t.no}`}`).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
    else notify(errText(d, 'Could not open the LOI.'), 'error');
  }
  const rows = (data?.entries || []).filter((e) => e.type !== 'investment' && (termSel === 'all' || (e.term ?? 0) === termSel));
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  return (
    <C1Modal wide title={`Ledger${inv ? ` — ${inv.name}` : ''}`} sub={inv ? `${inv.phone} · ${inv.scheme_name}` : null} onClose={onClose}>
      {loading ? <Loader label="Loading…" /> : err ? <C1Error>{err}</C1Error> : (
        <>
          {terms.length > 1 && (
            <div className="c1l-terms" role="tablist">
              <button type="button" role="tab" aria-selected={termSel === 'all'} className={termSel === 'all' ? 'is-on' : ''} onClick={() => setTermSel('all')}>All terms</button>
              {terms.map((t) => (
                <button key={t.no} type="button" role="tab" aria-selected={termSel === t.no} className={termSel === t.no ? 'is-on' : ''} onClick={() => setTermSel(t.no)}>
                  {t.label}{t.current ? <em>current</em> : null}
                </button>
              ))}
            </div>
          )}
          {term && (
            <div className="c1l-termline">
              {formatDMY(term.start)} → {formatDMY(term.maturity)} · principal {fmtMoney(term.principal)}
              {term.has_loi
                ? <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary c1l-termloi" onClick={() => openTermLoi(term)}>Open this term's signed LOI</button>
                : !term.current && <span className="c1l-noloi"> · its signed LOI was not kept (renewed before LOIs were kept)</span>}
            </div>
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
                <tr><th>Type</th><th className="num">Amount</th><th>Due date</th><th>Paid date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="c1l-muted">No payouts in this term.</td></tr>
                )}
                {rows.map((e, i) => {
                  // Unpaid: Pending once its date has come, Upcoming before that.
                  const due = e.due_date || e.date;
                  const st = e.status === 'pending' ? (due > today ? 'upcoming' : 'pending')
                    : e.status === 'paid' && e.paid_date && e.paid_date < due ? 'paid early' : e.status;
                  const head = termSel === 'all' && terms.length > 1 && (i === 0 || (rows[i - 1].term ?? 0) !== (e.term ?? 0))
                    ? terms.find((t) => t.no === (e.term ?? 0)) : null;
                  return (
                    <Fragment key={i}>
                    {head && (
                      <tr className="c1l-termrow"><td colSpan={5}>{head.label} · {formatDMY(head.start)} → {formatDMY(head.maturity)} · {fmtMoney(head.principal)}</td></tr>
                    )}
                    <tr>
                      <td>
                        <Badge label={e.label} color={TYPE_COLOR[e.type] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' }} />
                        {e.period && (
                          <div className="c1p-why"><b>{e.period.label}</b> · {e.period.days} days × ₹{Number(e.period.per_day).toLocaleString('en-IN')}</div>
                        )}
                        {!!e.notes && !e.is_balance && <div className="c1l-note">{e.notes}</div>}
                      </td>
                      <td className="num c1l-amt">
                        {fmtMoney(e.amount)}
                        {e.paid_amount != null && Number(e.paid_amount) !== Number(e.amount) && <div className="c1l-paid">Paid {fmtMoney(e.paid_amount)}</div>}
                      </td>
                      <td>{formatDMY(e.due_date || e.date)}</td>
                      <td className="c1l-muted">{e.paid_date ? formatDMY(e.paid_date) : '—'}</td>
                      <td><Badge label={st} color={STATUS_COLOR[st] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' }} /></td>
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
