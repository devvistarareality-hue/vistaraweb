'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS } from '../../../constants/api';
import { getCache, setCache, bustCache } from '../../sales/_cache';

function bustLeadsCache() {
  // Remove all leads_* keys from sessionStorage
  if (typeof window === 'undefined') return;
  Object.keys(sessionStorage).filter((k) => k.startsWith('sc_leads_')).forEach((k) => sessionStorage.removeItem(k));
}

const PAGE_SIZE = 25;

const STATUS_COLOR = {
  new:              '#3D5AFE',
  assigned:         '#7B1FA2',
  contacted:        '#0097A7',
  not_reachable:    '#9E9E9E',
  warm_transferred: '#FF6B2B',
  sv_scheduled:     '#F9A825',
  sv_done:          '#2E7D32',
  closed:           '#1B5E20',
  lost:             '#B71C1C',
};

const ALL_STATUSES = ['new','assigned','contacted','not_reachable','warm_transferred','sv_scheduled','sv_done','closed','lost'];

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || '#9E9E9E';
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: color + '18', color }}>
      {status?.replace(/_/g, ' ').toUpperCase()}
    </span>
  );
}

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// ── Add Lead Modal ──────────────────────────────────────────────────────────
function AddLeadModal({ projects, sources, onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', phone: '', alt_phone: '', email: '', project: '', source: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.phone) { setErr('Name and phone are required.'); return; }
    setSaving(true);
    const body = { name: form.name, phone: form.phone };
    if (form.alt_phone) body.alt_phone = form.alt_phone;
    if (form.email)     body.email     = form.email;
    if (form.project)   body.project   = form.project;
    if (form.source)    body.source    = form.source;

    const res = await fetch(SALES_ENDPOINTS.leads, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(data.detail || JSON.stringify(data)); return; }
    onAdded(data);
    onClose();
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Add Manual Lead</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', marginBottom: 14 }}>
            {[
              { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Client name' },
              { label: 'Phone *',     key: 'phone', type: 'text', placeholder: '+91 99999 99999' },
              { label: 'Alt. Phone',  key: 'alt_phone', type: 'text', placeholder: '' },
              { label: 'Email',       key: 'email', type: 'email', placeholder: '' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label style={lbl}>{label}</label>
                <input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder} style={inp} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Project</label>
            <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={inp}>
              <option value="">— Select project —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>Source</label>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} style={inp}>
              <option value="">— Select source —</option>
              {sources.map((s) => <option key={s.id} value={s.id} style={{ textTransform: 'capitalize' }}>{s.name}</option>)}
            </select>
          </div>
          {err && <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 12 }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...saveBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Adding…' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Lead Detail Modal ───────────────────────────────────────────────────────
function LeadDetailModal({ lead, projects, sources, telecallers, onClose, onUpdated }) {
  const [form, setForm]   = useState({
    status: lead.status, telecaller: lead.telecaller || '', telecaller_status: lead.telecaller_status || '',
    telecaller_remarks: lead.telecaller_remarks || '',
    stm: lead.stm || '', stm_status: lead.stm_status || '', stm_remarks: lead.stm_remarks || '',
    project: lead.project || '', source: lead.source || '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const body = { status: form.status, telecaller_remarks: form.telecaller_remarks, stm_remarks: form.stm_remarks };
    if (form.telecaller) body.telecaller = form.telecaller;
    if (form.telecaller_status) body.telecaller_status = form.telecaller_status;
    if (form.stm) body.stm = form.stm;
    if (form.stm_status) body.stm_status = form.stm_status;
    if (form.project) body.project = form.project;
    if (form.source)  body.source  = form.source;

    const res = await fetch(SALES_ENDPOINTS.lead(lead.id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) { onUpdated(); onClose(); }
  }

  const TC_STATUSES  = ['hot','warm','cold','not_interested','not_reachable','callback'];
  const STM_STATUSES = ['hot','warm','cold','not_interested','sv_scheduled','sv_done','closed'];

  return (
    <div style={overlay}>
      <div style={{ ...modal, maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={modalHeader}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{lead.name}</h2>
            <p style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Overall status + project + source */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <div>
              <label style={lbl}>Overall Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inp}>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Project</label>
              <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={inp}>
                <option value="">—</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #F0F3FA' }} />

          {/* Telecaller section */}
          <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.8 }}>Telecaller (Pre-Sales)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <div>
              <label style={lbl}>Assign Telecaller</label>
              <select value={form.telecaller} onChange={(e) => setForm({ ...form, telecaller: e.target.value })} style={inp}>
                <option value="">— None —</option>
                {telecallers.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.user_code}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>TC Status</label>
              <select value={form.telecaller_status} onChange={(e) => setForm({ ...form, telecaller_status: e.target.value })} style={inp}>
                <option value="">— None —</option>
                {TC_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>TC Remarks</label>
            <textarea value={form.telecaller_remarks} onChange={(e) => setForm({ ...form, telecaller_remarks: e.target.value })}
              rows={2} style={{ ...inp, height: 'auto', padding: '8px 12px', resize: 'vertical' }} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #F0F3FA' }} />

          {/* STM section */}
          <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.8 }}>STM (Sales)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <div>
              <label style={lbl}>Assign STM</label>
              <select value={form.stm} onChange={(e) => setForm({ ...form, stm: e.target.value })} style={inp}>
                <option value="">— None —</option>
                {telecallers.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.user_code}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>STM Status</label>
              <select value={form.stm_status} onChange={(e) => setForm({ ...form, stm_status: e.target.value })} style={inp}>
                <option value="">— None —</option>
                {STM_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>STM Remarks</label>
            <textarea value={form.stm_remarks} onChange={(e) => setForm({ ...form, stm_remarks: e.target.value })}
              rows={2} style={{ ...inp, height: 'auto', padding: '8px 12px', resize: 'vertical' }} />
          </div>

          {/* Meta Ads Info */}
          {(lead.meta_campaign_name || lead.meta_adset_name || lead.meta_ad_name) && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #F0F3FA' }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.8 }}>Meta Ads Info</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lead.meta_campaign_name && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#B0BAC9', letterSpacing: 0.8, minWidth: 72, paddingTop: 2 }}>CAMPAIGN</span>
                    <span style={{ fontSize: 12, color: '#3A3A5C', fontWeight: 600 }}>{lead.meta_campaign_name}</span>
                  </div>
                )}
                {lead.meta_adset_name && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#B0BAC9', letterSpacing: 0.8, minWidth: 72, paddingTop: 2 }}>AD SET</span>
                    <span style={{ fontSize: 12, color: '#3A3A5C', fontWeight: 600 }}>{lead.meta_adset_name}</span>
                  </div>
                )}
                {lead.meta_ad_name && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#B0BAC9', letterSpacing: 0.8, minWidth: 72, paddingTop: 2 }}>AD NAME</span>
                    <span style={{ fontSize: 12, color: '#3A3A5C', fontWeight: 600 }}>{lead.meta_ad_name}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* History */}
          {lead.history?.length > 0 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #F0F3FA' }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.8 }}>Status History</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {lead.history.map((h) => (
                  <div key={h.id} style={{ fontSize: 12, color: '#8492A6', display: 'flex', gap: 8 }}>
                    <span style={{ color: '#1A1A2E', fontWeight: 600 }}>{h.field_changed}:</span>
                    <span>{h.old_value || '—'} → {h.new_value}</span>
                    <span style={{ marginLeft: 'auto' }}>{new Date(h.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button onClick={onClose} style={cancelBtn}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ ...saveBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Leads Page ─────────────────────────────────────────────────────────
export default function SalesLeadsPage() {
  const user = useSelector((s) => s.auth.user);
  const [leads,       setLeads]       = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [projects,    setProjects]    = useState([]);
  const [sources,     setSources]     = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [filters,     setFilters]     = useState({ search: '', status: '', project_id: '', source_id: '' });
  const [addModal,    setAddModal]    = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting,    setDeleting]    = useState(false);

  const loadMeta = useCallback(async () => {
    // Serve from cache instantly, fetch in background to keep fresh
    const cachedP = getCache('projects');
    const cachedS = getCache('sources');
    if (cachedP) setProjects(cachedP);
    if (cachedS) setSources(cachedS);
    if (cachedP && cachedS) return; // both cached — skip fetch
    const [pRes, sRes, tRes] = await Promise.all([
      fetch(SALES_ENDPOINTS.projects + '?active_only=true', { headers: authHeaders() }).then((r) => r.json()),
      fetch(SALES_ENDPOINTS.sources,     { headers: authHeaders() }).then((r) => r.json()),
      fetch(SALES_ENDPOINTS.telecallers, { headers: authHeaders() }).then((r) => r.json()),
    ]);
    const projects = Array.isArray(pRes) ? pRes : [];
    const sources  = Array.isArray(sRes) ? sRes : [];
    setCache('projects', projects);
    setCache('sources',  sources);
    setProjects(projects);
    setSources(sources);
    setTelecallers(Array.isArray(tRes) ? tRes : []);
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page });
    if (filters.search)     params.set('search',     filters.search);
    if (filters.status)     params.set('status',     filters.status);
    if (filters.project_id) params.set('project_id', filters.project_id);
    if (filters.source_id)  params.set('source_id',  filters.source_id);
    const cacheKey = `leads_${params.toString()}`;
    const cached = getCache(cacheKey);
    if (cached) { setLeads(cached.results); setTotal(cached.count); setLoading(false); return; }

    const res  = await fetch(`${SALES_ENDPOINTS.leads}?${params}`, { headers: authHeaders() });
    const data = await res.json();
    setCache(cacheKey, { results: data.results ?? [], count: data.count ?? 0 });
    setLeads(data.results ?? []);
    setTotal(data.count ?? 0);
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { setPage(1); }, [filters]);

  // Auto-refresh every 30 seconds to pick up new incoming leads
  useEffect(() => {
    const id = setInterval(() => {
      bustLeadsCache();
      loadLeads();
    }, 30000);
    return () => clearInterval(id);
  }, [loadLeads]);

  async function loadDetail(lead) {
    const res  = await fetch(SALES_ENDPOINTS.lead(lead.id), { headers: authHeaders() });
    const data = await res.json();
    setSelected(data);
  }

  async function deleteLead(id) {
    if (!window.confirm('Delete this lead permanently?')) return;
    await fetch(SALES_ENDPOINTS.lead(id), { method: 'DELETE', headers: authHeaders() });
    bustLeadsCache();
    loadLeads();
  }

  async function bulkDelete() {
    if (!selectedIds.size) return;
    if (!window.confirm(`Delete ${selectedIds.size} leads permanently?`)) return;
    setDeleting(true);
    await fetch(SALES_ENDPOINTS.bulkDelete, {
      method: 'DELETE', headers: authHeaders(),
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    setSelectedIds(new Set());
    setDeleting(false);
    bustLeadsCache();
    loadLeads();
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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>All Leads</h1>
          <p style={{ fontSize: 13, color: '#8492A6' }}>
            {total.toLocaleString()} total leads
            {selectedIds.size > 0 && <span style={{ marginLeft: 8, color: '#3D5AFE', fontWeight: 600 }}>· {selectedIds.size} selected</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {selectedIds.size > 0 && (
            <button onClick={bulkDelete} disabled={deleting} style={{ ...saveBtn, backgroundColor: '#EF4444' }}>
              {deleting ? 'Deleting…' : `Delete ${selectedIds.size}`}
            </button>
          )}
          <button onClick={() => setAddModal(true)} style={saveBtn}>+ Add Lead</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <input
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Search name, phone, email…"
          style={{ ...inp, width: 220 }}
        />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={{ ...inp, width: 160 }}>
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.project_id} onChange={(e) => setFilters({ ...filters, project_id: e.target.value })} style={{ ...inp, width: 180 }}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.source_id} onChange={(e) => setFilters({ ...filters, source_id: e.target.value })} style={{ ...inp, width: 160 }}>
          <option value="">All sources</option>
          {sources.map((s) => <option key={s.id} value={s.id} style={{ textTransform: 'capitalize' }}>{s.name}</option>)}
        </select>
        {(filters.search || filters.status || filters.project_id || filters.source_id) && (
          <button onClick={() => setFilters({ search: '', status: '', project_id: '', source_id: '' })} style={cancelBtn}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(184,196,214,0.18)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead style={{ backgroundColor: '#F8FAFD' }}>
              <tr>
                <th style={th}>
                  <input type="checkbox" checked={selectedIds.size === leads.length && leads.length > 0} onChange={toggleAll} />
                </th>
                {['Name', 'Phone', 'Project', 'Source', 'TC Status', 'Status', 'Received', ''].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((__, j) => (
                      <td key={j} style={{ padding: '12px 14px' }}>
                        <div className="s-skel" style={{ height: 14, width: j === 0 ? 16 : j === 1 ? 120 : j === 7 ? 60 : 80, borderRadius: 6 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '60px 0', color: '#8492A6' }}>No leads found</td></tr>
              ) : leads.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #F0F3FA', cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAFBFE'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>
                  <td style={td} onClick={(e) => { e.stopPropagation(); toggleSelect(l.id); }}>
                    <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} />
                  </td>
                  <td style={td} onClick={() => loadDetail(l)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{l.name}</span>
                      {l.is_duplicate && <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 700 }}>DUP</span>}
                    </div>
                    {(l.meta_campaign_name || l.meta_adset_name || l.meta_ad_name) && (
                      <div style={{ fontSize: 10, color: '#8492A6', marginTop: 2, lineHeight: 1.4 }}>
                        {[l.meta_campaign_name, l.meta_adset_name, l.meta_ad_name].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, fontFamily: 'monospace', color: '#8492A6' }} onClick={() => loadDetail(l)}>{l.phone}</td>
                  <td style={{ ...td, color: '#8492A6' }} onClick={() => loadDetail(l)}>{l.project_name || '—'}</td>
                  <td style={{ ...td, color: '#8492A6', textTransform: 'capitalize' }} onClick={() => loadDetail(l)}>{l.source_name || '—'}</td>
                  <td style={td} onClick={() => loadDetail(l)}>
                    {l.telecaller_status ? <StatusBadge status={l.telecaller_status} /> : <span style={{ color: '#D1D5DB' }}>—</span>}
                  </td>
                  <td style={td} onClick={() => loadDetail(l)}><StatusBadge status={l.status} /></td>
                  <td style={{ ...td, color: '#8492A6', fontSize: 12 }} onClick={() => loadDetail(l)}>
                    <div>{new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                    <div style={{ fontSize: 11, color: '#B0BAC9' }}>{new Date(l.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                  </td>
                  <td style={td}>
                    <button onClick={(e) => { e.stopPropagation(); deleteLead(l.id); }}
                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #F0F3FA' }}>
            <span style={{ fontSize: 13, color: '#8492A6' }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pgBtn}>← Prev</button>
              {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                const pg = i + 1;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    style={{ ...pgBtn, backgroundColor: page === pg ? '#182350' : '', color: page === pg ? '#fff' : '#1A1A2E' }}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pgBtn}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {addModal && (
        <AddLeadModal projects={projects} sources={sources}
          onClose={() => setAddModal(false)} onAdded={() => { loadLeads(); }} />
      )}
      {selected && (
        <LeadDetailModal lead={selected} projects={projects} sources={sources} telecallers={telecallers}
          onClose={() => setSelected(null)} onUpdated={loadLeads} />
      )}
    </div>
  );
}

// Shared styles
const inp = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box', outline: 'none' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };
const tbl = { width: '100%', borderCollapse: 'collapse' };
const th  = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '10px 14px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td  = { padding: '10px 14px', fontSize: 13 };
const pgBtn = { padding: '5px 12px', borderRadius: 7, border: '1.5px solid #E0E6F0', backgroundColor: '#fff', fontSize: 12, color: '#1A1A2E', cursor: 'pointer' };
const saveBtn   = { padding: '9px 20px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const cancelBtn = { padding: '9px 16px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const overlay   = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal     = { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid #F0F3FA' };
const closeBtn  = { background: 'none', border: 'none', fontSize: 16, color: '#8492A6', cursor: 'pointer', padding: '2px 6px' };
