'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, loiHref, authHeaders } from '../../../constants/api';
import DateFilter from '../_DateFilter';
import { isManagerRole } from '../../../lib/moduleAccess';
import { unitLabel } from '../../../lib/bookingUnit';
import BookingDetails from '../../../components/BookingDetails';


import Icon from '../../../components/Icon';
import { confirmDialog, notify } from '../../../lib/notify';
import Loader from '../../../components/Loader';
// Open the confidential LOI via a short-lived signed URL (never a public link).
async function openLoi(id) {
  try {
    const r = await fetch(SALES_ENDPOINTS.bookingLoiUrl(id), { headers: authHeaders() });
    const d = await r.json();
    if (r.ok && d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
    else notify('Could not open the LOI.');
  } catch { notify('Could not open the LOI.'); }
}

// Cancelled sits beside Rejected rather than inside it: both are stored at
// status='rejected', but one was refused before it counted and the other was a live
// sale that came off the books and keeps its signed LOI. The server splits them.
const TABS = [['draft', 'Drafts'], ['pending', 'Pending'], ['sold', 'Approved'],
              ['rejected', 'Rejected'], ['cancelled', 'Cancelled'], ['', 'All']];

// Who decided this booking, and when — the Sales/CP stage, not the Accounts one.
// A deal on the books should name the person who put it there, and a cancellation
// should name whoever took a live sale off them.
function decidedBy(b) {
  if (b.cancelled_by_name) return { label: 'Cancelled by', who: b.cancelled_by_name, at: b.cancelled_at, tone: 'var(--text-2)' };
  if (b.rejected_by_name)  return { label: 'Rejected by',  who: b.rejected_by_name,  at: b.rejected_at,  tone: 'var(--danger)' };
  if (b.approved_by_name)  return { label: 'Approved by',  who: b.approved_by_name,  at: b.approved_at,  tone: 'var(--success)' };
  return null;
}

// Full ISO timestamps render as date + time in IST, matching the backend's TIME_ZONE.
function decidedWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return ' · ' + d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
       + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}

// A sale now clears two gates: the Sales/CP approver puts it on the books, then
// Accounts signs it off, and only then is the unit actually gone — until that second
// sign-off the unit sits on hold, not sold. A rep reading only "APPROVED" would think
// the deal was done, so both gates are shown, in order, on the same card.
function DecidedBy({ b, style }) {
  const d = decidedBy(b);
  const acc = b.accounts_status;
  // The Accounts gate only means anything once Sales/CP has approved. A rejected or
  // cancelled deal never reaches it, and a pending one has not got there yet.
  const showAccounts = b.status === 'sold' && !b.cancelled_by_name;
  if (!d && !showAccounts) return null;
  return (
    <div style={{ marginTop: 4, ...style }}>
      {d && (
        <div style={{ fontSize: 11.5, color: d.tone, fontWeight: 600 }}>
          {d.label} {d.who}<span style={{ color: 'var(--muted)', fontWeight: 500 }}>{decidedWhen(d.at)}</span>
        </div>
      )}
      {showAccounts && acc === 'approved' && (
        <div style={{ fontSize: 11.5, color: 'var(--success)', fontWeight: 600 }}>
          Accounts approved{b.accounts_approved_by_name ? ` by ${b.accounts_approved_by_name}` : ''}
          <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{decidedWhen(b.accounts_approved_at)}</span>
        </div>
      )}
      {showAccounts && acc === 'pending' && (
        <div style={{ fontSize: 11.5, color: 'var(--warning)', fontWeight: 600 }}>
          Awaiting Accounts approval <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· unit held, not yet sold</span>
        </div>
      )}
      {showAccounts && acc === 'rejected' && (
        <div style={{ fontSize: 11.5, color: 'var(--danger)', fontWeight: 600 }}>
          Accounts rejected{b.accounts_rejected_by_name ? ` by ${b.accounts_rejected_by_name}` : ''}
          <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{decidedWhen(b.accounts_rejected_at)}</span>
          {b.accounts_rejected_reason ? <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · {b.accounts_rejected_reason}</span> : null}
        </div>
      )}
    </div>
  );
}

// Download the approved bookings as a workbook — Sales and Channel Partner together,
// which is why it lives in Sales and has no counterpart in the CP module. Shown only
// to someone granted "Download booking Excel" in User Management, and to real admins;
// the server enforces the same rule, this just avoids offering a button that 403s.
export function ExportBookings({ projects, companyId }) {
  const me = useSelector((s) => s.auth.user);
  const allowed = me?.can_export_bookings || me?.role === 'Admin' || me?.is_staff;
  const [project, setProject] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!allowed) return null;

  async function download() {
    setBusy(true); setErr('');
    try {
      const qs = [project ? `project=${project}` : '', companyId ? `company_id=${companyId}` : '']
        .filter(Boolean).join('&');
      const res = await fetch(`${SALES_ENDPOINTS.bookingsExport}${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
      if (!res.ok) {
        // 404 means the server has no such endpoint — the feature is in the code but
        // not on the server this browser is talking to. Saying "try again" for that
        // sends people round in circles.
        setErr(res.status === 403 ? 'You do not have access to download booking data.'
             : res.status === 404 ? 'Not available on this server yet — the backend needs deploying.'
             : 'Download failed. Try again.');
        return;
      }
      // The filename the server chose already names the project and the date.
      const name = (res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1]
        || 'Bookings.xlsx';
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (_) {
      setErr('Download failed. Try again.');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select value={project} onChange={(e) => setProject(e.target.value)}
        style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border-strong)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }}>
        <option value="">All projects</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button onClick={download} disabled={busy} title="Approved bookings, Sales and CP together"
        style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700,
                 cursor: busy ? 'default' : 'pointer', background: 'var(--success-solid)', color: '#fff', opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Preparing…' : '⤓ Excel'}
      </button>
      {/* Says what the sheet holds, because this control also sits above My Bookings
          and the download is emphatically not that list. */}
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>All approved bookings · Sales + CP</span>
      {err && <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{err}</span>}
    </div>
  );
}

export function BookingsContent({ adminView = false, cpOnly = false, cpMode = false }) {
  const router = useRouter();
  const me = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const cq = (sep) => (companyId ? `${sep}company_id=${companyId}` : '');
  const isApprover = me?.role === 'Admin' || isManagerRole(me) || me?.is_staff;
  const isAdmin = me?.role === 'Admin' || me?.is_staff || (me?.admin_modules || []).includes('Sales');
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  // Details on the card, and the revision history loaded on demand — the same record
  // My Bookings shows, because an approver deciding on a deal needs the figures in
  // front of them, not a second screen to go and find.
  const [cardDetails, setCardDetails] = useState({});
  const [revs, setRevs] = useState({});      // booking id → array of versions
  const [revOpen, setRevOpen] = useState({});
  const [revDetails, setRevDetails] = useState({});
  async function toggleRevisions(id) {
    setRevDetails({});   // every open starts collapsed
    setRevOpen((o) => ({ ...o, [id]: !o[id] }));
    if (revs[id]) return;
    try {
      const r = await fetch(SALES_ENDPOINTS.bookingRevisions(id)
        + (companyId ? `?company_id=${companyId}` : ''), { headers: authHeaders() });
      const d = await r.json();
      setRevs((m) => ({ ...m, [id]: Array.isArray(d) ? d : [] }));
    } catch {
      setRevs((m) => ({ ...m, [id]: [] }));
    }
  }
  const [managers, setManagers] = useState([]);
  const [cpModuleUsers, setCpModuleUsers] = useState([]); // for the CP approver picker
  const [projects, setProjects] = useState([]);   // each carries booking_approvers
  const [cfgOpen, setCfgOpen] = useState(false);
  const [savedCfg, setSavedCfg] = useState('');
  const [openProj, setOpenProj] = useState({});   // project name → expanded?
  const toggleProj = (pn) => setOpenProj((o) => ({ ...o, [pn]: !o[pn] }));
  const [q, setQ] = useState('');
  // Booking-date range, from the same filter the dashboards use.
  const [range, setRange] = useState({ from: '', to: '' });
  const [stm, setStm] = useState('');     // '' = every STM
  const [proj, setProj] = useState('');   // '' = every project
  // Resale cuts across every status — a resold unit can be pending, approved or
  // cancelled — so it is a filter beside the others rather than a tab of its own.
  const [resale, setResale] = useState('');   // '' = both, 'yes' = resales only
  const [toCancel, setToCancel] = useState(null);   // booking awaiting cancel confirmation

  useEffect(() => {
    if (!isAdmin) return;
    if (!cpMode) fetch(SALES_ENDPOINTS.distSettings + cq('?'), { headers: authHeaders() }).then(r => r.json()).then((d) => setManagers(d.managers || [])).catch(() => {});
    fetch(SALES_ENDPOINTS.projects + cq('?'), { headers: authHeaders() }).then(r => r.json()).then((d) => setProjects(Array.isArray(d) ? d : [])).catch(() => {});
    if (cpMode) fetch(SALES_ENDPOINTS.cpModuleUsers + cq('&'), { headers: authHeaders() }).then(r => r.json()).then((d) => setCpModuleUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, [isAdmin, companyId, cpMode]);

  // `field` picks which approver list to edit — 'booking_approvers' (regular) or
  // 'cp_booking_approvers' (Channel-Partner-sourced bookings only — see backend
  // _can_approve_cp_project). Same PATCH endpoint, just a different JSON key.
  async function toggleApprover(projId, mgrId, field = 'booking_approvers') {
    let prev = [];
    let next = [];
    setProjects((ps) => ps.map((p) => {
      if (p.id !== projId) return p;
      prev = p[field] || [];
      next = prev.includes(mgrId) ? prev.filter((x) => x !== mgrId) : [...prev, mgrId];
      return { ...p, [field]: next };
    }));
    const r = await fetch(SALES_ENDPOINTS.project(projId) + cq('?'), { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ [field]: next }) }).catch(() => null);
    if (!r || !r.ok) {
      // Undo the optimistic tick and say so — a save that never reached the server
      // must not sit there looking checked, only to silently revert on the next
      // visit with no indication anything went wrong at the time.
      setProjects((ps) => ps.map((p) => (p.id === projId ? { ...p, [field]: prev } : p)));
      notify('Could not save this approver — please try again.');
      return;
    }
    setSavedCfg("Saved"); setTimeout(() => setSavedCfg(''), 1500);
  }

  // Pending lead transfers for the projects this user approves. Same authority as a
  // booking on that project, so it belongs on the same screen.
  const [xfers, setXfers] = useState([]);
  const [xferBusy, setXferBusy] = useState(null);
  function loadTransfers() {
    // cp_only in the Channel Partner module: a lead transfer is a Sales activity, so
    // without it the CP approver was shown transfers for leads that never came through
    // a partner.
    fetch(`${SALES_ENDPOINTS.leadTransfers}?status=pending${companyId ? `&company_id=${companyId}` : ''}${cpOnly ? '&cp_only=true' : ''}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setXfers(Array.isArray(d) ? d : []))
      .catch(() => setXfers([]));
  }
  useEffect(() => { loadTransfers(); }, [companyId, adminView, cpOnly]);

  async function actOnTransfer(id, action) {
    setXferBusy(id);
    await fetch(SALES_ENDPOINTS.leadTransferAction(id), {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }),
    }).catch(() => {});
    setXferBusy(null);
    loadTransfers();
  }

  function load() {
    setLoading(true);
    const q = '?' + [tab ? `status=${tab}` : '', companyId ? `company_id=${companyId}` : '', adminView ? 'admin_view=1' : '', cpOnly ? 'cp_only=true' : ''].filter(Boolean).join('&');
    fetch(SALES_ENDPOINTS.bookings + q, { headers: authHeaders() })
      .then((r) => r.json()).then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  // Collapse state is per project name, so reset it whenever the visible set changes.
  useEffect(() => { load(); setOpenProj({}); }, [tab, companyId, adminView, cpOnly]);

  async function act(id, action) {
    setBusy(id);
    await fetch(`${SALES_ENDPOINTS.bookings}${id}/action/${cq('?')}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }) }).catch(() => {});
    setBusy(null); load();
  }

  // Discarding a draft releases whatever plot(s) it still holds and deletes the row —
  // irreversible, but a draft is scratch work, not a real submission.
  async function discardDraft(id) {
    if (!(await confirmDialog('Discard this draft? This can\'t be undone.'))) return;
    setBusy(id);
    await fetch(SALES_ENDPOINTS.bookingDiscard(id) + cq('?'), { method: 'POST', headers: authHeaders() }).catch(() => {});
    setBusy(null); load();
  }

  // Cancelling an approved booking goes through its closure: that endpoint frees the
  // plot(s), purges the signed LOI from storage and marks the booking CANCELLED.
  // Irreversible, so it always runs behind the confirmation modal below.
  async function cancelBooking(b) {
    setBusy(b.id);
    try {
      const r = await fetch(SALES_ENDPOINTS.closureCancel(b.closure) + cq('?'), { method: 'POST', headers: authHeaders() });
      if (!r.ok) { const d = await r.json().catch(() => ({})); notify('Cancel failed: ' + (d.detail || r.status)); }
    } catch (e) { notify(e.message); }
    setToCancel(null); setBusy(null); load();
  }

  const rupee = (n) => '₹ ' + Math.round(Number(n) || 0).toLocaleString('en-IN');

  // Search across client name, phone and the LOI/unit number. Phones are stored with
  // spaces ("81408 05999") so digit queries are compared digits-only; the LOI's stored
  // filename and the booking id are matched too, since either can be quoted as "LOI no".
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
    // Need a few digits before matching phones, or "1" would hit almost everything.
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
  // Both lists come from the whole tab, not the filtered rows, so choosing one value
  // never removes the other options from its dropdown.
  const stmName = (b) => b.stm_name || '—';
  const projName = (b) => b.project_name || '—';
  const stmOptions = [...new Set(rows.map(stmName))].sort((a, b) => a.localeCompare(b));
  const projOptions = [...new Set(rows.map(projName))].sort((a, b) => a.localeCompare(b));
  const narrowed = !!ql || dated || !!stm || !!proj || !!resale;
  const resaleCount = rows.filter((b) => b.is_resale).length;
  const visible = rows.filter((b) => matches(b) && inRange(b)
    && (!stm || stmName(b) === stm) && (!proj || projName(b) === proj)
    && (!resale || b.is_resale));

  // Project-wise grouping (same shape as the Accounts & Finance bookings view), but
  // applied to whichever tab is selected so approvers keep their per-booking actions.
  const groups = {};
  visible.forEach((b) => { const k = b.project_name || '—'; (groups[k] = groups[k] || []).push(b); });
  const projectNames = Object.keys(groups).sort();
  projectNames.forEach((pn) => groups[pn].sort((a, b) => String(b.booking_date || '').localeCompare(String(a.booking_date || ''))));
  const projectTotal = (pn) => groups[pn].reduce((s, b) => s + (Number(b.final_amount) || 0), 0);
  const grandTotal = projectNames.reduce((s, pn) => s + projectTotal(pn), 0);
  // Short lists (a handful of pending approvals) are more useful open than collapsed —
  // only make the user click through when there's actually a lot to scroll past.
  // Rejected is archival, though: always start it collapsed however few there are.
  // While searching, always open: hits are the point of the search.
  const autoOpen = narrowed || (tab !== 'rejected' && visible.length <= 10);
  const isOpen = (pn) => (openProj[pn] === undefined ? autoOpen : openProj[pn]);
  const tabLabel = (TABS.find(([k]) => k === tab) || ['', 'All'])[1];

  return (
    <div style={{ padding: '24px 28px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Bookings &amp; Approvals</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        {narrowed ? `${visible.length} of ${rows.length}` : rows.length} {tab || 'total'} bookings
      </p>

      {xfers.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(140,148,160,0.18)', borderLeft: '4px solid var(--warning)' }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--warning)', margin: '0 0 2px' }}>
            ⇄ Lead Transfers awaiting your approval · {xfers.length}
          </p>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>
            The lead stays with the current STM until you approve.
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {xfers.map((x) => (
              <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                border: '1px solid var(--surface-2)', borderRadius: 14, padding: '10px 12px', background: 'var(--warning-soft)' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    {x.lead_name || 'Lead'} {x.project_name && <span style={{ fontWeight: 500, color: 'var(--muted)' }}>· {x.project_name}</span>}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '3px 0 0' }}>
                    {x.from_stm_name || 'Unassigned'} <span style={{ color: 'var(--warning)', fontWeight: 700 }}>→</span> {x.to_stm_name}
                    {x.reason ? <span style={{ color: 'var(--muted)' }}> · {x.reason}</span> : null}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => actOnTransfer(x.id, 'reject')} disabled={xferBusy === x.id}
                    style={{ padding: '8px 14px', background: 'var(--surface)', color: 'var(--danger)', border: '1.5px solid var(--danger-2)', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
                  <button onClick={() => actOnTransfer(x.id, 'approve')} disabled={xferBusy === x.id}
                    style={{ padding: '8px 16px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                    {xferBusy === x.id ? '…' : 'Approve'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && !cpMode && (
        <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
          <button onClick={() => setCfgOpen((o) => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--accent)', padding: 0 }}>
            <Icon name="settings" /> Booking Approvers — by project {cfgOpen ? '▴' : '▾'} {savedCfg && <span style={{ color: 'var(--success)', fontWeight: 700 }}> {savedCfg}</span>}
          </button>
          {cfgOpen && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>For each project, pick the managers who approve its bookings. They get a push notification on each new booking for that project.</div>
              {managers.length === 0 ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No managers in this company.</div> : projects.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: '1px solid var(--surface-2)' }}>
                  <div style={{ width: 180, minWidth: 180, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                  <ApproverDropdown project={p} managers={managers} onToggle={toggleApprover} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* A booking whose lead came through a Channel Partner is gated by this
          separate list instead — same project, different approver(s), so a CP
          deal doesn't depend on who approves the project's other bookings.
          Shown only in the Channel Partner module — the main Sales Approvals
          page keeps just the regular selector above. */}
      {isAdmin && cpMode && (
        <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 18px', marginBottom: 16, boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
          <button onClick={() => setCfgOpen((o) => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--accent)', padding: 0 }}>
            <Icon name="settings" /> Channel Partner Booking Approvers — by project {cfgOpen ? '▴' : '▾'} {savedCfg && <span style={{ color: 'var(--success)', fontWeight: 700 }}> {savedCfg}</span>}
          </button>
          {cfgOpen && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>For each project, pick who approves bookings whose lead came through a Channel Partner. Only they (not the main Sales module's regular approvers) can approve those.</div>
              {cpModuleUsers.length === 0 ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No one has Channel Partner module access yet.</div> : projects.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: '1px solid var(--surface-2)' }}>
                  <div style={{ width: 180, minWidth: 180, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                  <ApproverDropdown project={p} managers={cpModuleUsers} onToggle={(projId, uid) => toggleApprover(projId, uid, 'cp_booking_approvers')} field="cp_booking_approvers" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking-date range — the same control as the dashboards, so a period picked
          here means what it means there. */}
      <DateFilter onChange={setRange} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: tab === k ? 'var(--primary)' : 'var(--surface-3)', color: tab === k ? '#fff' : 'var(--muted)' }}>{label}</button>
          ))}
        </div>
        {!cpMode && <ExportBookings projects={projects} companyId={companyId} />}
        <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13 }}><Icon name="search" /></span>
          {/* Collapse state is keyed by project, so drop it as the query changes —
              otherwise a group the user collapsed earlier would hide its own hits. */}
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpenProj({}); }}
            placeholder="Search name, phone or LOI / unit no…"
            style={{ width: '100%', height: 36, padding: '0 32px 0 32px', borderRadius: 8, border: '1.5px solid var(--border)',
              background: 'var(--surface)', fontSize: 13, color: 'var(--text)', boxSizing: 'border-box' }} />
          {!!q && (
            <button onClick={() => { setQ(''); setOpenProj({}); }} title="Clear search"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none',
                color: 'var(--muted)', fontSize: 15, fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
          )}
        </div>
        {/* Which project, and whose bookings — one value at a time. Options come from
            the loaded tab, so a tab holding a single project or STM shows no control. */}
        {projOptions.length > 1 && (
          <select value={proj} onChange={(e) => { setProj(e.target.value); setOpenProj({}); }}
            style={{ height: 36, padding: '0 10px', borderRadius: 8, border: `1.5px solid ${proj ? 'var(--accent)' : 'var(--border)'}`,
              background: 'var(--surface)', fontSize: 13, fontWeight: proj ? 700 : 500, color: proj ? 'var(--text)' : 'var(--muted)',
              cursor: 'pointer', outline: 'none', maxWidth: 240 }}>
            <option value="">All Projects</option>
            {projOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        {stmOptions.length > 1 && (
          <select value={stm} onChange={(e) => { setStm(e.target.value); setOpenProj({}); }}
            style={{ height: 36, padding: '0 10px', borderRadius: 8, border: `1.5px solid ${stm ? 'var(--accent)' : 'var(--border)'}`,
              background: 'var(--surface)', fontSize: 13, fontWeight: stm ? 700 : 500, color: stm ? 'var(--text)' : 'var(--muted)',
              cursor: 'pointer', outline: 'none', maxWidth: 240 }}>
            <option value="">All STMs</option>
            {stmOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        {/* Only offered when this tab actually holds one — a filter that can only
            ever return nothing is a way to waste a click. */}
        {resaleCount > 0 && (
          <button onClick={() => setResale(resale ? '' : 'yes')}
            title="Units sold once, put back on the market and sold again"
            style={{ height: 36, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', border: `1.5px solid ${resale ? 'var(--accent-deep)' : 'var(--border)'}`,
              background: resale ? 'var(--accent-soft)' : 'var(--surface)', color: resale ? 'var(--accent-deep)' : 'var(--muted)' }}>
            Resale ({resaleCount})
          </button>
        )}
      </div>

      {!loading && visible.length > 0 && (
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          background: 'linear-gradient(135deg,var(--primary),var(--primary-deep))', borderRadius: 18, padding: '16px 20px', boxShadow: '0 2px 8px rgba(47,109,181,0.25)' }}>
          <div style={{ color: 'var(--accent-soft)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {narrowed ? 'Matching' : 'Total'} {tabLabel} · {visible.length} booking{visible.length === 1 ? '' : 's'} · {projectNames.length} project{projectNames.length === 1 ? '' : 's'}
            {dated && <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}> · booked {range.from || '…'} → {range.to || '…'}</span>}
            {!!stm && <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}> · STM {stm}</span>}
            {!!proj && <span style={{ fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}> · {proj}</span>}
          </div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{rupee(grandTotal)}</div>
        </div>
      )}

      {loading ? <Loader label="Loading…" style={{ padding: '28px 0' }} /> : visible.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 18, padding: 40, textAlign: 'center', color: 'var(--muted)', boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
          {ql ? <>No bookings match “{q.trim()}”.</>
            : stm || proj ? <>No bookings for {[stm, proj].filter(Boolean).join(' · ')}{dated ? ' in this date range' : ''}.</>
            : dated ? 'No bookings were booked in this date range.'
            : 'No bookings here.'}
        </div>
      ) : projectNames.map((pn) => (
        <div key={pn} style={{ marginBottom: 12 }}>
          <div onClick={() => toggleProj(pn)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--surface)', borderRadius: 16,
              padding: '14px 18px', boxShadow: '0 2px 8px rgba(140,148,160,0.18)', border: isOpen(pn) ? '1.5px solid var(--blue-2)' : '1.5px solid transparent' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <Icon name="building" /> {pn} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>· {groups[pn].length} booking{groups[pn].length === 1 ? '' : 's'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-deep)' }}>{rupee(projectTotal(pn))}</span>
              <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 800, transform: isOpen(pn) ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
            </div>
          </div>
          {isOpen(pn) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
              {groups[pn].map((b) => (
                <div key={b.id} style={{ background: 'var(--surface)', borderRadius: 18, padding: '16px 18px', boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                        {b.client_name || '—'} {b.revision_no > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--warning)', background: 'var(--warning-soft)', padding: '2px 6px', borderRadius: 20 }}>R{b.revision_no}</span>}
                      {b.is_resale && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent-deep)', background: 'var(--accent-soft)', padding: '2px 6px', borderRadius: 20, marginLeft: 6 }}>RESALE</span>}
                      </div>
                      {/* Project lives in the group header now — don't repeat it on every card. */}
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{b.phone} · {unitLabel(b).isUnit ? `Unit ${unitLabel(b).text}` : unitLabel(b).text}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>STM: {b.stm_name || '—'} · Booked {b.booking_date || '—'}</div>
                      {b.is_resale && b.resale_of_client && (
                      <div style={{ fontSize: 11.5, color: 'var(--accent-deep)', marginTop: 3, fontWeight: 600 }}>
                        Resold from {b.resale_of_client}
                        {b.stm_name ? <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · resold by {b.stm_name}</span> : null}
                      </div>
                    )}
                      <DecidedBy b={b} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-deep)' }}>{rupee(b.final_amount)}</div>
                      {/* accounts_status='rejected' overrides approval_status here — that field
                          still reads "APPROVED" from the Sales/CP stage, which would otherwise
                          show a green/misleading pill for something Accounts has since rejected. */}
                      {(() => {
                        const awaiting = b.status === 'sold' && b.accounts_status === 'pending';
                        const text = b.accounts_status === 'rejected' ? 'REJECTED BY ACCOUNTS'
                          : awaiting ? 'AWAITING ACCOUNTS'
                          : (b.approval_status || b.status || '').toUpperCase();
                        return <span style={statusPill(awaiting ? 'pending' : b.status)}>{text}</span>;
                      })()}
                    </div>
                  </div>
                  {b.accounts_status === 'rejected' && (
                    <div style={{ marginTop: 10, background: 'var(--danger-soft)', border: '1px solid var(--danger-2)', borderRadius: 14, padding: '10px 12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                        Rejected by Accounts{b.accounts_rejected_by_name ? ` · ${b.accounts_rejected_by_name}` : ''}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--danger-deep)' }}>{b.accounts_rejected_reason || '—'}</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    {b.loi_document && <button onClick={() => openLoi(b.id)} style={{ ...linkBtn, background: 'var(--surface)', cursor: 'pointer' }}><Icon name="file" /> Signed LOI</button>}
                    {/* A revised deal gets its Details per version inside the history
                        instead — the current version is one of them, so a card-level
                        copy would be the same figures twice. */}
                    {!b.revision_no && (
                      <button onClick={() => setCardDetails((o) => ({ ...o, [b.id]: !o[b.id] }))}
                        style={{ ...linkBtn, background: 'var(--surface)', cursor: 'pointer', borderColor: 'var(--border-strong)', color: 'var(--text)' }}>
                        {cardDetails[b.id] ? '▴ Hide Details' : '▾ Details'}
                      </button>
                    )}
                    {b.revision_no > 0 && (
                      <button onClick={() => toggleRevisions(b.id)}
                        style={{ ...linkBtn, background: 'var(--surface)', cursor: 'pointer' }}>
                        ⟲ Revisions {revOpen[b.id] ? '▴' : '▾'}
                      </button>
                    )}
                    {b.status === 'draft' && (
                      <>
                        <button onClick={() => router.push(`/sales/booking?draft=${b.id}`)} style={{ ...actBtn, background: 'var(--primary)' }}>▸ Resume</button>
                        <button onClick={() => discardDraft(b.id)} disabled={busy === b.id}
                          style={{ ...actBtn, background: 'var(--danger-soft)', color: 'var(--danger)', border: '1.5px solid var(--danger-2)' }}><Icon name="x" /> Discard</button>
                      </>
                    )}
                    {/* The server decides per booking, not per person: routing sends a
                        CP-sourced deal to the project's CP approvers and everything
                        else to its regular ones. A CP manager looking at a walk-in
                        they booked themselves is not its approver, and offering the
                        buttons anyway made the click fail silently. */}
                    {b.status === 'pending' && isApprover && b.can_approve && (
                      <>
                        <button onClick={() => act(b.id, 'approve')} disabled={busy === b.id} style={{ ...actBtn, background: 'var(--success-solid)' }}><Icon name="check" /> Approve</button>
                        <button onClick={() => act(b.id, 'reject')} disabled={busy === b.id} style={{ ...actBtn, background: 'var(--danger-solid)' }}><Icon name="x" /> Reject</button>
                      </>
                    )}
                    {b.status === 'sold' && (() => {
                      const isEoi = String(b.plot_numbers || '').toUpperCase().startsWith('EOI');
                      return (
                        <>
                          {isEoi && <button onClick={() => router.push(`/sales/closure/${b.project}?convertEoi=${b.id}`)} style={{ ...actBtn, background: 'var(--warning-solid)' }}>→ Convert to LOI</button>}
                          <button onClick={() => router.push(`/sales/booking?revise=${b.id}${isEoi ? '&eoi=1' : ''}`)} style={{ ...actBtn, background: 'var(--primary)' }}>↻ {isEoi ? 'Revise EOI' : 'Revise LOI'}</button>
                          {/* Only an approver can cancel, and only once the booking has a
                              closure to cancel through. */}
                          {isApprover && b.closure && (
                            <button onClick={() => setToCancel(b)} disabled={busy === b.id}
                              style={{ ...actBtn, background: 'var(--danger-soft)', color: 'var(--danger)', border: '1.5px solid var(--danger-2)' }}><Icon name="x" /> Cancel Booking</button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {!b.revision_no && cardDetails[b.id] && <BookingDetails b={b} accent="#2F6DB5" />}
                  {revOpen[b.id] && (
                    <div style={{ marginTop: 12, borderTop: '1.5px solid var(--surface-3)', paddingTop: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', letterSpacing: 0.6, marginBottom: 8 }}>
                        REVISION HISTORY
                      </div>
                      {!revs[b.id] ? <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Loading…</p>
                       : revs[b.id].length === 0 ? <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Couldn&apos;t load the history.</p>
                       : revs[b.id].map((v) => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                          padding: '7px 0', borderBottom: '1px solid var(--surface-2)' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: v.id === b.id ? 'var(--success)' : 'var(--text-3)',
                            background: v.id === b.id ? 'var(--success-soft)' : 'var(--surface-2)', padding: '3px 8px', borderRadius: 20 }}>
                            R{v.revision_no || 0}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{rupee(v.final_amount)}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            Booked {v.booking_date || '—'} · {(v.approval_status || v.status || '').toUpperCase()}
                            {v.stm_name ? ` · ${v.stm_name}` : ''}
                          </span>
                          {v.id === b.id
                            ? <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--success)' }}>CURRENT</span>
                            : <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)' }}>superseded</span>}
                          <span style={{ flex: 1 }} />
                          {v.loi_document
                            ? <button onClick={() => openLoi(v.id)}
                                style={{ ...linkBtn, padding: '5px 10px', fontSize: 12, background: 'var(--surface)', cursor: 'pointer' }}>
                                <Icon name="file" /> Signed LOI
                              </button>
                            : <span style={{ fontSize: 11, color: 'var(--faint)' }}>no LOI on file</span>}
                          <button onClick={() => setRevDetails((o) => ({ ...o, [v.id]: !o[v.id] }))}
                            style={{ ...linkBtn, padding: '5px 10px', fontSize: 12, background: 'var(--surface)', cursor: 'pointer',
                              borderColor: 'var(--border-strong)', color: 'var(--text)' }}>
                            {revDetails[v.id] ? '▴ Hide Details' : '▾ Details'}
                          </button>
                          {revDetails[v.id] && (
                            <div style={{ width: '100%' }}><BookingDetails b={v} accent="#2F6DB5" /></div>
                          )}
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

      {toCancel && (
        <CancelBookingModal b={toCancel} rupee={rupee} busy={busy === toCancel.id}
          onClose={() => setToCancel(null)} onConfirm={() => cancelBooking(toCancel)} />
      )}
    </div>
  );
}

// Cancelling frees the unit and destroys the signed LOI — irreversible, so spell out
// exactly which booking is going and what it costs before letting it through.
function CancelBookingModal({ b, rupee, busy, onClose, onConfirm }) {
  const unit = unitLabel(b).isUnit ? `Unit ${unitLabel(b).text}` : unitLabel(b).text;
  return (
    <div onClick={busy ? undefined : onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(var(--ink-rgb),0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 50px rgba(var(--ink-rgb),0.3)' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)', marginBottom: 6 }}>Cancel this booking?</div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.6 }}>
          This frees the unit back to <b>available</b>, permanently deletes the signed
          {' '}{String(b.plot_numbers || '').toUpperCase().startsWith('EOI') ? 'EOI' : 'LOI'} from storage,
          and removes it from conversions. <b>This cannot be undone.</b>
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
          <button onClick={onClose} disabled={busy}
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

export default function BookingsPage() {
  return <BookingsContent />;
}

function ApproverDropdown({ project, managers, onToggle, field = 'booking_approvers' }) {
  const [open, setOpen] = useState(false);
  const sel = project[field] || [];
  const selNames = managers.filter((m) => sel.includes(m.id)).map((m) => m.name);
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
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30, background: 'var(--surface)',
            border: '1px solid var(--surface-3)', borderRadius: 14, boxShadow: '0 10px 30px rgba(110,114,120,0.18)', maxHeight: 260, overflowY: 'auto', padding: 4 }}>
            {managers.map((m) => {
              const on = sel.includes(m.id);
              return (
                <div key={m.id} onClick={() => onToggle(project.id, m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 7, cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff', background: on ? 'var(--primary)' : 'var(--surface)', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border-strong)'}` }}>{on ? <Icon name="check" /> : ''}</span>
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

// A booking that Sales/CP has approved but Accounts has not is NOT a finished sale —
// the unit is on hold, not sold. Showing a green APPROVED there told a rep the deal
// was done a stage early, so the pill says what is actually true.
function statusPill(s) {
  const map = { draft: ['var(--accent)', 'var(--accent-softer)'], pending: ['var(--warning)', 'var(--warning-soft)'], sold: ['var(--success)', 'var(--success-soft)'], rejected: ['var(--danger)', 'var(--danger-soft)'], hold: ['var(--warning)', 'var(--warning-soft)'] };
  const [c, bg] = map[s] || ['var(--text-3)', 'var(--surface-2)'];
  return { display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 800, color: c, background: bg, padding: '3px 9px', borderRadius: 20 };
}
const actBtn = { padding: '8px 16px', borderRadius: 8, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const linkBtn = { padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--blue-2)', color: 'var(--accent)', fontSize: 13, fontWeight: 700, textDecoration: 'none' };
