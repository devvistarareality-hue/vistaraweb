'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AR_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import Loader from '../../../components/Loader';
import { notify } from '../../../lib/notify';
import { rupee } from './_ar';

// Raise a plot cancellation for approval. Shows what it settles to first — we keep
// 10% of (Total Deal − Stamp Duty − Registration), capped at what was received, and
// the rest is refunded — so whoever raises it sees the money before they commit.
export default function CancelModal({ row, companyId, onClose, onDone }) {
  const cq = companyId ? `?company_id=${companyId}` : '';
  const [prev, setPrev] = useState(null);
  const [err, setErr] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(AR_ENDPOINTS.accountCancellation(row.id) + cq)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setErr(d.detail || 'Could not work out the settlement.'); setPrev({}); return; }
        setPrev(d);
      })
      .catch(() => { setErr('Could not work out the settlement. Check your connection.'); setPrev({}); });
  }, [row.id, cq]);

  async function submit() {
    setSaving(true); setErr('');
    try {
      const r = await apiFetch(AR_ENDPOINTS.accountCancellation(row.id) + cq, { method: 'POST', body: JSON.stringify({ reason }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.detail || d.reason || 'Could not raise the cancellation.'); setSaving(false); return; }
      notify('Cancellation sent for approval', 'success');
      onDone?.(d);
      onClose();
    } catch { setErr('Could not raise the cancellation. Check your connection.'); setSaving(false); }
  }

  const active = prev?.active;
  return (
    <div className="ar-backdrop" onClick={() => !saving && onClose()}>
      <div className="nx-card nx-modal ar-modal can-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ar-modal-title">Cancel plot</div>
        <div className="ar-modal-sub">{row.client_name} · {row.project} · Plot {row.plots}</div>
        {err && <div className="nx-note bad">{err}</div>}
        {prev === null ? <Loader label="Working out the settlement…" /> : active ? (
          <div className="nx-note warn">
            A cancellation is already {active.status === 'pending' ? 'awaiting approval' : 'approved'} for this plot.{' '}
            <Link href="/m/ar/cancellations" className="arb-link">Open Cancellations</Link>
          </div>
        ) : prev.deal_net != null && (
          <>
            <div className="can-settle">
              <div className="can-line"><span>Deal value (net of stamp duty &amp; registration)</span><b>{rupee(prev.deal_net)}</b></div>
              <div className="can-line"><span>Received from client</span><b>{rupee(prev.received)}</b></div>
              <div className="can-line can-keep"><span>We keep — {prev.forfeit_pct}% of deal value{prev.forfeit < Math.round(prev.deal_net * prev.forfeit_pct / 100) ? ' (capped at what was paid)' : ''}</span><b>− {rupee(prev.forfeit)}</b></div>
              <div className="can-line can-refund"><span>Refund to client</span><b>{rupee(prev.refund_due)}</b></div>
            </div>
            <p className="can-hint">On approval the plot goes back on sale in Sales at once, this account is frozen, and a cancellation letter with the statement can be issued. The refund is recorded when it is actually paid, from a bank.</p>
            <div className="nx-field">
              <label className="nx-field-label" htmlFor="can-reason">Reason</label>
              <textarea id="can-reason" className="nx-input can-reason" rows={3} placeholder="e.g. No payment for 14 months despite repeated follow-ups"
                value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </>
        )}
        <div className="ar-modal-foot">
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} disabled={saving}>Close</button>
          {prev?.can_request && (
            <button className="nx-btn nx-btn-md nx-btn-danger" onClick={submit} disabled={saving || !reason.trim()}>
              {saving ? 'Sending…' : 'Send for approval'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
