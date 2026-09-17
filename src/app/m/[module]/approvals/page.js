'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../../constants/api';
import DateFilter from '../../../sales/_DateFilter';
import { unitLabel } from '../../../../lib/bookingUnit';
import BookingDetails, { fmtDateTime } from '../../../../components/BookingDetails';

import Icon from '../../../../components/Icon';
import { notify } from '../../../../lib/notify';
import Loader from '../../../../components/Loader';
const rupee = (n) => '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const isEoi = (b) => String(b.plot_numbers || '').toUpperCase().startsWith('EOI');
// Project / STM pickers — sized to sit under the date filter in this module's teal.
const modSel = { height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--border)',
  background: 'var(--surface)', fontSize: 13, cursor: 'pointer', outline: 'none', maxWidth: 240 };

// Open the confidential LOI/EOI PDF via a short-lived signed URL (never a public link).
async function openLoi(id) {
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(id), { headers: authHeaders() });
    const d = await r.json();
    if (r.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
    else notify('Could not open the document.');
  } catch { notify('Could not open the document.'); }
}

// Download the signed PDF to disk (fetch the blob so it saves instead of opening).
async function downloadLoi(b) {
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(b.id), { headers: authHeaders() });
    const d = await r.json();
    if (!r.ok || !d.url) { notify('Could not download the document.'); return; }
    const name = `${isEoi(b) ? 'EOI' : 'LOI'}_${(b.project_name || '').replace(/\s+/g, '_')}_${(b.plot_numbers || b.plot_number || '').replace(/[\s,]+/g, '')}_${(b.client_name || '').replace(/\s+/g, '_')}.pdf`;
    try {
      const blob = await (await fetch(d.url)).blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = objUrl; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
    } catch { window.open(d.url, '_blank', 'noopener,noreferrer'); }  // CORS fallback → open
  } catch { notify('Could not download the document.'); }
}

function statusPill(s) {
  const map = { pending: ['var(--warning)', 'var(--warning-soft)'], sold: ['var(--success)', 'var(--success-soft)'], rejected: ['var(--danger)', 'var(--danger-soft)'], hold: ['var(--warning)', 'var(--warning-soft)'] };
  const [c, bg] = map[s] || ['var(--text-3)', 'var(--surface-2)'];
  return { display: 'inline-block', fontSize: 10, fontWeight: 800, color: c, background: bg, padding: '3px 9px', borderRadius: 20 };
}

const TABS = [['awaiting_sales', 'Awaiting Sales'], ['awaiting_cp', 'Awaiting CP'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']];
const actBtn = { padding: '8px 16px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };

// Which project id's Accounts approver list `field` picks — 'accounts_booking_approvers'
// (regular) or 'accounts_cp_booking_approvers' (Channel-Partner-sourced bookings), mirroring
// the same split Sales uses for its own approver lists.
function ApproverDropdown({ project, users, sel, onToggle }) {
  const [open, setOpen] = useState(false);
  const selNames = users.filter((m) => sel.includes(m.id)).map((m) => m.name);
  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: 460 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer',
        fontSize: 13, color: selNames.length ? 'var(--text)' : 'var(--faint)', textAlign: 'left',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selNames.length ? 600 : 400 }}>
          {selNames.length ? selNames.join(', ') : 'Select approvers…'}
        </span>
        <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
          <div className="nx-popover" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30, background: 'var(--surface)',
            border: '1px solid var(--surface-3)', borderRadius: 14, boxShadow: '0 10px 30px rgba(110,114,120,0.18)', maxHeight: 260, overflowY: 'auto', padding: 4 }}>
            {users.map((m) => {
              const on = sel.includes(m.id);
              return (
                <div key={m.id} onClick={() => onToggle(project.id, m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 7, cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff', background: on ? 'var(--success-solid)' : 'var(--surface)', border: `1.5px solid ${on ? 'var(--success)' : 'var(--border-strong)'}` }}>{on ? <Icon name="check" /> : ''}</span>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{m.name}</span>
                  {m.designation && <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {m.designation}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Rejecting requires remarks — this is the only way AccountsBookingActionView will
// accept a reject, and those remarks are what shows up in the Rejected tab.
function RejectModal({ b, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const unit = unitLabel(b).isUnit ? `Unit ${unitLabel(b).text}` : unitLabel(b).text;
  return (
    <div className="nx-modal-backdrop" onClick={busy ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(var(--ink-rgb),0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="nx-modal" onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 50px rgba(var(--ink-rgb),0.3)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)', marginBottom: 6 }}>Reject this booking?</div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.6 }}>
          {b.client_name || '—'} · {b.project_name || '—'} · {unit}. This frees the unit back to <b>available</b>
          {' '}and marks the booking rejected. The STM and the Sales/CP approver(s) for this project will be notified with your remarks below.
        </p>
        <textarea className="nx-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Remarks (required) — why is this being rejected?"
          rows={4} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 14, border: '1.5px solid var(--border)', padding: 10, fontSize: 13, resize: 'vertical', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} disabled={busy}
            style={{ padding: '10px 18px', borderRadius: 9, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
            Cancel
          </button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={busy || !reason.trim()}
            style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: (busy || !reason.trim()) ? 'var(--danger-2)' : 'var(--danger-solid)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: (busy || !reason.trim()) ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Rejecting…' : 'Yes, Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Cancelling frees the unit and destroys the signed LOI — irreversible, so spell out
// exactly which booking is going and what it costs before letting it through. Mirrors
// Sales' own CancelBookingModal exactly (same endpoint, same consequence).
function CancelBookingModal({ b, busy, onClose, onConfirm }) {
  const unit = unitLabel(b).isUnit ? `Unit ${unitLabel(b).text}` : unitLabel(b).text;
  return (
    <div className="nx-modal-backdrop" onClick={busy ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(var(--ink-rgb),0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="nx-modal" onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 50px rgba(var(--ink-rgb),0.3)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)', marginBottom: 6 }}>Cancel this booking?</div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.6 }}>
          This frees the unit back to <b>available</b>, permanently deletes the signed
          {' '}{isEoi(b) ? 'EOI' : 'LOI'} from storage, and removes it from conversions. It will then show under
          {' '}<b>Cancelled</b> in Bookings. <b>This cannot be undone.</b>
        </p>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', marginBottom: 20 }}>
          {[['Client', b.client_name || '—'], ['Project', b.project_name || '—'], ['Unit', unit], ['Amount', rupee(b.final_amount)]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{k}</span>
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} disabled={busy}
            style={{ padding: '10px 18px', borderRadius: 9, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
            Keep Booking
          </button>
          <button onClick={onConfirm} disabled={busy}
            style={{ padding: '10px 18px', borderRadius: 9, border: 'none', background: busy ? 'var(--danger-2)' : 'var(--danger-solid)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Cancelling…' : 'Yes, Cancel Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Accounts & Finance — Approvals: review every sales booking (LOI + EOI), grouped by
// project, and (for configured Accounts approvers) approve/reject each one's separate
// Accounts-stage sign-off. A booking now only counts as truly "in Accounts" once
// approved here — Sales/CP approval alone just puts it in the Pending tab. Once
// approved it also moves to the Bookings ledger; Cancel (undoing that approval, same
// as Sales' own Cancel Booking) lives here too, in the Approved tab.
export default function ModuleApprovalsPage() {
  const me = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cq = (sep) => (companyId ? `${sep}company_id=${companyId}` : '');
  // Who may configure the Accounts approver lists — a real admin only. Unlike
  // Sales' own gate (isAdmin in sales/bookings/page.js), an Accounts Admin-Modules
  // user does NOT get this — who can approve money-stage sign-offs is deliberately
  // restricted tighter than Sales' own approver setup. Mirrors the matching
  // server-side gate in ProjectDetailView.patch.
  const isAccountsAdmin = me?.role === 'Admin' || me?.is_staff;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState(null);
  const [toReject, setToReject] = useState(null);  // booking awaiting reject-with-remarks
  const [toCancel, setToCancel] = useState(null);  // approved booking awaiting cancel confirmation
  const [open, setOpen] = useState({});
  const toggle = (pn) => setOpen((o) => ({ ...o, [pn]: !o[pn] }));
  const [detailsOpen, setDetailsOpen] = useState({});
  const toggleDetails = (id) => setDetailsOpen((o) => ({ ...o, [id]: !o[id] }));
  // Revision history, fetched per booking on demand: only a handful of deals are
  // ever revised, so loading every chain up front would be work for nothing.
  const [revs, setRevs] = useState({});      // booking id → array of versions
  const [revOpen, setRevOpen] = useState({});
  // Details inside the history get their own key space, separate from the card's: the
  // current version shares the booking's id, so one shared map let a single toggle
  // open two blocks at once. Cleared on every open so the history starts collapsed —
  // it is opened to scan the versions, and a panel left open buries that list.
  const [revDetails, setRevDetails] = useState({});
  const toggleRevDetails = (id) => setRevDetails((o) => ({ ...o, [id]: !o[id] }));
  async function toggleRevisions(id) {
    setRevDetails({});
    setRevOpen((o) => ({ ...o, [id]: !o[id] }));
    if (revs[id]) return;                      // already loaded, just reopening
    try {
      const r = await fetch(SALES_ENDPOINTS.bookingRevisions(id)
        + (companyId ? `?company_id=${companyId}` : ''), { headers: authHeaders() });
      const d = await r.json();
      setRevs((m) => ({ ...m, [id]: Array.isArray(d) ? d : [] }));
    } catch {
      setRevs((m) => ({ ...m, [id]: [] }));
    }
  }
  // Same filters as the Sales approvals view: search, booking date, project, STM.
  const [q, setQ] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [proj, setProj] = useState('');   // '' = every project
  const [stm, setStm] = useState('');     // '' = every STM

  // Approver Setup — Accounts-stage approvers, by project (regular + Channel Partner).
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cpCfgOpen, setCpCfgOpen] = useState(false);
  const [savedCfg, setSavedCfg] = useState('');
  const [projects, setProjects] = useState([]);
  const [accountsUsers, setAccountsUsers] = useState([]);

  useEffect(() => {
    if (!isAccountsAdmin) return;
    fetch(SALES_ENDPOINTS.projects + cq('?'), { headers: authHeaders() }).then(r => r.json()).then((d) => setProjects(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(SALES_ENDPOINTS.accountsModuleUsers + cq('&'), { headers: authHeaders() }).then(r => r.json()).then((d) => setAccountsUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, [isAccountsAdmin, companyId]);

  // `field` picks which approver list to edit — mirrors Sales' own toggleApprover.
  async function toggleApprover(projId, uid, field) {
    let prev = [];
    let next = [];
    setProjects((ps) => ps.map((p) => {
      if (p.id !== projId) return p;
      prev = p[field] || [];
      next = prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid];
      return { ...p, [field]: next };
    }));
    const r = await fetch(SALES_ENDPOINTS.project(projId) + cq('?'), { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ [field]: next }) }).catch(() => null);
    if (!r || !r.ok) {
      // Undo the optimistic tick and say so — a save that never reached the server
      // must not sit there looking checked. Silently swallowing this (the old
      // behaviour) is exactly how several projects here ended up missing an
      // approver that the panel had shown as "Saved ✓": nothing surfaced the
      // failure at the time, so it only reappeared as a mystery on the next visit.
      setProjects((ps) => ps.map((p) => (p.id === projId ? { ...p, [field]: prev } : p)));
      notify('Could not save this approver — please try again.');
      return;
    }
    setSavedCfg("Saved"); setTimeout(() => setSavedCfg(''), 1500);
  }

  function load() {
    setLoading(true); setErr('');
    fetch(SALES_ENDPOINTS.bookingsAll + (companyId ? `?company_id=${companyId}` : ''), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch((s) => { setErr(s === 403 ? 'You do not have access to bookings.' : 'Could not load bookings.'); setLoading(false); });
  }
  useEffect(() => { load(); }, [companyId]);

  async function act(id, action, reason) {
    setBusy(id);
    const r = await fetch(SALES_ENDPOINTS.bookingAccountsAction(id) + cq('?'), {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(reason ? { action, reason } : { action }),
    }).catch(() => null);
    if (!r || !r.ok) {
      const d = r ? await r.json().catch(() => ({})) : {};
      notify((action === 'approve' ? 'Approve' : 'Reject') + ' failed: ' + (d.detail || 'Network error.'));
    }
    setBusy(null); setToReject(null); load();
  }

  // Cancelling an approved booking goes through its closure: that endpoint frees the
  // plot(s), purges the signed LOI from storage and marks the booking CANCELLED — the
  // same endpoint Sales' own Cancel Booking uses, now also reachable by an Accounts
  // approver for the booking's project (see ClosureCancelView's dual-authority gate).
  async function cancelBooking(b) {
    setBusy(b.id);
    try {
      const r = await fetch(SALES_ENDPOINTS.closureCancel(b.closure) + cq('?'), { method: 'POST', headers: authHeaders() });
      if (!r.ok) { const d = await r.json().catch(() => ({})); notify('Cancel failed: ' + (d.detail || r.status)); }
    } catch (e) { notify(e.message); }
    setToCancel(null); setBusy(null); load();
  }

  // Accounts-stage tabs — distinct from the Sales/CP `status`/`approval_status` a
  // booking already carries. Awaiting Sales / Awaiting CP are read-only views into
  // the earlier stage of the pipeline: a booking still awaiting Sales/CP itself
  // (status='pending') hasn't reached Accounts yet, so it sits in its own tab
  // rather than mixed into Pending — split the same way the approver lists
  // themselves split, by is_cp_sourced (the same flag that routes which approver
  // list gates it there). can_accounts_approve is false for it either way
  // (approving requires status='sold' first), so Approve/Reject simply don't
  // render there — it stays "just shown" until Sales/CP actually approves it.
  // Rejected or cancelled at that earlier stage never reaches any of these tabs,
  // same as before this feature existed. A booking cancelled after Accounts
  // approval (approval_status='CANCELLED') drops out of Approved too — it belongs
  // to the Cancelled view in Bookings, not here.
  const isCancelled = (b) => String(b.approval_status || '').toUpperCase() === 'CANCELLED';
  const inTab = {
    awaiting_sales: (b) => b.status === 'pending' && !b.is_cp_sourced,
    awaiting_cp:    (b) => b.status === 'pending' && b.is_cp_sourced,
    pending:  (b) => b.status === 'sold' && b.accounts_status === 'pending',
    approved: (b) => b.status === 'sold' && b.accounts_status === 'approved' && !isCancelled(b),
    rejected: (b) => b.accounts_status === 'rejected',
  }[tab];
  const tabRows = rows.filter(inTab);

  // Search across client name, phone and the LOI/unit number — same rules as the
  // Sales approvals search. Phones are stored with spaces ("81408 05999") so digit
  // queries compare digits-only; the LOI's stored filename and the booking id are
  // matched too, since either can be quoted as "LOI no".
  const ql = q.trim().toLowerCase();
  const qDigits = ql.replace(/\D/g, '');
  // Only treat the query as a phone/id when it is ALL digits and separators — otherwise
  // "shop1" would strip to "1" and match every phone containing a 1.
  const numericQuery = !!qDigits && /^[\d\s+()-]+$/.test(ql);
  const matches = (b) => {
    if (!ql) return true;
    const text = [b.client_name, b.plot_numbers, b.plot_number, b.area, b.loi_document];
    if (text.some((v) => String(v || '').toLowerCase().includes(ql))) return true;
    if (!numericQuery) return false;
    if (String(b.id) === qDigits) return true;
    return qDigits.length >= 3 && String(b.phone || '').replace(/\D/g, '').includes(qDigits);
  };

  // Booking date is a plain YYYY-MM-DD, so the range compares as strings. A booking
  // with no date can't be placed in time, so a live range excludes it rather than
  // silently counting it in every period.
  const dated = !!(range.from || range.to);
  const inRange = (b) => {
    if (!dated) return true;
    const d = String(b.booking_date || '');
    if (!d) return false;
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  };
  // Both option lists come from every booking in this tab, not the filtered set, so
  // choosing one value never removes the other options from its dropdown.
  const stmName = (b) => b.stm_name || '—';
  const projName = (b) => b.project_name || '—';
  const stmOptions = [...new Set(tabRows.map(stmName))].sort((a, b) => a.localeCompare(b));
  const projOptions = [...new Set(tabRows.map(projName))].sort((a, b) => a.localeCompare(b));
  const narrowed = !!ql || dated || !!stm || !!proj;

  const groups = {};
  tabRows
    .filter((b) => matches(b) && inRange(b) && (!stm || stmName(b) === stm) && (!proj || projName(b) === proj))
    .forEach((b) => { const k = b.project_name || '—'; (groups[k] = groups[k] || []).push(b); });
  const projectNames = Object.keys(groups).sort();
  // Rejected/Pending: latest first by when that Accounts action happened / booking was
  // sold. Approved: latest accounts-approval first — falls back to approved_at (the
  // Sales approval) for historical bookings grandfathered in before this field existed.
  // Awaiting Sales has no approval timestamp yet at all, so it sorts by when it was
  // booked instead.
  const sortKey = (b) => tab === 'rejected' ? (b.accounts_rejected_at || '')
    : tab === 'approved' ? (b.accounts_approved_at || b.approved_at || '')
    : (tab === 'awaiting_sales' || tab === 'awaiting_cp') ? (b.created_at || '')
    : (b.approved_at || '');
  projectNames.forEach((pn) => groups[pn].sort((a, b) => sortKey(b).localeCompare(sortKey(a))));
  const projectTotal = (pn) => groups[pn].reduce((s, b) => s + (Number(b.final_amount) || 0), 0);
  const grandTotal = projectNames.reduce((s, pn) => s + projectTotal(pn), 0);
  const grandCount = projectNames.reduce((s, pn) => s + groups[pn].length, 0);
  const tabLabel = (TABS.find(([k]) => k === tab) || ['', ''])[1];

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Approvals</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>LOI &amp; EOI bookings, project-wise — approve, reject, or cancel each one's Accounts-stage sign-off</p>

      {isAccountsAdmin && (
        <div className="nx-card" style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 18px', marginTop: 16, boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
          <button className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => setCfgOpen((o) => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--success)', padding: 0 }}>
            <Icon name="settings" /> Accounts Approvers — by project {cfgOpen ? '▴' : '▾'} {savedCfg && <span style={{ color: 'var(--success)', fontWeight: 700 }}> {savedCfg}</span>}
          </button>
          {cfgOpen && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>For each project, pick who signs off on its bookings at the Accounts stage. A booking only leaves the Pending tab once one of them approves it.</div>
              {accountsUsers.length === 0 ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No one has Accounts &amp; Finance module access yet.</div> : projects.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: '1px solid var(--surface-2)' }}>
                  <div style={{ width: 180, minWidth: 180, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                  <ApproverDropdown project={p} users={accountsUsers} sel={p.accounts_booking_approvers || []}
                    onToggle={(pid, uid) => toggleApprover(pid, uid, 'accounts_booking_approvers')} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAccountsAdmin && (
        <div className="nx-card" style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 18px', marginTop: 12, boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
          <button className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => setCpCfgOpen((o) => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--success)', padding: 0 }}>
            <Icon name="settings" /> Channel Partner Accounts Approvers — by project {cpCfgOpen ? '▴' : '▾'} {savedCfg && <span style={{ color: 'var(--success)', fontWeight: 700 }}> {savedCfg}</span>}
          </button>
          {cpCfgOpen && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Same idea, but for bookings whose lead came through a Channel Partner — routed to this separate list instead.</div>
              {accountsUsers.length === 0 ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No one has Accounts &amp; Finance module access yet.</div> : projects.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: '1px solid var(--surface-2)' }}>
                  <div style={{ width: 180, minWidth: 180, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                  <ApproverDropdown project={p} users={accountsUsers} sel={p.accounts_cp_booking_approvers || []}
                    onToggle={(pid, uid) => toggleApprover(pid, uid, 'accounts_cp_booking_approvers')} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 18, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.map(([k, label]) => (
            <button className={`nx-btn nx-btn-md nx-toggle${tab === k ? ' is-on' : ''}`} key={k} onClick={() => { setTab(k); setOpen({}); }} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: tab === k ? 'var(--success-solid)' : 'var(--surface-3)', color: tab === k ? '#fff' : 'var(--muted)' }}>{label}</button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13 }}><Icon name="search" /></span>
          {/* Collapse state is keyed by project, so drop it as the query changes —
              otherwise a group the user collapsed earlier would hide its own hits. */}
          <input className="nx-input" value={q} onChange={(e) => { setQ(e.target.value); setOpen({}); }}
            placeholder="Search name, phone or LOI / unit no…"
            style={{ width: '100%', height: 36, padding: '0 32px 0 32px', borderRadius: 8, border: '1.5px solid var(--border)',
              background: 'var(--surface)', fontSize: 13, color: 'var(--text)', boxSizing: 'border-box' }} />
          {!!q && (
            <button className="nx-btn nx-btn-sm nx-btn-ghost" onClick={() => { setQ(''); setOpen({}); }} title="Clear search"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none',
                color: 'var(--muted)', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
          )}
        </div>
      </div>

      {!loading && !err && tabRows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {/* Booking-date range — the same control the dashboards and Sales approvals
              use, so a period picked here means the same thing there. */}
          <DateFilter onChange={setRange} />
          {(projOptions.length > 1 || stmOptions.length > 1) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: -8, marginBottom: 4 }}>
              {projOptions.length > 1 && (
                <select className="nx-input" value={proj} onChange={(e) => { setProj(e.target.value); setOpen({}); }}
                  style={{ ...modSel, borderColor: proj ? 'var(--success)' : 'var(--border)', fontWeight: proj ? 700 : 500, color: proj ? 'var(--text)' : 'var(--muted)' }}>
                  <option value="">All Projects</option>
                  {projOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
              {stmOptions.length > 1 && (
                <select className="nx-input" value={stm} onChange={(e) => { setStm(e.target.value); setOpen({}); }}
                  style={{ ...modSel, borderColor: stm ? 'var(--success)' : 'var(--border)', fontWeight: stm ? 700 : 500, color: stm ? 'var(--text)' : 'var(--muted)' }}>
                  <option value="">All STMs</option>
                  {stmOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !err && projectNames.length > 0 && (
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'var(--success-solid)', borderRadius: 18, padding: '16px 20px', boxShadow: '0 2px 8px rgba(35,135,74,0.25)' }}>
          <div style={{ color: 'var(--success-2)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {narrowed ? 'Matching' : 'Total'} {tabLabel} · {grandCount} booking{grandCount === 1 ? '' : 's'} · {projectNames.length} project{projectNames.length === 1 ? '' : 's'}
            {dated && <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}> · booked {range.from || '…'} → {range.to || '…'}</span>}
            {!!proj && <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}> · {proj}</span>}
            {!!stm && <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}> · STM {stm}</span>}
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{rupee(grandTotal)}</div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        {loading ? <Loader label="Loading…" style={{ padding: '28px 0' }} />
        : err ? <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-2)', color: 'var(--danger)', borderRadius: 16, padding: '14px 18px', fontSize: 13 }}>{err}</div>
        : projectNames.length === 0 ? (
          <div className="nx-card" style={{ background: 'var(--surface)', borderRadius: 18, padding: 40, textAlign: 'center', color: 'var(--muted)', boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
            {narrowed ? `No ${tabLabel.toLowerCase()} bookings match these filters.` : `No ${tabLabel.toLowerCase()} bookings.`}
          </div>
        ) : projectNames.map((pn) => (
          <div key={pn} style={{ marginBottom: 12 }}>
            <div className="nx-card" onClick={() => toggle(pn)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--surface)', borderRadius: 16, padding: '14px 18px', boxShadow: '0 2px 8px rgba(140,148,160,0.18)', border: open[pn] ? '1.5px solid var(--success-2)' : '1.5px solid transparent' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <Icon name="building" /> {pn} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>· {groups[pn].length} booking{groups[pn].length === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-deep)' }}>{rupee(projectTotal(pn))}</span>
                <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 800, transform: open[pn] ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
              </div>
            </div>
            {open[pn] && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {groups[pn].map((b) => (
                  <div className="nx-card" key={b.id} style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 18px', boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                          {isEoi(b)
                            ? <span style={{ color: 'var(--warning-2)' }}>{b.plot_numbers}</span>
                            : <>{unitLabel(b).isUnit ? `Plot ${unitLabel(b).text}` : unitLabel(b).text}</>}
                          <span style={{ color: 'var(--muted)', fontWeight: 600 }}> · {b.client_name || '—'}</span>
                          <span className="nx-badge" style={{ fontSize: 10, fontWeight: 800, color: 'var(--success)', background: 'var(--success-2)', padding: '2px 6px', borderRadius: 20, marginLeft: 6 }}>{isEoi(b) ? 'EOI' : 'LOI'}</span>
                          {b.revision_no > 0 && <span className="nx-badge" style={{ fontSize: 10, fontWeight: 800, color: 'var(--warning)', background: 'var(--warning-soft)', padding: '2px 6px', borderRadius: 20, marginLeft: 6 }}>R{b.revision_no}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{b.phone} · STM {b.stm_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Booked {fmtDateTime(b.created_at)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-deep)' }}>{rupee(b.final_amount)}</div>
                        <div style={{ marginTop: 4 }}><span style={statusPill(b.status)}>{(b.approval_status || b.status || '').toUpperCase()}</span></div>
                        {tab === 'approved' && b.accounts_approved_at && <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>Accounts approved {fmtDateTime(b.accounts_approved_at)}{b.accounts_approved_by_name ? ` · ${b.accounts_approved_by_name}` : ''}</div>}
                        {tab === 'approved' && !b.accounts_approved_at && b.approved_at && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Approved {fmtDateTime(b.approved_at)}</div>}
                        {tab === 'pending' && b.approved_at && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Sold {fmtDateTime(b.approved_at)}</div>}
                      </div>
                    </div>
                    {tab === 'rejected' && (
                      <div style={{ marginTop: 10, background: 'var(--danger-soft)', border: '1px solid var(--danger-2)', borderRadius: 14, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                          Rejected by Accounts{b.accounts_rejected_by_name ? ` · ${b.accounts_rejected_by_name}` : ''}{b.accounts_rejected_at ? ` · ${fmtDateTime(b.accounts_rejected_at)}` : ''}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--danger-deep)' }}>{b.accounts_rejected_reason || '—'}</div>
                      </div>
                    )}
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {/* A revised deal gets its Details per version inside the
                          history instead — the current version is one of them, so a
                          card-level copy is the same figures twice. It also shares an
                          id with that row, which rendered the block twice at once. */}
                      {!b.revision_no && (
                        <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => toggleDetails(b.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          {detailsOpen[b.id] ? '▲ Hide Details' : '▾ Details'}
                        </button>
                      )}
                      {b.loi_document && <>
                        <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => openLoi(b.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--success-2)', background: 'var(--surface)', color: 'var(--success)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><Icon name="file" /> View {isEoi(b) ? 'EOI' : 'LOI'}</button>
                        <button className="nx-btn nx-btn-md nx-btn-success" onClick={() => downloadLoi(b)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--success-solid)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬇ Download {isEoi(b) ? 'EOI' : 'LOI'}</button>
                      </>}
                      {/* Only the latest version is listed here, at its current terms.
                          The earlier ones are what was signed at the time — which for
                          a team reconciling payments against documents is the whole
                          question when a deal carries an R1. */}
                      {b.revision_no > 0 && (
                        <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => toggleRevisions(b.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          ⟲ Revisions {revOpen[b.id] ? '▲' : '▾'}
                        </button>
                      )}
                      {/* Only shown when THIS viewer is actually a configured Accounts
                          approver for this booking's project (server-computed, so this
                          is never the only gate — AccountsBookingActionView re-checks). */}
                      {tab === 'pending' && b.can_accounts_approve && (
                        <>
                          <button className="nx-btn nx-btn-md nx-btn-success" onClick={() => act(b.id, 'approve')} disabled={busy === b.id} style={{ ...actBtn, background: 'var(--success-solid)' }}><Icon name="check" /> Approve</button>
                          <button className="nx-btn nx-btn-md nx-btn-danger" onClick={() => setToReject(b)} disabled={busy === b.id} style={{ ...actBtn, background: 'var(--danger-solid)' }}><Icon name="x" /> Reject</button>
                        </>
                      )}
                      {/* Undoing an Accounts approval — same authority, same server-computed
                          gate pattern (can_accounts_cancel), only once it has a closure to
                          cancel through (it always will if it's status='sold'). */}
                      {tab === 'approved' && b.can_accounts_cancel && (
                        <button className="nx-btn nx-btn-md nx-btn-danger-soft" onClick={() => setToCancel(b)} disabled={busy === b.id}
                          style={{ ...actBtn, background: 'var(--danger-soft)', color: 'var(--danger)', border: '1.5px solid var(--danger-2)' }}><Icon name="x" /> Cancel Booking</button>
                      )}
                    </div>
                    {!b.revision_no && detailsOpen[b.id] && <BookingDetails b={b} />}
                    {revOpen[b.id] && (
                      <div style={{ marginTop: 12, borderTop: '1px dashed var(--border-strong)', paddingTop: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--success)', letterSpacing: 0.6, marginBottom: 8 }}>
                          REVISION HISTORY
                        </div>
                        {!revs[b.id] ? <Loader variant="inline" size="sm" label="Loading…" />
                         : revs[b.id].length === 0 ? <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Couldn&apos;t load the history.</p>
                         : revs[b.id].map((v) => (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                            padding: '7px 0', borderBottom: '1px solid var(--surface-2)' }}>
                            <span className="nx-badge" style={{ fontSize: 11, fontWeight: 800, color: v.id === b.id ? 'var(--success)' : 'var(--text-3)',
                              background: v.id === b.id ? 'var(--success-2)' : 'var(--surface-2)', padding: '3px 8px', borderRadius: 20 }}>
                              R{v.revision_no || 0}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{rupee(v.final_amount)}</span>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                              Booked {v.booking_date || '—'} · {(v.approval_status || v.status || '').toUpperCase()}
                              {v.stm_name ? ` · ${v.stm_name}` : ''}
                            </span>
                            {/* The version marked current is the one the card shows; the
                                rest are superseded and say so rather than looking live. */}
                            {v.id === b.id
                              ? <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--success)' }}>CURRENT</span>
                              : <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>superseded</span>}
                            <span style={{ flex: 1 }} />
                            {v.loi_document ? <>
                              <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => openLoi(v.id)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--success-2)', background: 'var(--surface)', color: 'var(--success)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><Icon name="file" /> View</button>
                              <button className="nx-btn nx-btn-sm nx-btn-success" onClick={() => downloadLoi(v)} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: 'var(--success-solid)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⬇ Download</button>
                            </> : <span style={{ fontSize: 11, color: 'var(--faint)' }}>no document on file</span>}
                            <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => toggleRevDetails(v.id)} style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              {revDetails[v.id] ? '▲ Details' : '▾ Details'}
                            </button>
                            {revDetails[v.id] && <div style={{ width: '100%' }}><BookingDetails b={v} /></div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {toReject && (
        <RejectModal b={toReject} busy={busy === toReject.id}
          onClose={() => setToReject(null)} onConfirm={(reason) => act(toReject.id, 'reject', reason)} />
      )}
      {toCancel && (
        <CancelBookingModal b={toCancel} busy={busy === toCancel.id}
          onClose={() => setToCancel(null)} onConfirm={() => cancelBooking(toCancel)} />
      )}
    </div>
  );
}
