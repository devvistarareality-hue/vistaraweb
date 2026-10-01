'use client';
/**
 * Project Approvals — the third section of the Approvals page.
 *
 * A new project is invisible to everyone until someone signs it off, so this is
 * where that happens. Two halves:
 *
 *   - the approver picker, one list for the whole company rather than one per
 *     project, because a project does not exist yet when it needs approving;
 *   - the queue itself, which lists what is waiting and what was decided.
 *
 * Rejecting keeps the project and records why, so whoever created it can read
 * the reason and fix it rather than starting again.
 */
import { useCallback, useEffect, useState } from 'react';

import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import Icon from '../../../components/Icon';
import Loader from '../../../components/Loader';
import { notify } from '../../../lib/notify';

const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];

function ApproverPicker({ people, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const names = people.filter((p) => selected.includes(p.id)).map((p) => p.name);
  return (
    <div className="pa-picker">
      <button type="button" className="pa-picker-btn" onClick={() => setOpen((o) => !o)}>
        <span className={names.length ? 'pa-picker-val' : 'pa-picker-ph'}>
          {names.length ? names.join(', ') : 'Select approvers…'}
        </span>
        <span className="pa-picker-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="pa-picker-menu">
          {people.length === 0
            ? <div className="pa-picker-empty">No managers in this company.</div>
            : people.map((p) => (
              <label key={p.id} className="pa-picker-opt">
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} />
                <span>{p.name}</span>
                <span className="pa-picker-role">{p.role}</span>
              </label>
            ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectApprovals({ isAdmin }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [approvers, setApprovers] = useState([]);
  const [people, setPeople] = useState([]);
  // Rejecting asks for a reason first — refusing a project without saying why
  // leaves whoever created it with nothing to act on.
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ?full=1 is not needed here: the list view already carries approval_status.
      const res = await apiFetch(SALES_ENDPOINTS.projects, { headers: authHeaders() });
      if (res.ok) setProjects(await res.json());
    } catch { /* leave what is on screen */ }
    setLoading(false);
  }, []);

  const loadApprovers = useCallback(async () => {
    try {
      const res = await apiFetch(SALES_ENDPOINTS.projectApprovers, { headers: authHeaders() });
      if (!res.ok) return;
      const d = await res.json();
      setApprovers(d.approvers || []);
      setPeople(d.people || []);
    } catch { /* the panel just stays as it was */ }
  }, []);

  useEffect(() => { load(); loadApprovers(); }, [load, loadApprovers]);

  async function act(project, action, why = '') {
    setBusy(project.id);
    try {
      const res = await apiFetch(SALES_ENDPOINTS.projectApproval(project.id), {
        method: 'POST',
        body: JSON.stringify({ action, ...(why ? { reason: why } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { notify(d.detail || 'Could not update the project.', 'error'); return; }
      notify(action === 'approve'
        ? `${project.name} approved — it is now visible to everyone.`
        : `${project.name} rejected.`, action === 'approve' ? 'success' : 'info');
      setRejecting(null); setReason('');
      load();
    } finally {
      setBusy(null);
    }
  }

  async function toggleApprover(id) {
    const next = approvers.includes(id) ? approvers.filter((x) => x !== id) : [...approvers, id];
    setApprovers(next);                       // optimistic: the picker stays responsive
    try {
      const res = await apiFetch(SALES_ENDPOINTS.projectApprovers, {
        method: 'PATCH', body: JSON.stringify({ approvers: next }),
      });
      if (!res.ok) { loadApprovers(); return; }   // server refused — show the truth
      const d = await res.json();
      setApprovers(d.approvers || []);
    } catch { loadApprovers(); }
  }

  const shown = tab === 'all' ? projects : projects.filter((p) => (p.approval_status || 'approved') === tab);
  const pendingCount = projects.filter((p) => p.approval_status === 'pending').length;

  return (
    <>
      {isAdmin && (
        <div className="nx-card pa-cfg">
          <button type="button" className="pa-cfg-toggle" onClick={() => setCfgOpen((o) => !o)}>
            <Icon name="settings" /> Project Approvers {cfgOpen ? '▴' : '▾'}
          </button>
          {cfgOpen && (
            <div className="pa-cfg-body">
              <div className="pa-cfg-hint">
                One list for the whole company, not one per project — a project does not exist
                yet when it needs approving. Whoever is named here approves every new project,
                and gets a notification when one is created.
              </div>
              <ApproverPicker people={people} selected={approvers} onToggle={toggleApprover} />
            </div>
          )}
        </div>
      )}

      <div className="nx-filters">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`nx-btn nx-btn-md nx-toggle${tab === k ? ' is-on' : ''}`}>
            {label}{k === 'pending' && pendingCount > 0 ? ` · ${pendingCount}` : ''}
          </button>
        ))}
      </div>

      {loading ? <Loader label="Loading…" /> : shown.length === 0 ? (
        <div className="pa-empty">
          {tab === 'pending' ? 'No projects waiting for approval.' : `No ${tab} projects.`}
        </div>
      ) : (
        <div className="nx-card pa-list">
          {shown.map((p) => {
            const st = p.approval_status || 'approved';
            return (
              <div className="pa-row" key={p.id}>
                <div className="pa-row-main">
                  <div className="pa-row-name">{p.name}</div>
                  <div className="pa-row-meta">
                    {p.location || '—'} · {p.project_type}
                    {st === 'rejected' && p.rejected_reason ? ` · ${p.rejected_reason}` : ''}
                  </div>
                </div>
                <span className={`nx-badge pa-badge is-${st}`}>{st.toUpperCase()}</span>
                {st === 'pending' && (
                  <div className="pa-row-actions">
                    <button className="nx-btn nx-btn-sm nx-btn-success" disabled={busy === p.id}
                      onClick={() => act(p, 'approve')}>
                      <Icon name="check" /> Approve
                    </button>
                    <button className="nx-btn nx-btn-sm nx-btn-danger" disabled={busy === p.id}
                      onClick={() => { setRejecting(p); setReason(''); }}>
                      <Icon name="x" /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rejecting && (
        <div className="nx-modal-backdrop pa-modal-back" onClick={() => setRejecting(null)}>
          <div className="nx-modal pa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pa-modal-title">Reject {rejecting.name}?</div>
            <div className="pa-modal-hint">
              It stays hidden from everyone and keeps this reason, so whoever created it can
              see what to fix.
            </div>
            <input className="nx-input pa-modal-input" value={reason} autoFocus
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why — e.g. RERA number missing" />
            <div className="pa-modal-actions">
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setRejecting(null)}>Cancel</button>
              <button className="nx-btn nx-btn-md nx-btn-danger" disabled={!reason.trim() || busy === rejecting.id}
                onClick={() => act(rejecting, 'reject', reason.trim())}>
                Reject project
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
