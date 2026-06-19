'use client';
import React, { useState, useEffect, useCallback } from 'react';
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

function DupBadge({ count }) {
  return (
    <span title={`Duplicate phone — seen ${count || 1} time(s) before`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 6, fontSize: 10, fontWeight: 800, backgroundColor: '#FFF1F1', color: '#DC2626', border: '1px solid #FECACA', letterSpacing: 0.3 }}>
      ⚠ DUP
    </span>
  );
}

/* ── Toast Notification ── */
function DupToast({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ backgroundColor: '#fff', border: '1.5px solid #FECACA', borderLeft: '4px solid #DC2626', borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'slideIn 0.25s ease' }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#DC2626', marginBottom: 2 }}>Duplicate Lead</div>
            <div style={{ fontSize: 12, color: '#1A1A2E', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
            <div style={{ fontSize: 11, color: '#8492A6', marginTop: 1 }}>{t.phone} · already in system</div>
          </div>
          <button onClick={() => onDismiss(t.id)} style={{ background: 'none', border: 'none', color: '#B0BAC9', cursor: 'pointer', fontSize: 16, flexShrink: 0, padding: 0 }}>✕</button>
        </div>
      ))}
    </div>
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
      <div style={{ backgroundColor: '#fff', borderRadius: 20, width: '90%', maxWidth: 520, boxShadow: '0 24px 80px rgba(24,35,80,0.18)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #182350 0%, #2D3E8C 100%)', padding: '22px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>Add Manual Lead</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Fill in the details to create a new lead</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <form onSubmit={submit} style={{ padding: '22px 24px 24px' }}>
          {/* Contact Info */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Contact Info</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px', marginBottom: 18 }}>
            {[
              { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Client name', required: true },
              { label: 'Phone',     key: 'phone', type: 'text', placeholder: '+91 99999 99999', required: true },
              { label: 'Alt. Phone', key: 'alt_phone', type: 'text', placeholder: 'Optional' },
              { label: 'Email',     key: 'email', type: 'email', placeholder: 'Optional' },
            ].map(({ label, key, type, placeholder, required }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>
                  {label}{required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
                </label>
                <input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: '#FAFAFA', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#3D5AFE'}
                  onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
            ))}
          </div>

          {/* Project & Source */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Assignment</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px', marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>Project</label>
              <div style={{ position: 'relative' }}>
                <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}
                  style={{ width: '100%', height: 40, padding: '0 32px 0 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: '#FAFAFA', appearance: 'none', cursor: 'pointer', color: form.project ? '#1A1A2E' : '#9CA3AF' }}>
                  <option value="">Select project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: 12 }}>▾</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>Source</label>
              <div style={{ position: 'relative' }}>
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                  style={{ width: '100%', height: 40, padding: '0 32px 0 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: '#FAFAFA', appearance: 'none', cursor: 'pointer', color: form.source ? '#1A1A2E' : '#9CA3AF', textTransform: 'capitalize' }}>
                  <option value="">Select source</option>
                  {sources.map((s) => <option key={s.id} value={s.id} style={{ textTransform: 'capitalize' }}>{s.name}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: 12 }}>▾</span>
              </div>
            </div>
          </div>

          {err && (
            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px', marginBottom: 16, fontSize: 12, color: '#DC2626' }}>
              {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '10px 20px', backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #182350 0%, #3D5AFE 100%)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, minWidth: 100 }}>
              {saving ? 'Adding…' : '+ Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Lead Detail Modal ───────────────────────────────────────────────────────
const HISTORY_LABEL = {
  status:            'Overall Status',
  telecaller_status: 'TC Status',
  stm_status:        'STM Status',
  telecaller:        'Telecaller Assigned',
  stm:               'STM Assigned',
};
const HISTORY_COLOR = {
  status:            '#3D5AFE',
  telecaller_status: '#0097A7',
  stm_status:        '#FF6B2B',
  telecaller:        '#7B1FA2',
  stm:               '#2E7D32',
};

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function LeadDetailModal({ lead, projects, sources, telecallers, stms, onClose, onUpdated }) {
  const user = useSelector((s) => s.auth.user);
  const [activeTab, setActiveTab] = useState('detail');
  const [detail,    setDetail]    = useState(null);
  const [form, setForm] = useState({});
  const [saving,    setSaving]    = useState(false);

  // Followup form
  const [fuForm,    setFuForm]    = useState({ role_context: 'telecaller', scheduled_at: '', remarks: '' });
  const [savingFu,  setSavingFu]  = useState(false);
  const [fuErr,     setFuErr]     = useState('');

  useEffect(() => {
    setForm({
      name: lead.name || '', alt_phone: lead.alt_phone || '',
      status: lead.status,
      telecaller: lead.telecaller || '', telecaller_status: lead.telecaller_status || '',
      telecaller_remarks: lead.telecaller_remarks || '',
      stm: lead.stm || '', stm_status: lead.stm_status || '', stm_remarks: lead.stm_remarks || '',
      project: lead.project || '', source: lead.source || '',
    });
    setActiveTab('detail');
    setDetail(null);
    async function loadDetail() {
      const res = await fetch(SALES_ENDPOINTS.lead(lead.id), { headers: authHeaders() });
      if (res.ok) setDetail(await res.json());
    }
    loadDetail();
  }, [lead?.id]);

  async function save() {
    setSaving(true);
    const body = {
      status: form.status,
      alt_phone: form.alt_phone || '',
      telecaller_remarks: form.telecaller_remarks,
      stm_remarks: form.stm_remarks,
    };
    if (form.name)             body.name             = form.name;
    if (form.telecaller)       body.telecaller       = form.telecaller;
    if (form.telecaller_status)body.telecaller_status= form.telecaller_status;
    if (form.stm)              body.stm              = form.stm;
    if (form.stm_status)       body.stm_status       = form.stm_status;
    if (form.project)          body.project          = form.project;
    if (form.source)           body.source           = form.source;
    const res = await fetch(SALES_ENDPOINTS.lead(lead.id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) { onUpdated(); onClose(); }
  }

  async function addFollowup() {
    if (!fuForm.scheduled_at) { setFuErr('Scheduled date & time is required.'); return; }
    const assignedTo = fuForm.role_context === 'telecaller'
      ? (form.telecaller || user?.id)
      : (form.stm || user?.id);
    if (!assignedTo) { setFuErr('Assign a telecaller or STM to the lead first.'); return; }
    setFuErr('');
    setSavingFu(true);
    const res = await fetch(SALES_ENDPOINTS.followUps, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        lead: lead.id,
        assigned_to: assignedTo,
        role_context: fuForm.role_context,
        scheduled_at: fuForm.scheduled_at,
        remarks: fuForm.remarks,
        status: 'pending',
      }),
    });
    setSavingFu(false);
    if (res.ok) {
      const newFu = await res.json();
      setDetail(d => ({ ...d, follow_ups: [newFu, ...(d?.follow_ups || [])] }));
      setFuForm({ role_context: 'telecaller', scheduled_at: '', remarks: '' });
    } else {
      const err = await res.json().catch(() => ({}));
      setFuErr(JSON.stringify(err));
    }
  }

  async function markFollowupDone(fuId) {
    const res = await fetch(SALES_ENDPOINTS.followUp(fuId), {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDetail(d => ({ ...d, follow_ups: d.follow_ups.map(f => f.id === fuId ? updated : f) }));
    }
  }

  const TC_STATUSES  = ['hot','warm','cold','not_interested','not_reachable','callback'];
  const STM_STATUSES = ['hot','warm','cold','not_interested','sv_scheduled','sv_done','closed'];

  const tabStyle = (key) => ({
    padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
    background: 'none', borderBottom: activeTab === key ? '2px solid #3D5AFE' : '2px solid transparent',
    color: activeTab === key ? '#3D5AFE' : '#8492A6',
  });

  const fuStatusColor = { pending: '#F9A825', completed: '#2E7D32', missed: '#B71C1C', rescheduled: '#0097A7' };

  return (
    <div style={overlay}>
      <div style={{ ...modal, maxWidth: 600, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ ...modalHeader, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{lead.name}</h2>
            <p style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0F3FA', flexShrink: 0 }}>
          {[['detail','Detail'],['history','History'],['followups','Follow-ups']].map(([k,label]) => (
            <button key={k} onClick={() => setActiveTab(k)} style={tabStyle(k)}>{label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>

          {/* ── DETAIL TAB ── */}
          {activeTab === 'detail' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Contact */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <div>
                  <label style={lbl}>Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Alternate Phone</label>
                  <input value={form.alt_phone} onChange={(e) => setForm({ ...form, alt_phone: e.target.value })} style={inp} placeholder="Alt. number" />
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #F0F3FA' }} />

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

              <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.8 }}>STM (Sales)</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                <div>
                  <label style={lbl}>Assign STM</label>
                  <select value={form.stm} onChange={(e) => setForm({ ...form, stm: e.target.value })} style={inp}>
                    <option value="">— None —</option>
                    {stms.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.user_code}</option>)}
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

              {(lead.meta_campaign_name || lead.meta_adset_name || lead.meta_ad_name) && (
                <>
                  <hr style={{ border: 'none', borderTop: '1px solid #F0F3FA' }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.8 }}>Meta Ads Info</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {lead.meta_campaign_name && <div style={{ display: 'flex', gap: 10 }}><span style={{ fontSize: 10, fontWeight: 700, color: '#B0BAC9', minWidth: 72 }}>CAMPAIGN</span><span style={{ fontSize: 12, color: '#3A3A5C', fontWeight: 600 }}>{lead.meta_campaign_name}</span></div>}
                    {lead.meta_adset_name    && <div style={{ display: 'flex', gap: 10 }}><span style={{ fontSize: 10, fontWeight: 700, color: '#B0BAC9', minWidth: 72 }}>AD SET</span><span style={{ fontSize: 12, color: '#3A3A5C', fontWeight: 600 }}>{lead.meta_adset_name}</span></div>}
                    {lead.meta_ad_name       && <div style={{ display: 'flex', gap: 10 }}><span style={{ fontSize: 10, fontWeight: 700, color: '#B0BAC9', minWidth: 72 }}>AD NAME</span><span style={{ fontSize: 12, color: '#3A3A5C', fontWeight: 600 }}>{lead.meta_ad_name}</span></div>}
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
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div>
              {/* Lead received event */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#3D5AFE18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📥</div>
                  <div style={{ width: 2, flex: 1, backgroundColor: '#F0F3FA', marginTop: 4 }} />
                </div>
                <div style={{ paddingBottom: 18, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>Lead Received</p>
                  <p style={{ fontSize: 11, color: '#8492A6', margin: '3px 0 0' }}>
                    Source: {lead.source_name || '—'} · Project: {lead.project_name || '—'}
                  </p>
                  <p style={{ fontSize: 11, color: '#B0BAC9', margin: '3px 0 0' }}>{fmtDateTime(lead.created_at)}</p>
                </div>
              </div>

              {/* History entries */}
              {!detail && <p style={{ fontSize: 13, color: '#8492A6' }}>Loading…</p>}
              {detail && detail.history?.length === 0 && (
                <p style={{ fontSize: 13, color: '#B0BAC9', textAlign: 'center', marginTop: 24 }}>No changes recorded yet.</p>
              )}
              {detail?.history?.map((h, idx) => {
                const isLast = idx === detail.history.length - 1;
                const color  = HISTORY_COLOR[h.field_changed] || '#8492A6';
                const icon   = h.field_changed === 'telecaller' ? '👤'
                             : h.field_changed === 'stm'        ? '🏢'
                             : h.field_changed.includes('status') ? '🔄' : '✏️';
                return (
                  <div key={h.id} style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 18 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{icon}</div>
                      {!isLast && <div style={{ width: 2, flex: 1, backgroundColor: '#F0F3FA', marginTop: 4 }} />}
                    </div>
                    <div style={{ paddingBottom: isLast ? 0 : 18, flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>{HISTORY_LABEL[h.field_changed] || h.field_changed}</p>
                      <p style={{ fontSize: 12, color: '#3A3A5C', margin: '3px 0 0' }}>
                        <span style={{ color: '#8492A6' }}>{h.old_value || '—'}</span>
                        {' → '}
                        <span style={{ color, fontWeight: 600 }}>{h.new_value || '—'}</span>
                      </p>
                      {h.changed_by_name && <p style={{ fontSize: 11, color: '#8492A6', margin: '2px 0 0' }}>by {h.changed_by_name}</p>}
                      <p style={{ fontSize: 11, color: '#B0BAC9', margin: '2px 0 0' }}>{fmtDateTime(h.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── FOLLOWUPS TAB ── */}
          {activeTab === 'followups' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Add new followup */}
              <div style={{ background: '#F8FAFD', borderRadius: 12, padding: 16, border: '1px solid #E4E8F0' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Schedule Follow-up</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>Role</label>
                    <select value={fuForm.role_context} onChange={(e) => setFuForm({ ...fuForm, role_context: e.target.value })} style={inp}>
                      <option value="telecaller">Telecaller</option>
                      <option value="stm">STM</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Date & Time</label>
                    <input type="datetime-local" value={fuForm.scheduled_at}
                      onChange={(e) => setFuForm({ ...fuForm, scheduled_at: e.target.value })} style={inp} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={lbl}>Remarks</label>
                  <textarea value={fuForm.remarks} onChange={(e) => setFuForm({ ...fuForm, remarks: e.target.value })}
                    placeholder="Call notes, instructions…" rows={2}
                    style={{ ...inp, height: 'auto', padding: '8px 12px', resize: 'vertical' }} />
                </div>
                {fuErr && <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>{fuErr}</p>}
                <button onClick={addFollowup} disabled={savingFu}
                  style={{ ...saveBtn, width: '100%', opacity: savingFu ? 0.6 : 1 }}>
                  {savingFu ? 'Saving…' : '+ Add Follow-up'}
                </button>
              </div>

              {/* Existing followups */}
              {!detail && <p style={{ fontSize: 13, color: '#8492A6' }}>Loading…</p>}
              {detail?.follow_ups?.length === 0 && (
                <p style={{ fontSize: 13, color: '#B0BAC9', textAlign: 'center' }}>No follow-ups scheduled yet.</p>
              )}
              {detail?.follow_ups?.map((fu) => (
                <div key={fu.id} style={{ border: '1.5px solid #E4E8F0', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
                        color: fuForm.role_context === 'stm' ? '#FF6B2B' : '#0097A7' }}>
                        {fu.role_context?.toUpperCase()}
                      </span>
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        backgroundColor: (fuStatusColor[fu.status] || '#9E9E9E') + '18',
                        color: fuStatusColor[fu.status] || '#9E9E9E' }}>
                        {fu.status}
                      </span>
                    </div>
                    {fu.status === 'pending' && (
                      <button onClick={() => markFollowupDone(fu.id)}
                        style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 8, border: '1.5px solid #2E7D32', color: '#2E7D32', background: '#fff', cursor: 'pointer' }}>
                        Mark Done
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', margin: '8px 0 2px' }}>{fmtDateTime(fu.scheduled_at)}</p>
                  {fu.assigned_to_name && <p style={{ fontSize: 12, color: '#8492A6', margin: 0 }}>Assigned to: {fu.assigned_to_name}</p>}
                  {fu.remarks && <p style={{ fontSize: 12, color: '#3A3A5C', margin: '6px 0 0' }}>{fu.remarks}</p>}
                  {fu.status === 'completed' && fu.completed_at && (
                    <p style={{ fontSize: 11, color: '#2E7D32', margin: '4px 0 0' }}>✓ Done {fmtDateTime(fu.completed_at)}</p>
                  )}
                </div>
              ))}
            </div>
          )}

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
  const [stms,        setStms]        = useState([]);
  const [filters, setFilters] = useState({
    search: '', status: '', project_id: '', source_id: '',
    telecaller_id: '', stm_id: '', telecaller_status: '', stm_status: '',
    campaign: '', is_duplicate: false, date_from: '', date_to: '',
  });
  const [addModal,    setAddModal]    = useState(false);
  const [selected,    setSelected]    = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting,    setDeleting]    = useState(false);
  const [dupToasts,   setDupToasts]   = useState([]);

  function showDupToast(lead) {
    const id = Date.now() + Math.random();
    setDupToasts((t) => [...t, { id, name: lead.name, phone: lead.phone }]);
    setTimeout(() => setDupToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }
  function dismissToast(id) { setDupToasts((t) => t.filter((x) => x.id !== id)); }

  const loadMeta = useCallback(async () => {
    const cachedP = getCache('projects');
    const cachedS = getCache('sources');
    if (cachedP) setProjects(cachedP);
    if (cachedS) setSources(cachedS);
    const [pRes, sRes, tRes, sRes2] = await Promise.all([
      cachedP ? Promise.resolve(null) : fetch(SALES_ENDPOINTS.projects + '?active_only=true', { headers: authHeaders() }).then((r) => r.json()),
      cachedS ? Promise.resolve(null) : fetch(SALES_ENDPOINTS.sources,     { headers: authHeaders() }).then((r) => r.json()),
      fetch(SALES_ENDPOINTS.telecallers, { headers: authHeaders() }).then((r) => r.json()),
      fetch(SALES_ENDPOINTS.stms,        { headers: authHeaders() }).then((r) => r.json()),
    ]);
    if (pRes) { const p = Array.isArray(pRes) ? pRes : []; setCache('projects', p); setProjects(p); }
    if (sRes) { const s = Array.isArray(sRes) ? sRes : []; setCache('sources',  s); setSources(s);  }
    setTelecallers(Array.isArray(tRes)  ? tRes  : []);
    setStms(       Array.isArray(sRes2) ? sRes2 : []);
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page });
    if (filters.search)          params.set('search',           filters.search);
    if (filters.status)          params.set('status',           filters.status);
    if (filters.project_id)      params.set('project_id',       filters.project_id);
    if (filters.source_id)       params.set('source_id',        filters.source_id);
    if (filters.telecaller_id)   params.set('telecaller_id',    filters.telecaller_id);
    if (filters.stm_id)          params.set('stm_id',           filters.stm_id);
    if (filters.telecaller_status) params.set('telecaller_status', filters.telecaller_status);
    if (filters.stm_status)      params.set('stm_status',       filters.stm_status);
    if (filters.campaign)        params.set('campaign',         filters.campaign);
    if (filters.is_duplicate)    params.set('is_duplicate',     'true');
    if (filters.date_from)       params.set('date_from',        filters.date_from);
    if (filters.date_to)         params.set('date_to',          filters.date_to);
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

  // Auto-refresh every 30 seconds — notify on newly arrived duplicates
  const knownIdsRef = React.useRef(new Set());
  useEffect(() => {
    knownIdsRef.current = new Set(leads.map((l) => l.id));
  }, [leads]);

  useEffect(() => {
    const id = setInterval(async () => {
      bustLeadsCache();
      // Fetch page 1 to check for new duplicates
      const params = new URLSearchParams({ page: 1, is_duplicate: 'true' });
      try {
        const res  = await fetch(`${SALES_ENDPOINTS.leads}?${params}`, { headers: authHeaders() });
        const data = await res.json();
        (data.results ?? []).forEach((l) => {
          if (!knownIdsRef.current.has(l.id)) showDupToast(l);
        });
      } catch { /* ignore */ }
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
      <DupToast toasts={dupToasts} onDismiss={dismissToast} />
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
      {(() => {
        const sf = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
        const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const today = localDate(new Date());
        const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
        const TC_STATUSES  = ['hot','warm','cold','not_interested','not_reachable','callback'];
        const STM_STATUSES = ['hot','warm','cold','not_interested','sv_scheduled','sv_done','closed'];
        const anyFilter = filters.search || filters.status || filters.project_id || filters.source_id ||
          filters.telecaller_id || filters.stm_id || filters.telecaller_status || filters.stm_status ||
          filters.campaign || filters.is_duplicate || filters.date_from || filters.date_to;
        const clearAll = () => setFilters({ search:'', status:'', project_id:'', source_id:'', telecaller_id:'', stm_id:'', telecaller_status:'', stm_status:'', campaign:'', is_duplicate:false, date_from:'', date_to:'' });

        const fSel = {
          height: 36, padding: '0 10px', borderRadius: 8,
          border: '1.5px solid #E8ECF4', fontSize: 12, background: '#F8FAFD',
          cursor: 'pointer', outline: 'none', color: '#1A1A2E', fontWeight: 500,
        };
        const activeSelStyle = (val) => val ? { ...fSel, borderColor: '#3D5AFE', background: '#EEF0FF', color: '#3D5AFE', fontWeight: 600 } : fSel;
        const qBtn = (active) => ({
          height: 36, padding: '0 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          cursor: 'pointer', border: 'none',
          background: active ? '#182350' : '#F0F2F8',
          color: active ? '#fff' : '#8492A6',
          transition: 'all 0.15s',
        });
        const divider = { width: 1, height: 24, background: '#E8ECF4', flexShrink: 0 };

        return (
          <div style={{ backgroundColor: '#fff', borderRadius: 14, border: '1.5px solid #E8ECF4', marginBottom: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

            {/* Search bar */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F3FA' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#B0BAD0' }}>🔍</span>
                <input value={filters.search} onChange={(e) => sf('search', e.target.value)}
                  placeholder="Search name, phone, email…"
                  style={{ width: '100%', height: 40, padding: '0 16px 0 38px', borderRadius: 10, border: '1.5px solid #E8ECF4', fontSize: 13, background: '#F8FAFD', outline: 'none', boxSizing: 'border-box', color: '#1A1A2E' }} />
              </div>
            </div>

            {/* Row 1: Date range + quick buttons + project + tc/stm status */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #F0F3FA' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#B0BAD0', letterSpacing: 0.5, textTransform: 'uppercase', marginRight: 2 }}>Date</span>
              <input type="date" value={filters.date_from} onChange={(e) => sf('date_from', e.target.value)} style={{ ...fSel, width: 136 }} />
              <span style={{ fontSize: 12, color: '#C0C8D8' }}>→</span>
              <input type="date" value={filters.date_to} onChange={(e) => sf('date_to', e.target.value)} style={{ ...fSel, width: 136 }} />
              <div style={divider} />
              <button onClick={() => { sf('date_from', today); sf('date_to', today); }} style={qBtn(filters.date_from === today && filters.date_to === today)}>Today</button>
              <button onClick={() => { sf('date_from', daysAgo(6)); sf('date_to', today); }} style={qBtn(filters.date_from === daysAgo(6) && filters.date_to === today)}>Week</button>
              <button onClick={() => { sf('date_from', daysAgo(29)); sf('date_to', today); }} style={qBtn(filters.date_from === daysAgo(29) && filters.date_to === today)}>Month</button>
              <div style={divider} />
              <select value={filters.project_id} onChange={(e) => sf('project_id', e.target.value)} style={activeSelStyle(filters.project_id)}>
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filters.telecaller_status} onChange={(e) => sf('telecaller_status', e.target.value)} style={activeSelStyle(filters.telecaller_status)}>
                <option value="">TC Status</option>
                {TC_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              <select value={filters.stm_status} onChange={(e) => sf('stm_status', e.target.value)} style={activeSelStyle(filters.stm_status)}>
                <option value="">STM Status</option>
                {STM_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              {anyFilter && (
                <button onClick={clearAll} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1.5px solid #FCA5A5', background: '#FFF5F5', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>
                  ✕ Clear all
                </button>
              )}
            </div>

            {/* Row 2: Status + Source + Telecaller + STM + Campaign + Duplicates */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 16px' }}>
              <select value={filters.status} onChange={(e) => sf('status', e.target.value)} style={activeSelStyle(filters.status)}>
                <option value="">All Statuses</option>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              <select value={filters.source_id} onChange={(e) => sf('source_id', e.target.value)} style={activeSelStyle(filters.source_id)}>
                <option value="">All Sources</option>
                {sources.map((s) => <option key={s.id} value={s.id} style={{ textTransform: 'capitalize' }}>{s.name}</option>)}
              </select>
              <select value={filters.telecaller_id} onChange={(e) => sf('telecaller_id', e.target.value)} style={activeSelStyle(filters.telecaller_id)}>
                <option value="">All Telecallers</option>
                {telecallers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <select value={filters.stm_id} onChange={(e) => sf('stm_id', e.target.value)} style={activeSelStyle(filters.stm_id)}>
                <option value="">All STMs</option>
                {stms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <input value={filters.campaign} onChange={(e) => sf('campaign', e.target.value)}
                placeholder="Campaign name…"
                style={{ ...fSel, width: 170, background: filters.campaign ? '#EEF0FF' : '#F8FAFD', borderColor: filters.campaign ? '#3D5AFE' : '#E8ECF4', color: filters.campaign ? '#3D5AFE' : '#1A1A2E' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: filters.is_duplicate ? '#3D5AFE' : '#8492A6', cursor: 'pointer', userSelect: 'none', padding: '0 10px', height: 36, borderRadius: 8, border: `1.5px solid ${filters.is_duplicate ? '#3D5AFE' : '#E8ECF4'}`, background: filters.is_duplicate ? '#EEF0FF' : '#F8FAFD' }}>
                <input type="checkbox" checked={filters.is_duplicate} onChange={(e) => sf('is_duplicate', e.target.checked)} style={{ width: 14, height: 14, accentColor: '#3D5AFE' }} />
                Duplicates only
              </label>
            </div>
          </div>
        );
      })()}

      {/* Table */}
      <div style={{ backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(184,196,214,0.18)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead style={{ backgroundColor: '#F8FAFD' }}>
              <tr>
                <th style={th}>
                  <input type="checkbox" checked={selectedIds.size === leads.length && leads.length > 0} onChange={toggleAll} />
                </th>
                {['Name', 'Phone', 'Project', 'Source', 'Telecaller', 'STM', 'TC Status', 'STM Status', 'Overall', 'Received', ''].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(12)].map((__, j) => (
                      <td key={j} style={{ padding: '12px 14px' }}>
                        <div className="s-skel" style={{ height: 14, width: j === 0 ? 16 : j === 1 ? 120 : 80, borderRadius: 6 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: '60px 0', color: '#8492A6' }}>No leads found</td></tr>
              ) : leads.map((l) => (
                <tr key={l.id}
                  style={{ borderBottom: '1px solid #F0F3FA', cursor: 'pointer', backgroundColor: l.is_duplicate ? '#FFFBFB' : '' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = l.is_duplicate ? '#FFF5F5' : '#FAFBFE'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = l.is_duplicate ? '#FFFBFB' : ''}>
                  {l.is_duplicate && (
                    <td style={{ ...td, padding: 0, width: 3 }}>
                      <div style={{ width: 3, height: '100%', minHeight: 48, backgroundColor: '#DC2626', borderRadius: '2px 0 0 2px' }} />
                    </td>
                  )}
                  <td style={td} colSpan={l.is_duplicate ? undefined : undefined} onClick={(e) => { e.stopPropagation(); toggleSelect(l.id); }}>
                    <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} />
                  </td>
                  <td style={td} onClick={() => loadDetail(l)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{l.name}</span>
                      {l.is_duplicate && <DupBadge count={l.duplicate_count} />}
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
                  <td style={{ ...td, color: '#3A3A5C', fontSize: 12 }} onClick={() => loadDetail(l)}>{l.telecaller_name || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                  <td style={{ ...td, color: '#3A3A5C', fontSize: 12 }} onClick={() => loadDetail(l)}>{l.stm_name || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                  <td style={td} onClick={() => loadDetail(l)}>
                    {l.telecaller_status ? <StatusBadge status={l.telecaller_status} /> : <span style={{ color: '#D1D5DB' }}>—</span>}
                  </td>
                  <td style={td} onClick={() => loadDetail(l)}>
                    {l.stm_status ? <StatusBadge status={l.stm_status} /> : <span style={{ color: '#D1D5DB' }}>—</span>}
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
          onClose={() => setAddModal(false)} onAdded={(lead) => { if (lead?.is_duplicate) showDupToast(lead); loadLeads(); }} />
      )}
      {selected && (
        <LeadDetailModal lead={selected} projects={projects} sources={sources} telecallers={telecallers} stms={stms}
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
