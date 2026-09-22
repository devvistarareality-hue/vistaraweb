'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { SALES_ENDPOINTS, authHeaders } from '../../constants/api';
import { confirmDialog, notify } from '../../lib/notify';
import Loader from '../../components/Loader';

// Lead transfer approvals with a status filter: Pending (act on them), Approved,
// Rejected, Withdrawn, All — decided ones show who approved/rejected and when.
// Shared by the Sales and Channel Partner approvals pages (cpOnly scopes it).
const TABS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['cancelled', 'Withdrawn'],
  ['', 'All'],
];
const STATUS = {
  pending: { cls: 'warn', label: 'Pending' },
  approved: { cls: 'ok', label: 'Approved' },
  rejected: { cls: 'bad', label: 'Rejected' },
  cancelled: { cls: 'off', label: 'Withdrawn' },
};
const VERB = { approved: 'Approved by', rejected: 'Rejected by', cancelled: 'Withdrawn by' };

function when(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}

export default function LeadTransfers({ companyId, cpOnly, pendingCount, onChanged }) {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);

  function load() {
    setRows(null);
    const q = [status ? `status=${status}` : '', companyId ? `company_id=${companyId}` : '', cpOnly ? 'cp_only=true' : ''].filter(Boolean).join('&');
    fetch(`${SALES_ENDPOINTS.leadTransfers}${q ? `?${q}` : ''}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));
  }
  useEffect(() => { load(); }, [status, companyId, cpOnly]);

  async function act(x, action) {
    const approve = action === 'approve';
    const ok = await confirmDialog(
      `${approve ? 'Approve' : 'Reject'} moving ${x.lead_name || 'this lead'} from ${x.from_stm_name || 'unassigned'} to ${x.to_stm_name}?`,
      { title: approve ? 'Approve transfer?' : 'Reject transfer?', confirmText: approve ? 'Approve' : 'Reject', tone: approve ? undefined : 'danger' },
    );
    if (!ok) return;
    setBusy(x.id);
    const r = await fetch(SALES_ENDPOINTS.leadTransferAction(x.id), {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }),
    }).catch(() => null);
    setBusy(null);
    if (r?.ok) notify(approve ? 'Transfer approved' : 'Transfer rejected', 'success');
    else notify((await r?.json().catch(() => ({})))?.detail || 'Could not update the transfer', 'error');
    load();
    onChanged?.();
  }

  return (
    <div className="lx">
      <div className="lx-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k || 'all'} type="button" role="tab" aria-selected={status === k}
            className={`nx-btn nx-btn-sm nx-toggle${status === k ? ' is-on' : ''}`} onClick={() => setStatus(k)}>
            {label}{k === 'pending' && pendingCount > 0 ? ` · ${pendingCount}` : ''}
          </button>
        ))}
      </div>

      {status === 'pending' && <p className="lx-hint">The lead stays with the current STM until you approve.</p>}

      {rows === null ? <Loader label="Loading transfers…" /> : rows.length === 0 ? (
        <div className="nx-card nx-empty-card">
          {status === 'pending' ? 'No lead transfers are waiting for your approval.' : `No ${(STATUS[status]?.label || '').toLowerCase()} lead transfers.`.replace('No  lead', 'No lead')}
        </div>
      ) : (
        <div className="lx-list">
          {rows.map((x) => {
            const st = STATUS[x.status] || STATUS.pending;
            return (
              <div key={x.id} className={`nx-card lx-row is-${x.status}`}>
                <div className="lx-main">
                  <div className="lx-title">
                    <span className="lx-lead">{x.lead_name || 'Lead'}</span>
                    {x.project_name && <span className="lx-project">{x.project_name}</span>}
                    <span className={`nx-status ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="lx-move">
                    <span>{x.from_stm_name || 'Unassigned'}</span>
                    <ArrowRight size={14} />
                    <b>{x.to_stm_name}</b>
                  </div>
                  <div className="lx-meta">
                    Requested by {x.requested_by_name || '—'} · {when(x.created_at)}
                    {x.reason ? <> · <i>“{x.reason}”</i></> : null}
                  </div>
                  {x.status !== 'pending' && (
                    <div className={`lx-decision ${st.cls}`}>
                      {VERB[x.status]} <b>{x.decided_by_name || '—'}</b>{x.decided_at ? ` · ${when(x.decided_at)}` : ''}
                      {x.decision_note ? <> · <i>“{x.decision_note}”</i></> : null}
                    </div>
                  )}
                </div>
                {x.status === 'pending' && (
                  <div className="lx-actions">
                    <button type="button" className="nx-btn nx-btn-md nx-btn-danger-soft" onClick={() => act(x, 'reject')} disabled={busy === x.id}><X size={15} /> Reject</button>
                    <button type="button" className="nx-btn nx-btn-md nx-btn-success" onClick={() => act(x, 'approve')} disabled={busy === x.id}><Check size={15} /> {busy === x.id ? '…' : 'Approve'}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
