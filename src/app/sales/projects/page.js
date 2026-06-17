'use client';
import { useState, useEffect } from 'react';
import { SALES_ENDPOINTS } from '../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function ProjectModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:         project?.name         || '',
    description:  project?.description  || '',
    location:     project?.location     || '',
    project_type: project?.project_type || 'residential',
    is_active:    project?.is_active    ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!form.name) { setErr('Project name is required.'); return; }
    setSaving(true);
    const url    = project ? SALES_ENDPOINTS.project(project.id) : SALES_ENDPOINTS.projects;
    const method = project ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(form) });
    const data   = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(data.detail || JSON.stringify(data)); return; }
    onSaved(data);
    onClose();
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{project ? 'Edit Project' : 'Add Project'}</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Project Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} placeholder="e.g. Vistara Heights Phase 1" />
          </div>
          <div>
            <label style={lbl}>Location</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={inp} placeholder="Pune, Maharashtra" />
          </div>
          <div>
            <label style={lbl}>Type</label>
            <select value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} style={inp}>
              {['residential','commercial','plots','villa'].map((t) => (
                <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} style={{ ...inp, height: 'auto', padding: '8px 12px', resize: 'vertical' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1A2E', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active project
          </label>
          {err && <p style={{ color: '#EF4444', fontSize: 12 }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...saveBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : project ? 'Save Changes' : 'Add Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null); // null | 'add' | project obj

  useEffect(() => {
    fetch(SALES_ENDPOINTS.projects, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setProjects(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggleActive(p) {
    const res  = await fetch(SALES_ENDPOINTS.project(p.id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ is_active: !p.is_active }),
    });
    const data = await res.json();
    if (res.ok) setProjects((prev) => prev.map((x) => x.id === p.id ? data : x));
  }

  async function deleteProject(p) {
    if (!window.confirm(`Delete "${p.name}"? All linked leads will lose their project.`)) return;
    const res = await fetch(SALES_ENDPOINTS.project(p.id), { method: 'DELETE', headers: authHeaders() });
    if (res.ok) setProjects((prev) => prev.filter((x) => x.id !== p.id));
  }

  function onSaved(data) {
    setProjects((prev) => {
      const idx = prev.findIndex((x) => x.id === data.id);
      return idx >= 0 ? prev.map((x) => x.id === data.id ? data : x) : [data, ...prev];
    });
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Projects</h1>
          <p style={{ fontSize: 13, color: '#8492A6' }}>{projects.length} projects</p>
        </div>
        <button onClick={() => setModal('add')} style={saveBtn}>+ Add Project</button>
      </div>

      {loading ? (
        <p style={{ color: '#8492A6', textAlign: 'center', marginTop: 60 }}>Loading…</p>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 80, color: '#8492A6' }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No projects yet</p>
          <p style={{ fontSize: 13 }}>Add your first real estate project to start assigning leads.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
          {projects.map((p) => (
            <div key={p.id} style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 2 }}>{p.name}</p>
                  {p.location && <p style={{ fontSize: 12, color: '#8492A6' }}>📍 {p.location}</p>}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                  backgroundColor: p.is_active ? '#E8F5E9' : '#FEE2E2',
                  color: p.is_active ? '#2E7D32' : '#EF4444',
                }}>
                  {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#8492A6', textTransform: 'capitalize', marginBottom: 6 }}>{p.project_type}</p>
              {p.description && <p style={{ fontSize: 12, color: '#8492A6', marginBottom: 10, lineHeight: 1.5 }}>{p.description}</p>}
              <p style={{ fontSize: 12, color: '#3D5AFE', fontWeight: 600, marginBottom: 14 }}>{p.lead_count} leads</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModal(p)} style={{ ...outlineBtn, flex: 1 }}>Edit</button>
                <button onClick={() => toggleActive(p)} style={{ ...outlineBtn, flex: 1, color: p.is_active ? '#E65100' : '#2E7D32' }}>
                  {p.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => deleteProject(p)} style={{ ...outlineBtn, color: '#EF4444', borderColor: '#EF4444' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ProjectModal
          project={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

const inp       = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box' };
const lbl       = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };
const saveBtn   = { padding: '9px 20px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const cancelBtn = { padding: '9px 16px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const outlineBtn = { padding: '7px 12px', backgroundColor: '#fff', border: '1.5px solid #E0E6F0', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#1A1A2E', cursor: 'pointer' };
const card      = { backgroundColor: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' };
const overlay   = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal     = { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid #F0F3FA' };
const closeBtn  = { background: 'none', border: 'none', fontSize: 16, color: '#8492A6', cursor: 'pointer', padding: '2px 6px' };
