'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Hourglass, Wallet, CircleCheckBig, CircleSlash, FileText, Trash2 } from 'lucide-react';
import { AR_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import { DashKpi } from '../../../../components/Dash';
import { notify, confirmDialog } from '../../../../lib/notify';
import { formatDMY } from '../../../../lib/dateFormat';
import { rupee, today, cleanAmount, groupINR, printStatement } from '../_ar';

const STAGES = [
  ['pending', 'Awaiting approval'],
  ['refund_pending', 'Refund pending'],
  ['refunded', 'Refunded'],
  ['rejected', 'Rejected'],
  ['all', 'All'],
];
const STAGE_BADGE = {
  pending: ['warn', 'Awaiting approval'], refund_pending: ['bad', 'Refund pending'],
  refunded: ['ok', 'Refunded'], closed: ['ok', 'Closed — no refund due'], rejected: ['off', 'Rejected'],
};
const dmyTime = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

// Plot cancellations: raised from Collections or a ledger, approved by the project's
// booking/Accounts approver, then refunded (from a bank) as the money is paid back.
export default function ARCancellationsPage({ params }) {
  if (params.module !== 'ar') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cq = companyId ? `?company_id=${companyId}` : '';
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState({});
  const [canRefund, setCanRefund] = useState(false);
  const [err, setErr] = useState('');
  const [stage, setStage] = useState('pending');
  const [banks, setBanks] = useState([]);
  const [refund, setRefund] = useState(null);   // { c, paid_on, amount, bank, reference, remarks }
  const [refundErr, setRefundErr] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await apiFetch(AR_ENDPOINTS.cancellations + cq);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.detail || 'Could not load cancellations.'); setRows([]); return; }
      setRows(d.results || []); setCounts(d.counts || {}); setCanRefund(!!d.can_refund);
    } catch { setErr('Could not load cancellations. Check your connection.'); setRows([]); }
  }, [cq]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch(AR_ENDPOINTS.banks + cq).then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => setBanks((d.results || []).filter((b) => b.is_active))).catch(() => {});
  }, [cq]);

  // Start on whatever needs attention.
  useEffect(() => {
    if (rows && stage === 'pending' && !counts.pending && counts.refund_pending) setStage('refund_pending');
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => (rows || []).filter((c) => stage === 'all' || c.stage === stage
    || (stage === 'refunded' && c.stage === 'closed')), [rows, stage]);
  const replace = (c) => setRows((rs) => rs.map((x) => (x.id === c.id ? c : x)));

  async function decide(c, action) {
    const ok = await confirmDialog(action === 'approve'
      ? `Approve cancelling Plot ${c.plots} (${c.client})? The plot goes back on sale in Sales immediately and the account is frozen. Refund due: ${rupee(c.refund_due)}.`
      : `Reject this cancellation? The booking stays as it is.`,
    { title: action === 'approve' ? 'Approve cancellation?' : 'Reject cancellation?', confirmText: action === 'approve' ? 'Approve' : 'Reject', tone: action === 'approve' ? 'danger' : undefined });
    if (!ok) return;
    setBusy(true);
    const r = await apiFetch(AR_ENDPOINTS.cancellationDecide(c.id) + cq, { method: 'POST', body: JSON.stringify({ action }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { notify(d.detail || 'Could not save the decision', 'error'); return; }
    notify(action === 'approve' ? 'Cancelled — plot released to Sales' : 'Cancellation rejected', 'success');
    load();
  }

  async function saveRefund() {
    setBusy(true); setRefundErr({});
    const { c, ...body } = refund;
    const r = await apiFetch(AR_ENDPOINTS.cancellationRefunds(c.id) + cq, { method: 'POST', body: JSON.stringify(body) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setRefundErr(d.detail ? { _: d.detail } : d); return; }
    replace(d); setRefund(null);
    notify('Refund recorded', 'success');
    apiFetch(AR_ENDPOINTS.banks + cq).then((x) => (x.ok ? x.json() : { results: [] })).then((x) => setBanks((x.results || []).filter((b) => b.is_active))).catch(() => {});
  }

  async function deleteRefund(c, x) {
    const ok = await confirmDialog(`Delete the ${rupee(x.amount)} refund of ${formatDMY(x.paid_on)}? It goes back into ${x.bank_name}'s balance.`,
      { title: 'Delete refund?', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    const r = await apiFetch(AR_ENDPOINTS.refund(x.id) + cq, { method: 'DELETE' }).catch(() => null);
    if (r?.ok) { notify('Refund deleted', 'success'); load(); } else notify('Could not delete the refund', 'error');
  }

  async function letter(c) {
    const msg = await printStatement(AR_ENDPOINTS.cancellationLetter(c.id) + cq, apiFetch);
    if (msg) notify(msg, 'error');
  }

  const pickedBank = refund ? banks.find((b) => String(b.id) === String(refund.bank)) : null;

  return (
    <div className="nx-page">
      <div className="arb-head">
        <div>
          <h1 className="nx-page-title">Cancellations</h1>
          <p className="nx-page-sub">Plots cancelled for non-payment. We keep 10% of the deal (net of stamp duty &amp; registration), capped at what was paid; the rest is refunded from a bank.</p>
        </div>
      </div>

      <div className="can-kpis">
        <DashKpi icon={Hourglass} tone="warn" label="Awaiting approval" value={counts.pending || 0} sub="Raised, not yet decided" />
        <DashKpi icon={Wallet} tone="bad" label="Refund pending" value={counts.refund_pending || 0} sub="Approved, money still to pay back" />
        <DashKpi icon={CircleCheckBig} tone="good" label="Settled" value={(counts.refunded || 0) + (counts.closed || 0)} sub="Refunded in full, or none due" />
        <DashKpi icon={CircleSlash} label="Rejected" value={counts.rejected || 0} sub="Booking kept" />
      </div>

      <div className="can-tabs">
        {STAGES.map(([k, label]) => {
          const n = k === 'all' ? (rows || []).length : k === 'refunded' ? (counts.refunded || 0) + (counts.closed || 0) : (counts[k] || 0);
          return <button key={k} className={`bst-chip${stage === k ? ' is-on' : ''}`} onClick={() => setStage(k)}>{label} · {n}</button>;
        })}
      </div>

      {err && <div className="nx-note bad">{err}</div>}
      {rows === null ? <Loader label="Loading cancellations…" /> : shown.length === 0 ? (
        <div className="nx-card bst-empty"><b>Nothing here</b><span>Raise a cancellation from Collections or a client&apos;s ledger with “Cancel plot”.</span></div>
      ) : (
        <div className="can-list">
          {shown.map((c) => {
            const [tone, label] = STAGE_BADGE[c.stage] || ['off', c.stage];
            const pct = c.refund_due > 0 ? Math.min(100, Math.round((c.refunded / c.refund_due) * 100)) : 100;
            return (
              <article key={c.id} className="nx-card can-card">
                <header className="can-card-head">
                  <div>
                    <div className="can-client">{c.client || '—'}</div>
                    <div className="can-sub">{c.project} · Plot {c.plots}{c.phone ? ` · ${c.phone}` : ''}</div>
                  </div>
                  <span className={`nx-status ${tone}`}>{label}</span>
                </header>

                <div className="can-figs">
                  <div><span>Deal (net)</span><b>{rupee(c.deal_net)}</b></div>
                  <div><span>Received</span><b>{rupee(c.received)}</b></div>
                  <div><span>We keep ({c.forfeit_pct}%)</span><b className="can-keep-v">{rupee(c.forfeit)}</b></div>
                  <div><span>Refund</span><b className="can-refund-v">{rupee(c.refund_due)}</b></div>
                </div>

                {c.status === 'approved' && c.refund_due > 0 && (
                  <div className="can-progress">
                    <div className="can-track">
                      <div className="can-fill" style={{ width: `${pct}%` }} /> {/* inline-ok: computed refund progress */}
                    </div>
                    <span>{rupee(c.refunded)} paid · {rupee(c.refund_balance)} left</span>
                  </div>
                )}

                <p className="can-reason-text">“{c.reason}”</p>
                <div className="can-who">
                  Raised by {c.requested_by || '—'} on {dmyTime(c.requested_at)}
                  {c.decided_by && <> · {c.status === 'rejected' ? 'Rejected' : 'Approved'} by {c.decided_by} on {dmyTime(c.decided_at)}</>}
                  {c.decision_note && <> · “{c.decision_note}”</>}
                </div>

                {c.refunds.length > 0 && (
                  <ul className="can-refunds">
                    {c.refunds.map((x) => (
                      <li key={x.id}>
                        <span>{formatDMY(x.paid_on)}</span>
                        <span className="can-refunds-bank">{x.bank_name}{x.reference ? ` · ${x.reference}` : ''}</span>
                        <b>− {rupee(x.amount)}</b>
                        {canRefund && <button className="nx-icon-btn nx-btn-sm" title="Delete refund" onClick={() => deleteRefund(c, x)}><Trash2 size={13} /></button>}
                      </li>
                    ))}
                  </ul>
                )}

                <footer className="can-actions">
                  <Link href={`/m/${params.module}/ledger/${c.account_id}`} className="nx-btn nx-btn-sm nx-btn-secondary">Ledger</Link>
                  {c.status === 'approved' && <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => letter(c)}><FileText size={13} /> Letter</button>}
                  {c.can_decide && <button className="nx-btn nx-btn-sm nx-btn-secondary" disabled={busy} onClick={() => decide(c, 'reject')}>Reject</button>}
                  {c.can_decide && <button className="nx-btn nx-btn-sm nx-btn-danger" disabled={busy} onClick={() => decide(c, 'approve')}>Approve cancellation</button>}
                  {c.stage === 'refund_pending' && canRefund && (
                    <button className="nx-btn nx-btn-sm nx-btn-primary" onClick={() => { setRefundErr({}); setRefund({ c, paid_on: today(), amount: String(c.refund_balance), bank: '', reference: '', remarks: '' }); }}>
                      Record refund
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {refund && (
        <div className="ar-backdrop" onClick={() => !busy && setRefund(null)}>
          <div className="nx-card nx-modal ar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ar-modal-title">Record refund</div>
            <div className="ar-modal-sub">{refund.c.client} · Plot {refund.c.plots} · {rupee(refund.c.refund_balance)} left to refund</div>
            {refundErr._ && <div className="nx-note bad">{refundErr._}</div>}
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="rf-date">Paid on</label>
              <input id="rf-date" type="date" max={today()} className={`nx-input${refundErr.paid_on ? ' is-invalid' : ''}`} value={refund.paid_on} onChange={(e) => setRefund({ ...refund, paid_on: e.target.value })} />
              {refundErr.paid_on && <span className="nx-note bad">{refundErr.paid_on}</span>}
            </div>
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="rf-amt">Amount (₹)</label>
              <input id="rf-amt" type="text" inputMode="decimal" autoComplete="off" className={`nx-input${refundErr.amount ? ' is-invalid' : ''}`}
                value={groupINR(refund.amount)} onChange={(e) => setRefund({ ...refund, amount: cleanAmount(e.target.value) })} />
              {refundErr.amount && <span className="nx-note bad">{refundErr.amount}</span>}
            </div>
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="rf-bank">Paid from bank</label>
              {banks.length ? (
                <select id="rf-bank" className={`nx-input${refundErr.bank ? ' is-invalid' : ''}`} value={refund.bank} onChange={(e) => setRefund({ ...refund, bank: e.target.value })}>
                  <option value="">Select the bank</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.name}{b.account_no ? ` · ${b.account_no}` : ''}</option>)}
                </select>
              ) : <div className="nx-note warn">No banks yet — add one in Bank Master first.</div>}
              {pickedBank && (
                <div className="arb-pick can-pick-out">
                  <div className="arb-pick-col"><span className="arb-pick-label">Current balance</span><b className="arb-pick-now">{rupee(pickedBank.balance)}</b></div>
                  {Number(refund.amount) > 0 && <>
                    <span className="arb-pick-arrow">→</span>
                    <div className="arb-pick-col"><span className="arb-pick-label">After this refund</span><b className="arb-pick-after can-out">{rupee(pickedBank.balance - Number(refund.amount))}</b></div>
                  </>}
                </div>
              )}
              {refundErr.bank && <span className="nx-note bad">{refundErr.bank}</span>}
            </div>
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="rf-ref">UTR / cheque no.</label>
              <input id="rf-ref" className="nx-input" value={refund.reference} onChange={(e) => setRefund({ ...refund, reference: e.target.value })} />
            </div>
            <div className="ar-modal-foot">
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setRefund(null)} disabled={busy}>Cancel</button>
              <button className="nx-btn nx-btn-md nx-btn-primary" onClick={saveRefund} disabled={busy || !refund.bank || !(Number(refund.amount) > 0) || !refund.paid_on}>
                {busy ? 'Saving…' : 'Record refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
