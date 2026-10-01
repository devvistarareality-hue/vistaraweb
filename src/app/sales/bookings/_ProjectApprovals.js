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
import { bustCache } from '../_cache';

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

function Field({ label, value }) {
  return (
    <div className="pa-field">
      <div className="pa-field-label">{label}</div>
      <div className="pa-field-value">{value || '—'}</div>
    </div>
  );
}

/** What is actually being approved. Read from the list payload, which already
 *  carries every field except the floor plans and site-map zones. */
function ProjectDetail({ project: p }) {
  const money = (v) => (v ? String(v) : '');
  const layout = p.floor_wise
    ? (p.block_industrial ? 'Block-wise industrial' : 'Floor-wise (tower)')
    : 'Plotted scheme';
  return (
    <div className="pa-detail">
      <div className="pa-detail-grid">
        <Field label="Project name" value={p.name} />
        <Field label="Tagline" value={p.tagline} />
        <Field label="Location" value={p.location} />
        <Field label="Type" value={p.project_type} />
        <Field label="Pricing model" value={p.formula_set} />
        <Field label="Layout" value={layout} />
        <Field label="RERA number" value={p.rera} />
        <Field label="Total area" value={p.total_area} />
        <Field label="Price range" value={money(p.price_range)} />
        <Field label="Possession" value={p.possession} />
        <Field label="Units mapped" value={p.plot_counts ? String(p.plot_counts.total ?? 0) : '0'} />
        <Field label="Kiosk self-booking" value={p.kiosk_enabled ? 'Enabled' : 'Off'} />
        <Field label="Added by" value={p.created_by_name} />
        <Field label="Added on" value={p.created_at ? new Date(p.created_at).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''} />
      </div>
      {p.description ? (
        <div className="pa-detail-desc">
          <div className="pa-field-label">Description</div>
          <div className="pa-field-value">{p.description}</div>
        </div>
      ) : null}
      {p.approved_by_name ? (
        <div className="pa-detail-desc">
          <div className="pa-field-label">
            {p.approval_status === 'rejected' ? 'Rejected by' : 'Approved by'}
          </div>
          <div className="pa-field-value">
            {p.approved_by_name}
            {p.approved_at ? ` · ${new Date(p.approved_at).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectApprovals({ isAdmin, companyId }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [approvers, setApprovers] = useState([]);
  const [people, setPeople] = useState([]);
  // Rejecting asks for a reason first — refusing a project without saying why
  // leaves whoever created it with nothing to act on.
  // Tapping a row opens what is being approved. Approving a project you cannot
  // see the details of is a rubber stamp, not a decision.
  const [openId, setOpenId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // ?full=1 is not needed here: the list view already carries approval_status.
      // This queue is one of the two screens that act on an unapproved project.
      const res = await apiFetch(`${SALES_ENDPOINTS.projects}?include_unapproved=1`, { headers: authHeaders() });
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
      // The Projects page serves from a cache and returns early without
      // refetching, so a decision made here was invisible there until the cache
      // happened to expire — a project rejected a moment ago still read
      // "awaiting approval". Approving has the same problem in reverse.
      bustCache(`projects_${companyId || 'all'}`);
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
        /* Card per project, matching the booking approval cards on the sibling
           tab — same shape, same button row, so the page reads as one screen
           rather than three that grew separately. */
        <div className="pa-cards">
          {shown.map((p) => {
            const st = p.approval_status || 'approved';
            const open = openId === p.id;
            return (
              <div className="nx-card pa-card" key={p.id}>
                <div className="pa-card-head">
                  <div className="pa-card-id">
                    <div className="pa-card-name">{p.name}</div>
                    <div className="pa-card-sub">
                      {(p.location || '—')} · {p.project_type}
                      {p.total_plots ? ` · ${p.total_plots} units` : ''}
                    </div>
                    <div className="pa-card-sub2">
                      Added by {p.created_by_name || '—'}
                      {p.created_at ? ` · ${new Date(p.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                    </div>
                    {st === 'rejected' && p.rejected_reason ? (
                      <div className="pa-card-reason">
                        <div className="pa-card-reason-title">
                          Rejected{p.approved_by_name ? ` · ${p.approved_by_name}` : ''}
                        </div>
                        <div className="pa-card-reason-body">{p.rejected_reason}</div>
                      </div>
                    ) : null}
                    {st === 'approved' && p.approved_by_name ? (
                      <div className="pa-card-decided">
                        Approved by {p.approved_by_name}
                        {p.approved_at ? ` · ${new Date(p.approved_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                      </div>
                    ) : null}
                  </div>
                  <span className={`nx-badge pa-badge is-${st}`}>
                    {st === 'pending' ? 'AWAITING APPROVAL' : st.toUpperCase()}
                  </span>
                </div>

                <div className="pa-card-actions">
                  <button type="button" className="nx-btn nx-btn-md nx-btn-secondary pa-btn-link"
                    onClick={() => setOpenId(open ? null : p.id)}>
                    {open ? '▴ Hide Details' : '▾ View Details'}
                  </button>
                  {st === 'pending' && (
                    <>
                      <button className="nx-btn nx-btn-md nx-btn-success pa-btn-ok" disabled={busy === p.id}
                        onClick={() => act(p, 'approve')}>
                        <Icon name="check" /> Approve
                      </button>
                      <button className="nx-btn nx-btn-md nx-btn-danger pa-btn-bad" disabled={busy === p.id}
                        onClick={() => { setRejecting(p); setReason(''); }}>
                        <Icon name="x" /> Reject
                      </button>
                    </>
                  )}
                </div>

                {open && <ProjectDetail project={p} />}
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
