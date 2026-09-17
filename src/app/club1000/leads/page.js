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
const TEAL = 'var(--success)';
const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid var(--surface-2)', color: 'var(--text)' };
const inp = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--border-strong)', fontSize: 13, boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };

const STATUS_COLORS = {
  new: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  contacted: { bg: 'var(--warning-soft)', fg: 'var(--warning-2)' },
  interested: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  not_interested: { bg: 'var(--surface-2)', fg: 'var(--text-3)' },
  converted: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  lost: { bg: 'var(--danger-soft)', fg: 'var(--danger)' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: c.bg, color: c.fg, textTransform: 'capitalize' }}>{(status || '').replace(/_/g, ' ')}</span>;
}

const HISTORY_LABEL = { created: 'Lead Created', status: 'Status', assigned_to: 'Assigned To' };
const HISTORY_COLOR = { created: 'var(--text-3)', status: 'var(--accent)', assigned_to: 'var(--accent-deep)' };

const SOURCE_LABELS = { referral: 'Referral', walk_in: 'Walk-in', website: 'Website', other: 'Other' };
const STATUS_OPTIONS = ['new', 'contacted', 'interested', 'not_interested', 'converted', 'lost'];
// A lead in one of these has nothing left to follow up on — matches the backend's
// terminal-status handling in LeadDetailView.patch (clears next_follow_up_date).
const TERMINAL_STATUSES = ['not_interested', 'lost', 'converted'];

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
      if (!res.ok) { setError(data?.detail || 'Could not add lead.'); return; }
      onCreated(data);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nx-modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(var(--ink-rgb),0.38)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <form className="nx-modal" onSubmit={submit} style={{ background: 'var(--surface)', borderRadius: 20, width: '90%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>Add Lead</h2>
        {error && <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Name *</label>
          <input className="nx-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inp} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div><label style={lbl}>Phone</label><input className="nx-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>Alt Phone</label><input className="nx-input" value={form.alt_phone} onChange={(e) => setForm((f) => ({ ...f, alt_phone: e.target.value }))} style={inp} /></div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Email</label>
          <input className="nx-input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inp} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Source</label>
            <select className="nx-input" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} style={inp}>
              {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Date</label>
            <input className="nx-input" type="date" value={form.lead_date} onChange={(e) => setForm((f) => ({ ...f, lead_date: e.target.value }))} style={inp} />
          </div>
        </div>
        {form.source === 'referral' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div><label style={lbl}>Reference Name</label><input className="nx-input" value={form.reference_name} onChange={(e) => setForm((f) => ({ ...f, reference_name: e.target.value }))} style={inp} /></div>
            <div><label style={lbl}>Reference Phone</label><input className="nx-input" value={form.reference_phone} onChange={(e) => setForm((f) => ({ ...f, reference_phone: e.target.value }))} style={inp} /></div>
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Scheme Interest</label>
          <select className="nx-input" value={form.scheme_interest} onChange={(e) => setForm((f) => ({ ...f, scheme_interest: e.target.value }))} style={inp}>
            <option value="">— None —</option>
            {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Amount Interested (₹)</label>
          <input className="nx-input" type="number" value={form.amount_interested} onChange={(e) => setForm((f) => ({ ...f, amount_interested: e.target.value }))} style={inp} />
        </div>
        {manager && (
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Assigned To</label>
            <select className="nx-input" value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))} style={inp}>
              <option value="">— Myself —</option>
              {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ marginBottom: 18 }}>
          <label style={lbl}>Remarks</label>
          <textarea className="nx-input" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} style={{ ...inp, height: 70, padding: 10 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="nx-btn nx-btn-md nx-btn-secondary" type="button" onClick={onClose} style={{ padding: '9px 16px', background: 'var(--surface-2)', color: 'var(--muted)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button className="nx-btn nx-btn-md nx-btn-success" type="submit" disabled={busy} style={{ padding: '9px 20px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Add Lead'}</button>
        </div>
      </form>
    </div>
  );
}

function LeadDetailModal({ lead, assignees, manager, onClose, onConvert, onStatusChange, onScheduleFollowUp, onAssigneeChange }) {
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

  const tabStyle = (key) => ({
    padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
    background: 'none', borderBottom: activeTab === key ? `2px solid ${TEAL}` : '2px solid transparent',
    color: activeTab === key ? TEAL : 'var(--muted)',
  });

  return (
    <div className="nx-modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(var(--ink-rgb),0.38)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="nx-modal" style={{ background: 'var(--surface)', borderRadius: 20, width: '90%', maxWidth: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{lead.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</div>
          </div>
          <button className="nx-btn nx-btn-lg nx-icon-btn nx-btn-ghost" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--muted)', cursor: 'pointer' }}><Icon name="x" /></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--surface-2)', marginTop: 14, flexShrink: 0 }}>
          {[['detail', 'Detail'], ['history', 'History']].map(([k, label]) => (
            <button key={k} onClick={() => setActiveTab(k)} style={tabStyle(k)}>{label}</button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
          {activeTab === 'detail' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, marginBottom: 16 }}>
                <div><div style={lbl}>Source</div><div>{SOURCE_LABELS[lead.source] || lead.source}</div></div>
                <div><div style={lbl}>Date</div><div>{lead.lead_date ? new Date(`${lead.lead_date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div></div>
                <div><div style={lbl}>Scheme Interest</div><div>{lead.scheme_interest_name || '—'}</div></div>
                <div><div style={lbl}>Amount Interested</div><div>{lead.amount_interested ? `₹${Number(lead.amount_interested).toLocaleString('en-IN')}` : '—'}</div></div>
                <div>
                  <div style={lbl}>Assigned To</div>
                  {manager ? (
                    <select className="nx-input" value={lead.assigned_to || ''} onChange={(e) => onAssigneeChange(lead.id, e.target.value)} style={{ ...inp, height: 32 }}>
                      {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  ) : (
                    <div>{lead.assigned_to_name || '—'}</div>
                  )}
                </div>
                {lead.source === 'referral' && <div><div style={lbl}>Reference</div><div>{lead.reference_name || '—'}</div></div>}
                <div><div style={lbl}>Status</div><StatusBadge status={lead.status} /></div>
              </div>
              {lead.remarks && <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text)' }}><div style={lbl}>Remarks</div>{lead.remarks}</div>}

              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Change Status</label>
                <select className="nx-input" value={lead.status} onChange={(e) => onStatusChange(lead.id, e.target.value)} style={inp}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              {/* Next follow-up — hidden once the lead is in a terminal status (nothing
                  left to follow up on), matching the backend's auto-clear behaviour. */}
              {!isTerminal && (
                <div style={{ marginBottom: 16, background: 'var(--surface-2)', border: '1px solid var(--surface-3)', borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={lbl}>Next Follow-up</div>
                      <div style={{ fontSize: 13, color: lead.next_follow_up_date ? 'var(--text)' : 'var(--muted)', fontWeight: lead.next_follow_up_date ? 700 : 400 }}>
                        {lead.next_follow_up_date ? fmtDateTime(lead.next_follow_up_date) : 'Not scheduled'}
                      </div>
                    </div>
                    <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setSchedOpen((v) => !v)} style={{ padding: '6px 12px', background: 'var(--surface)', color: TEAL, border: `1.5px solid ${TEAL}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {lead.next_follow_up_date ? 'Reschedule' : 'Schedule'}
                    </button>
                  </div>
                  {schedOpen && (
                    <div style={{ marginTop: 12 }}>
                      <label style={lbl}>Date &amp; Time</label>
                      <input className="nx-input" type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} style={{ ...inp, marginBottom: 10 }} />
                      <label style={lbl}>Remarks</label>
                      <input className="nx-input" value={schedRemarks} onChange={(e) => setSchedRemarks(e.target.value)} style={{ ...inp, marginBottom: 10 }} placeholder="Optional" />
                      <button className="nx-btn nx-btn-md nx-btn-success" onClick={submitSchedule} disabled={schedBusy} style={{ width: '100%', padding: '9px 0', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: schedBusy ? 0.7 : 1 }}>
                        {schedBusy ? 'Saving…' : 'Save Follow-up'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} style={{ padding: '9px 16px', background: 'var(--surface-2)', color: 'var(--muted)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
                {lead.status !== 'converted' && (
                  <button className="nx-btn nx-btn-md nx-btn-success" onClick={() => onConvert(lead)} style={{ padding: '9px 20px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Convert to Investor</button>
                )}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div>
              {!detail && <Loader variant="inline" size="sm" label="Loading…" />}
              {detail && detail.history?.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--faint)', textAlign: 'center', marginTop: 24 }}>No changes recorded yet.</p>
              )}
              {(detail?.history || []).map((h, idx, arr) => {
                const isLast = idx === arr.length - 1;
                const color = HISTORY_COLOR[h.field_changed] || 'var(--muted)';
                const icon = h.field_changed === 'created' ? 'download' : h.field_changed === 'assigned_to' ? 'user' : 'refresh';
                const singleValue = h.field_changed === 'created' || !h.old_value;
                const byLabel = h.changed_by_name || (h.field_changed === 'created' ? 'System (auto)' : null);
                return (
                  <div key={h.id} style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 18 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color }}><Icon name={icon} size={15} /></div>
                      {!isLast && <div style={{ width: 2, flex: 1, backgroundColor: 'var(--surface-2)', marginTop: 4 }} />}
                    </div>
                    <div style={{ paddingBottom: isLast ? 0 : 18, flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{HISTORY_LABEL[h.field_changed] || h.field_changed}</p>
                      <p style={{ fontSize: 12, color: 'var(--text)', margin: '3px 0 0' }}>
                        {singleValue ? (
                          <span style={{ color, fontWeight: 600, textTransform: 'capitalize' }}>{(h.new_value || '—').replace(/_/g, ' ')}</span>
                        ) : (
                          <>
                            <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{(h.old_value || '—').replace(/_/g, ' ')}</span>
                            {' → '}
                            <span style={{ color, fontWeight: 600, textTransform: 'capitalize' }}>{(h.new_value || '—').replace(/_/g, ' ')}</span>
                          </>
                        )}
                      </p>
                      {byLabel && <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>by {byLabel}</p>}
                      <p style={{ fontSize: 11, color: 'var(--faint)', margin: '2px 0 0' }}>{fmtDateTime(h.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Club1000LeadsPage() {
  const user = useSelector((s) => s.auth.user);
  const manager = isClub1000Manager(user);
  const [leads, setLeads] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [assignees, setAssignees] = useState([]);
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

  const fSel = {
    height: 36, padding: '0 10px', borderRadius: 8,
    border: '1.5px solid var(--surface-3)', fontSize: 12, background: 'var(--surface-2)',
    cursor: 'pointer', outline: 'none', color: 'var(--text)', fontWeight: 500,
  };
  const activeSelStyle = (val) => val ? { ...fSel, borderColor: TEAL, background: 'var(--success-soft)', color: TEAL, fontWeight: 600 } : fSel;
  const qBtn = (active) => ({
    height: 36, padding: '0 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', border: 'none',
    background: active ? 'var(--strong)' : 'var(--surface-2)',
    color: active ? '#fff' : 'var(--muted)',
    transition: 'all 0.15s',
  });
  const divider = { width: 1, height: 24, background: 'var(--surface-3)', flexShrink: 0 };

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Leads</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {leads.length.toLocaleString()} {manager ? 'total leads' : 'leads assigned to you and your team'}
            {selectedIds.size > 0 && <span style={{ marginLeft: 8, color: TEAL, fontWeight: 600 }}>· {selectedIds.size} selected</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {manager && selectedIds.size > 0 && (
            <button className="nx-btn nx-btn-md nx-btn-danger" onClick={bulkDelete} disabled={deleting} style={{ padding: '10px 18px', background: 'var(--danger-solid)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>
              {deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
            </button>
          )}
          <button className="nx-btn nx-btn-md nx-btn-success" onClick={() => setShowAdd(true)} style={{ padding: '10px 18px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add Lead</button>
        </div>
      </div>

      {/* Filters */}
      <div className="nx-card" style={{ backgroundColor: 'var(--surface)', borderRadius: 18, border: '1.5px solid var(--surface-3)', marginBottom: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

        {/* Search bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-2)' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#A2D2FF' }}><Icon name="search" /></span>
            <input className="nx-input" value={searchText} onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search name, phone, email…"
              style={{ width: '100%', height: 40, padding: '0 16px 0 38px', borderRadius: 14, border: '1.5px solid var(--surface-3)', fontSize: 13, background: 'var(--surface-2)', outline: 'none', boxSizing: 'border-box', color: 'var(--text)' }} />
          </div>
        </div>

        {/* Row 1: Date range + quick buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--surface-2)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#A2D2FF', letterSpacing: 0.5, textTransform: 'uppercase', marginRight: 2 }}>Date</span>
          <input className="nx-input" type="date" value={filters.date_from} onChange={(e) => sf('date_from', e.target.value)} style={{ ...fSel, width: 136 }} />
          <span style={{ fontSize: 12, color: 'var(--border-strong)' }}>→</span>
          <input className="nx-input" type="date" value={filters.date_to} onChange={(e) => sf('date_to', e.target.value)} style={{ ...fSel, width: 136 }} />
          <div style={divider} />
          <button className={`nx-btn nx-btn-sm nx-toggle${(filters.date_from === today && filters.date_to === today) ? ' is-on' : ''}`} onClick={() => { sf('date_from', today); sf('date_to', today); }} style={qBtn(filters.date_from === today && filters.date_to === today)}>Today</button>
          <button className={`nx-btn nx-btn-sm nx-toggle${(filters.date_from === daysAgo(6) && filters.date_to === today) ? ' is-on' : ''}`} onClick={() => { sf('date_from', daysAgo(6)); sf('date_to', today); }} style={qBtn(filters.date_from === daysAgo(6) && filters.date_to === today)}>Week</button>
          <button className={`nx-btn nx-btn-sm nx-toggle${(filters.date_from === daysAgo(29) && filters.date_to === today) ? ' is-on' : ''}`} onClick={() => { sf('date_from', daysAgo(29)); sf('date_to', today); }} style={qBtn(filters.date_from === daysAgo(29) && filters.date_to === today)}>Month</button>
          {anyFilter && (
            <button className="nx-btn nx-btn-sm nx-btn-danger-soft" onClick={clearAll} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--danger-3)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>
              <Icon name="x" /> Clear all
            </button>
          )}
        </div>

        {/* Row 2: Status + Source + Scheme + Assigned To */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 16px' }}>
          <select value={filters.status} onChange={(e) => sf('status', e.target.value)} style={activeSelStyle(filters.status)}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={filters.source} onChange={(e) => sf('source', e.target.value)} style={activeSelStyle(filters.source)}>
            <option value="">All Sources</option>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filters.scheme_interest} onChange={(e) => sf('scheme_interest', e.target.value)} style={activeSelStyle(filters.scheme_interest)}>
            <option value="">All Schemes</option>
            {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {manager && (
            <select value={filters.assigned_to} onChange={(e) => sf('assigned_to', e.target.value)} style={activeSelStyle(filters.assigned_to)}>
              <option value="">All Assignees</option>
              {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="nx-card" style={{ backgroundColor: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface-3)', overflow: 'hidden', overflowX: 'auto' }}>
        <table className="nx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              {manager && (
                <th style={th}>
                  <input type="checkbox" checked={selectedIds.size === leads.length && leads.length > 0} onChange={toggleAll} />
                </th>
              )}
              <th style={th}>Name</th>
              <th style={th}>Scheme Interest</th>
              <th style={th}>Source</th>
              <th style={th}>Assigned To</th>
              <th style={th}>Status</th>
              <th style={th}>Next Follow-up</th>
              <th style={th}>Received</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={manager ? 8 : 7} style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}><Loader size="sm" /></td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={manager ? 8 : 7} style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}>No leads found.</td></tr>
            ) : leads.map((l) => {
              const overdue = l.next_follow_up_date && new Date(l.next_follow_up_date) < new Date();
              return (
              <tr key={l.id} onClick={() => setSelected(l)} style={{ cursor: 'pointer' }}>
                {manager && (
                  <td style={td} onClick={(e) => { e.stopPropagation(); toggleSelect(l.id); }}>
                    <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} />
                  </td>
                )}
                <td style={{ ...td, fontWeight: 600 }}>{l.name}</td>
                <td style={td}>{l.scheme_interest_name || '—'}</td>
                <td style={{ ...td, textTransform: 'capitalize' }}>{SOURCE_LABELS[l.source] || l.source}</td>
                <td style={td}>{l.assigned_to_name || '—'}</td>
                <td style={td}><StatusBadge status={l.status} /></td>
                <td style={{ ...td, color: overdue ? 'var(--danger)' : 'var(--text)', fontWeight: overdue ? 700 : 400 }}>
                  {l.next_follow_up_date ? fmtDateTime(l.next_follow_up_date) : '—'}
                </td>
                <td style={td}>{new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
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
