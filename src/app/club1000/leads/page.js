'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { isClub1000Manager } from '../../../lib/moduleAccess';
import AddInvestorModal from '../_AddInvestorModal';

import Icon from '../../../components/Icon';
import { confirmDialog, notify } from '../../../lib/notify';
import Loader from '../../../components/Loader';
import { onlyPresent } from '../../../lib/presentOptions';
import { errText } from '../../../lib/apiError';
import { C1Modal, C1Section, C1Field, C1Value, C1Error } from '../_Form';
import { schemeLabel } from '../../../lib/c1Scheme';

const STATUS_COLORS = {
  new: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  contacted: { bg: 'var(--warning-soft)', fg: 'var(--warning-2)' },
  interested: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  not_interested: { bg: 'var(--surface-2)', fg: 'var(--text-3)' },
  converted: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  lost: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
  investor_deleted: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },   // was converted; the investment was deleted
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' };
  return <span className="c1l-badge" style={{ background: c.bg, color: c.fg }}>{(status || '').replace(/_/g, ' ')}</span>;{/* inline-ok: colour per status */}
}

const HISTORY_LABEL = { created: 'Lead Created', status: 'Status', assigned_to: 'Assigned To' };

const SOURCE_LABELS = { referral: 'Referral', walk_in: 'Walk-in', website: 'Website', other: 'Other' };
const STATUS_OPTIONS = ['new', 'contacted', 'interested', 'not_interested', 'converted', 'lost', 'investor_deleted'];
// A lead in one of these has nothing left to follow up on — matches the backend's
// terminal-status handling in LeadDetailView.patch (clears next_follow_up_date).
const TERMINAL_STATUSES = ['not_interested', 'lost', 'converted', 'investor_deleted'];

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in LOCAL time.
function toDatetimeLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// <input type="date"> wants "YYYY-MM-DD" in LOCAL time.
function toISODate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function AddLeadModal({ schemes, assignees, manager, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', phone: '', alt_phone: '', email: '', reference_name: '', reference_phone: '',
    source: 'referral', lead_date: toISODate(new Date()), scheme_interest: '', amount_interested: '', assigned_to: '', remarks: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setError(''); setBusy(true);
    try {
      const payload = { ...form };
      if (form.source !== 'referral') { delete payload.reference_name; delete payload.reference_phone; }
      if (!payload.scheme_interest) delete payload.scheme_interest;
      if (!payload.amount_interested) delete payload.amount_interested;
      if (!payload.assigned_to) delete payload.assigned_to;
      const res = await apiFetch(CLUB1000_ENDPOINTS.leads, { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(errText(data, 'Could not add lead.')); return; }
      onCreated(data);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <C1Modal title="Add Lead" sub="Someone who has enquired about a scheme" onClose={onClose} onSubmit={submit}
      footer={<>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="nx-btn nx-btn-md nx-btn-success" disabled={busy}>{busy ? 'Saving…' : 'Add Lead'}</button>
      </>}>
      <C1Section title="Contact">
        <C1Field label="Name" required><input className="nx-input" value={form.name} onChange={upd('name')} required /></C1Field>
        <C1Field label="Phone"><input className="nx-input" value={form.phone} onChange={upd('phone')} /></C1Field>
        <C1Field label="Alt phone"><input className="nx-input" value={form.alt_phone} onChange={upd('alt_phone')} /></C1Field>
        <C1Field label="Email"><input className="nx-input" type="email" value={form.email} onChange={upd('email')} /></C1Field>
      </C1Section>
      <C1Section title="Source">
        <C1Field label="Source">
          <select className="nx-input" value={form.source} onChange={upd('source')}>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </C1Field>
        <C1Field label="Date"><input className="nx-input" type="date" value={form.lead_date} onChange={upd('lead_date')} /></C1Field>
        {form.source === 'referral' && <>
          <C1Field label="Reference name"><input className="nx-input" value={form.reference_name} onChange={upd('reference_name')} /></C1Field>
          <C1Field label="Reference phone"><input className="nx-input" value={form.reference_phone} onChange={upd('reference_phone')} /></C1Field>
        </>}
      </C1Section>
      <C1Section title="Interest">
        <C1Field label="Scheme interest">
          <select className="nx-input" value={form.scheme_interest} onChange={upd('scheme_interest')}>
            <option value="">— None —</option>
            {schemes.map((sc) => <option key={sc.id} value={sc.id}>{schemeLabel(sc)}</option>)}
          </select>
        </C1Field>
        <C1Field label="Amount interested (₹)"><input className="nx-input" type="number" step="0.01" value={form.amount_interested} onChange={upd('amount_interested')} /></C1Field>
        {manager && (
          <C1Field label="Assigned to">
            <select className="nx-input" value={form.assigned_to} onChange={upd('assigned_to')}>
              <option value="">— Myself —</option>
              {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </C1Field>
        )}
        <C1Field label="Remarks"><textarea className="nx-input c1-textarea" value={form.remarks} onChange={upd('remarks')} /></C1Field>
      </C1Section>
      <C1Error>{error}</C1Error>
    </C1Modal>
  );
}

function LeadDetailModal({ lead, assignees, manager, onClose, onConvert, onStatusChange, onScheduleFollowUp, onAssigneeChange, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');
  const [detail, setDetail] = useState(null);
  const [schedOpen, setSchedOpen] = useState(false);
  const [schedAt, setSchedAt] = useState(() => {
    const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
    return toDatetimeLocal(d);
  });
  const [schedRemarks, setSchedRemarks] = useState('');
  const [schedBusy, setSchedBusy] = useState(false);
  const isTerminal = TERMINAL_STATUSES.includes(lead.status);

  useEffect(() => {
    setActiveTab('detail');
    setDetail(null);
    apiFetch(CLUB1000_ENDPOINTS.lead(lead.id)).then((r) => (r.ok ? r.json() : null)).then(setDetail).catch(() => {});
  }, [lead.id]);

  async function submitSchedule() {
    if (!schedAt) return;
    setSchedBusy(true);
    try {
      await onScheduleFollowUp(lead.id, schedAt, schedRemarks);
      setSchedOpen(false);
      setSchedRemarks('');
    } finally {
      setSchedBusy(false);
    }
  }

  return (
    <C1Modal title={lead.name} sub={`${lead.phone || ''}${lead.email ? ` · ${lead.email}` : ''}`} onClose={onClose}
      footer={activeTab === 'detail' ? <>
        {manager && onDelete && (
          <button type="button" className="nx-btn nx-btn-md nx-btn-danger-soft c1-foot-left" disabled={deleting}
            onClick={async () => { setDeleting(true); await onDelete(lead); setDeleting(false); }}>
            {deleting ? <><span className="nx-spin" aria-hidden="true" /> Deleting…</> : 'Delete lead'}
          </button>
        )}
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Close</button>
        {lead.status !== 'converted' && <button type="button" className="nx-btn nx-btn-md nx-btn-success" onClick={() => onConvert(lead)}>Convert to Investor</button>}
      </> : null}>
      <div className="nx-filters c1h-tabs">
        {[['detail', 'Detail'], ['history', 'History']].map(([k, label]) => (
          <button type="button" key={k} className={`nx-btn nx-btn-md nx-toggle${activeTab === k ? ' is-on' : ''}`} onClick={() => setActiveTab(k)}>{label}</button>
        ))}
      </div>

      {activeTab === 'detail' && <>
        <C1Section title="Lead">
          <C1Field label="Source"><C1Value>{SOURCE_LABELS[lead.source] || lead.source}</C1Value></C1Field>
          <C1Field label="Date"><C1Value>{lead.lead_date ? new Date(`${lead.lead_date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</C1Value></C1Field>
          {lead.source === 'referral' && <C1Field label="Reference"><C1Value>{lead.reference_name || '—'}</C1Value></C1Field>}
          <C1Field label="Scheme interest"><C1Value>{lead.scheme_interest_name || '—'}</C1Value></C1Field>
          <C1Field label="Amount interested"><C1Value>{lead.amount_interested ? `₹${Number(lead.amount_interested).toLocaleString('en-IN')}` : '—'}</C1Value></C1Field>
          {lead.remarks && <C1Field label="Remarks"><C1Value>{lead.remarks}</C1Value></C1Field>}
        </C1Section>
        <C1Section title="Working it">
          <C1Field label="Assigned to">
            {manager ? (
              <select className="nx-input" value={lead.assigned_to || ''} onChange={(e) => onAssigneeChange(lead.id, e.target.value)}>
                {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            ) : <C1Value>{lead.assigned_to_name || '—'}</C1Value>}
          </C1Field>
          <C1Field label="Status" hint={<StatusBadge status={lead.status} />}>
            <select className="nx-input" value={lead.status} onChange={(e) => onStatusChange(lead.id, e.target.value)}>
              {STATUS_OPTIONS.map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
            </select>
          </C1Field>
          {/* Next follow-up — hidden once the lead is in a terminal status (nothing left
              to follow up on), matching the backend's auto-clear behaviour. */}
          {!isTerminal && (
            <C1Field label="Next follow-up" hint={lead.next_follow_up_date ? fmtDateTime(lead.next_follow_up_date) : 'Not scheduled'}>
              {!schedOpen ? (
                <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary c1i-loi-btn" onClick={() => setSchedOpen(true)}>
                  {lead.next_follow_up_date ? 'Reschedule' : 'Schedule'}
                </button>
              ) : <>
                <input className="nx-input" type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} />
                <input className="nx-input" value={schedRemarks} onChange={(e) => setSchedRemarks(e.target.value)} placeholder="Remarks (optional)" />
                <div className="c1-row2">
                  <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setSchedOpen(false)}>Cancel</button>
                  <button type="button" className="nx-btn nx-btn-sm nx-btn-success" onClick={submitSchedule} disabled={schedBusy}>{schedBusy ? 'Saving…' : 'Save follow-up'}</button>
                </div>
              </>}
            </C1Field>
          )}
        </C1Section>
      </>}

      {activeTab === 'history' && (
        <C1Section title="History">
          {!detail && <Loader variant="inline" size="sm" label="Loading…" />}
          {detail && detail.history?.length === 0 && <div className="ar-empty">No changes recorded yet.</div>}
          <div className="c1h-list">
            {(detail?.history || []).map((h) => {
              const tone = h.field_changed === 'created' ? 'muted' : h.field_changed === 'assigned_to' ? 'deep' : 'accent';
              const icon = h.field_changed === 'created' ? 'download' : h.field_changed === 'assigned_to' ? 'user' : 'refresh';
              const singleValue = h.field_changed === 'created' || !h.old_value;
              const byLabel = h.changed_by_name || (h.field_changed === 'created' ? 'System (auto)' : null);
              return (
                <div key={h.id} className="c1h-item">
                  <div className={`c1h-dot ${tone}`}><Icon name={icon} size={15} /></div>
                  <div className="c1h-body">
                    <b>{HISTORY_LABEL[h.field_changed] || h.field_changed}</b>
                    <p>
                      {singleValue ? <span className={`c1h-new ${tone}`}>{(h.new_value || '—').replace(/_/g, ' ')}</span> : <>
                        <span className="c1h-old">{(h.old_value || '—').replace(/_/g, ' ')}</span>{' → '}
                        <span className={`c1h-new ${tone}`}>{(h.new_value || '—').replace(/_/g, ' ')}</span>
                      </>}
                    </p>
                    {byLabel && <small>by {byLabel}</small>}
                    <small className="faint">{fmtDateTime(h.created_at)}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </C1Section>
      )}
    </C1Modal>
  );
}

export default function Club1000LeadsPage() {
  const user = useSelector((s) => s.auth.user);
  const manager = isClub1000Manager(user);
  const [leads, setLeads] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [assignees, setAssignees] = useState([]);
  // Only the values these rows hold (?facets=1) — see lib/presentOptions.
  const [facets, setFacets] = useState(null);
  useEffect(() => {
    let alive = true;
    apiFetch(`${CLUB1000_ENDPOINTS.leads}?facets=1`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setFacets(d); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const fx = (key) => facets?.[key] ?? null;

  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [convertLead, setConvertLead] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const [filters, setFilters] = useState({
    search: '', status: '', source: '', scheme_interest: '', assigned_to: '',
    date_from: '', date_to: '',
  });
  // Seed the status filter from the URL so the dashboard's Converted stat card can
  // deep-link straight into the matching filter (?status=converted). Done in an
  // effect, not a lazy initializer, since window.location isn't committed yet during
  // Next client navigation when the initializer runs (mirrors payouts/page.js).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('status');
    if (s) setFilters((f) => ({ ...f, status: s }));
    setSeeded(true);
  }, []);
  // Search box is debounced: typing updates `searchText` instantly (responsive UI)
  // but only commits to `filters.search` (which triggers the fetch) after a pause.
  const [searchText, setSearchText] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText }));
    }, 400);
    return () => clearTimeout(t);
  }, [searchText]);

  const loadMeta = useCallback(async () => {
    const [schemesRes, usersRes] = await Promise.all([
      apiFetch(CLUB1000_ENDPOINTS.schemes),
      apiFetch(CLUB1000_ENDPOINTS.users),
    ]);
    if (schemesRes.ok) setSchemes(await schemesRes.json());
    if (usersRes.ok) {
      const d = await usersRes.json();
      setAssignees(Array.isArray(d) ? d : []);
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.source) params.set('source', filters.source);
      if (filters.scheme_interest) params.set('scheme_interest', filters.scheme_interest);
      if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      const qs = params.toString() ? `?${params}` : '';
      const res = await apiFetch(`${CLUB1000_ENDPOINTS.leads}${qs}`);
      if (res.ok) setLeads(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { if (seeded) loadLeads(); }, [loadLeads, seeded]);

  async function changeStatus(id, status) {
    const res = await apiFetch(CLUB1000_ENDPOINTS.lead(id), { method: 'PATCH', body: JSON.stringify({ status }) });
    if (res.ok) {
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setSelected(updated);
    }
  }

  async function changeAssignee(id, assignedTo) {
    const res = await apiFetch(CLUB1000_ENDPOINTS.lead(id), { method: 'PATCH', body: JSON.stringify({ assigned_to: assignedTo }) });
    if (res.ok) {
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      setSelected(updated);
    }
  }

  async function scheduleFollowUp(leadId, scheduledAtLocal, remarks) {
    const scheduled_at = new Date(scheduledAtLocal).toISOString();
    const res = await apiFetch(CLUB1000_ENDPOINTS.followUps, {
      method: 'POST',
      body: JSON.stringify({ lead: leadId, scheduled_at, remarks }),
    });
    if (res.ok) {
      // The backend sets lead.next_follow_up_date = scheduled_at as a side effect —
      // mirror that locally rather than re-fetching the lead.
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, next_follow_up_date: scheduled_at } : l)));
      setSelected((prev) => (prev && prev.id === leadId ? { ...prev, next_follow_up_date: scheduled_at } : prev));
    } else {
      notify('Could not schedule the follow-up.');
    }
  }

  // One lead, from its detail — managers only (the server checks too).
  async function deleteOne(lead) {
    if (!(await confirmDialog(`Delete the lead ${lead.name}${lead.phone ? ` (${lead.phone})` : ''} permanently? Its follow-ups and history go with it.`,
      { title: 'Delete lead?', confirmText: 'Delete', tone: 'danger' }))) return;
    const r = await apiFetch(CLUB1000_ENDPOINTS.lead(lead.id), { method: 'DELETE' }).catch(() => null);
    if (!r || !(r.ok || r.status === 204)) { notify(errText(r ? await r.json().catch(() => ({})) : {}, 'Could not delete the lead.'), 'error'); return; }
    notify('Lead deleted', 'success');
    setSelected(null); loadLeads();
  }

  async function bulkDelete() {
    if (!selectedIds.size) return;
    if (!(await confirmDialog(`Delete ${selectedIds.size} lead${selectedIds.size > 1 ? 's' : ''} permanently?`))) return;
    setDeleting(true);
    try {
      // No dedicated bulk-delete endpoint on Club 1000 — loop the single-lead delete.
      await Promise.all(Array.from(selectedIds).map((id) => apiFetch(CLUB1000_ENDPOINTS.lead(id), { method: 'DELETE' })));
      setSelectedIds(new Set());
      loadLeads();
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelectedIds(selectedIds.size === leads.length ? new Set() : new Set(leads.map((l) => l.id)));
  }

  function sf(k, v) { setFilters((f) => ({ ...f, [k]: v })); }
  const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = localDate(new Date());
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
  const anyFilter = filters.search || filters.status || filters.source || filters.scheme_interest ||
    filters.assigned_to || filters.date_from || filters.date_to;
  const clearAll = () => { setSearchText(''); setFilters({ search: '', status: '', source: '', scheme_interest: '', assigned_to: '', date_from: '', date_to: '' }); };


  return (
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Leads</h1>
          <p className="nx-page-sub">
            {leads.length.toLocaleString()} {manager ? 'leads' : 'leads assigned to you and your team'}
            {selectedIds.size > 0 && <span className="c1-sel"> · {selectedIds.size} selected</span>}
          </p>
        </div>
        <div className="ard-filters">
          {manager && selectedIds.size > 0 && (
            <button type="button" className="nx-btn nx-btn-md nx-btn-danger" onClick={bulkDelete} disabled={deleting}>{deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}</button>
          )}
          <button type="button" className="nx-btn nx-btn-md nx-btn-success" onClick={() => setShowAdd(true)}>+ Add Lead</button>
        </div>
      </div>

      <div className="nx-card c1-filtercard">
        <div className="nx-search-wrap">
          <span className="nx-search-icon"><Icon name="search" /></span>
          <input className="nx-input nx-search-input" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search name, phone, email…" />
        </div>
        <div className="c1-filterrow">
          <span className="c1-filterlabel">Date</span>
          <input className="nx-input nx-input-sm c1-date" type="date" value={filters.date_from} onChange={(e) => sf('date_from', e.target.value)} />
          <span className="c1-arrow">→</span>
          <input className="nx-input nx-input-sm c1-date" type="date" value={filters.date_to} onChange={(e) => sf('date_to', e.target.value)} />
          <select className="nx-input nx-input-sm nx-filter-sel"
            value={(filters.date_from === today && filters.date_to === today) ? 'today'
                 : (filters.date_from === daysAgo(6) && filters.date_to === today) ? 'week'
                 : (filters.date_from === daysAgo(29) && filters.date_to === today) ? 'month' : ''}
            onChange={(e) => {
              const k = e.target.value;
              sf('date_from', k === 'today' ? today : k === 'week' ? daysAgo(6) : k === 'month' ? daysAgo(29) : '');
              sf('date_to', k ? today : '');
            }}>
            <option value="">Any date</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
          {anyFilter && <button type="button" className="nx-btn nx-btn-sm nx-btn-danger-soft c1-clear" onClick={clearAll}><Icon name="x" /> Clear all</button>}
        </div>
        <div className="c1-filterrow">
          <select className={`nx-input nx-input-sm nx-filter-sel${filters.status ? ' is-on' : ''}`} value={filters.status} onChange={(e) => sf('status', e.target.value)}>
            <option value="">All Statuses</option>
            {onlyPresent(STATUS_OPTIONS, fx('statuses'), filters.status).map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
          </select>
          <select className={`nx-input nx-input-sm nx-filter-sel${filters.source ? ' is-on' : ''}`} value={filters.source} onChange={(e) => sf('source', e.target.value)}>
            <option value="">All Sources</option>
            {onlyPresent(Object.keys(SOURCE_LABELS), fx('sources'), filters.source).map((v) => <option key={v} value={v}>{SOURCE_LABELS[v]}</option>)}
          </select>
          <select className={`nx-input nx-input-sm nx-filter-sel${filters.scheme_interest ? ' is-on' : ''}`} value={filters.scheme_interest} onChange={(e) => sf('scheme_interest', e.target.value)}>
            <option value="">All Schemes</option>
            {onlyPresent(schemes.map((sc) => ({ value: String(sc.id), label: sc.name })), fx('scheme_ids'), filters.scheme_interest).map((sc) => <option key={sc.value} value={sc.value}>{sc.label}</option>)}
          </select>
          {manager && (
            <select className={`nx-input nx-input-sm nx-filter-sel${filters.assigned_to ? ' is-on' : ''}`} value={filters.assigned_to} onChange={(e) => sf('assigned_to', e.target.value)}>
              <option value="">All Assignees</option>
              {onlyPresent(assignees.map((u) => ({ value: String(u.id), label: u.name })), fx('assignee_ids'), filters.assigned_to).map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="nx-card c1-tablecard">
        <table className="nx-table c1-table">
          <thead>
            <tr>
              {manager && <th className="c1-check"><input type="checkbox" checked={selectedIds.size === leads.length && leads.length > 0} onChange={toggleAll} /></th>}
              <th>Name</th><th>Scheme interest</th><th>Source</th><th>Assigned to</th><th>Status</th><th>Next follow-up</th><th>Received</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={manager ? 8 : 7} className="club-empty-cell"><Loader size="sm" /></td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={manager ? 8 : 7} className="club-empty-cell">No leads found.</td></tr>
            ) : leads.map((l) => {
              const overdue = l.next_follow_up_date && new Date(l.next_follow_up_date) < new Date();
              return (
                <tr key={l.id} className="c1-row-link" onClick={() => setSelected(l)}>
                  {manager && (
                    <td className="c1-check" onClick={(e) => { e.stopPropagation(); toggleSelect(l.id); }}>
                      <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} />
                    </td>
                  )}
                  <td className="c1-strong">{l.name}</td>
                  <td>{l.scheme_interest_name || '—'}</td>
                  <td className="c1-cap">{SOURCE_LABELS[l.source] || l.source}</td>
                  <td>{l.assigned_to_name || '—'}</td>
                  <td><StatusBadge status={l.status} /></td>
                  <td className={overdue ? 'c1-late' : ''}>{l.next_follow_up_date ? fmtDateTime(l.next_follow_up_date) : '—'}</td>
                  <td>{new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddLeadModal schemes={schemes} assignees={assignees} manager={manager} onClose={() => setShowAdd(false)} onCreated={() => loadLeads()} />
      )}
      {selected && (
        <LeadDetailModal
          lead={selected}
          assignees={assignees}
          manager={manager}
          onClose={() => setSelected(null)}
          onStatusChange={changeStatus}
          onScheduleFollowUp={scheduleFollowUp}
          onAssigneeChange={changeAssignee}
          onConvert={(lead) => { setConvertLead(lead); setSelected(null); }}
          onDelete={deleteOne}
        />
      )}
      {convertLead && (
        <AddInvestorModal
          schemes={schemes}
          prefillLead={convertLead}
          onClose={() => setConvertLead(null)}
          onCreated={() => { setConvertLead(null); loadLeads(); }}
        />
      )}
    </div>
  );
}
