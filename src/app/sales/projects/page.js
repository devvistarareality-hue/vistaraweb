'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { SALES_ENDPOINTS } from '../../../constants/api';
import { getCache, setCache, bustCache } from '../../sales/_cache';
import MediaUpload from '../../../components/MediaUpload';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function ProjectModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:            project?.name            || '',
    description:     project?.description     || '',
    location:        project?.location        || '',
    project_type:    project?.project_type    || 'residential',
    is_active:       project?.is_active       ?? true,
    tagline:         project?.tagline         || '',
    rera:            project?.rera            || '',
    total_area:      project?.total_area      || '',
    total_plots:     project?.total_plots     ?? '',
    price_range:     project?.price_range     || '',
    possession:      project?.possession      || '',
    cover_image_url: project?.cover_image_url || '',
    master_plan_url: project?.master_plan_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Project name is required.'); return; }
    setSaving(true);
    const payload = { ...form, total_plots: form.total_plots === '' ? 0 : Number(form.total_plots) };
    const url    = project ? SALES_ENDPOINTS.project(project.id) : SALES_ENDPOINTS.projects;
    const method = project ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
    const data   = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(data.detail || JSON.stringify(data)); return; }
    onSaved(data);
    onClose();
  }

  return (
    <div style={overlay}>
      <div style={{ ...modal, maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={modalHeader}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{project ? 'Edit Project' : 'Add Project'}</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Row: Name */}
          <div>
            <label style={lbl}>Project Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} style={inp} placeholder="e.g. Vistara Heights Phase 1" />
          </div>

          {/* Row: Tagline */}
          <div>
            <label style={lbl}>Tagline</label>
            <input value={form.tagline} onChange={e => set('tagline', e.target.value)} style={inp} placeholder="Where Nature Meets Luxury" />
          </div>

          {/* Row: Location + Type side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} style={inp} placeholder="Pune, Maharashtra" />
            </div>
            <div>
              <label style={lbl}>Type</label>
              <select value={form.project_type} onChange={e => set('project_type', e.target.value)} style={inp}>
                {['residential','commercial','plots','villa','apartment'].map(t => (
                  <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row: RERA + Total Area */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>RERA Number</label>
              <input value={form.rera} onChange={e => set('rera', e.target.value)} style={inp} placeholder="RERA/PNE/2024/001" />
            </div>
            <div>
              <label style={lbl}>Total Area</label>
              <input value={form.total_area} onChange={e => set('total_area', e.target.value)} style={inp} placeholder="25 Acres" />
            </div>
          </div>

          {/* Row: Total Plots + Price Range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Total Plots / Units</label>
              <input type="number" min="0" value={form.total_plots} onChange={e => set('total_plots', e.target.value)} style={inp} placeholder="240" />
            </div>
            <div>
              <label style={lbl}>Price Range</label>
              <input value={form.price_range} onChange={e => set('price_range', e.target.value)} style={inp} placeholder="₹45L – ₹1.2Cr" />
            </div>
          </div>

          {/* Row: Possession */}
          <div>
            <label style={lbl}>Possession Date</label>
            <input value={form.possession} onChange={e => set('possession', e.target.value)} style={inp} placeholder="Dec 2026" />
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} style={{ ...inp, height: 'auto', padding: '8px 12px', resize: 'vertical' }} />
          </div>

          {/* Cover Image */}
          <MediaUpload
            label="Cover Image"
            value={form.cover_image_url}
            onChange={v => set('cover_image_url', v)}
            folder="erp/projects/covers"
            accept="image/*"
            hint="Upload project cover image (JPG / PNG)"
          />

          {/* Master Plan */}
          <MediaUpload
            label="Master Plan"
            value={form.master_plan_url}
            onChange={v => set('master_plan_url', v)}
            folder="erp/projects/masterplans"
            accept="image/*,application/pdf"
            hint="Upload master plan image or PDF"
          />

          {/* Active */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1A2E', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Active project
          </label>

          {Number(form.total_plots) > 0 && !project && (
            <p style={{ fontSize: 12, color: '#3D5AFE', background: '#F0F3FF', padding: '8px 12px', borderRadius: 8 }}>
              {form.total_plots} plots will be auto-generated when you save. You can mark them sold/available from "Manage Plots".
            </p>
          )}

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
  const router = useRouter();
  const user   = useSelector((s) => s.auth.user);

  useEffect(() => {
    if (user && user.role !== 'Admin' && !user.is_staff) router.replace('/sales');
  }, [user]);

  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal, setShowModal] = useState(null); // null | 'add' | project obj

  useEffect(() => {
    const cached = getCache('projects');
    if (cached) { setProjects(cached); setLoading(false); return; }
    fetch(SALES_ENDPOINTS.projects, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { const list = Array.isArray(d) ? d : []; setCache('projects', list); setProjects(list); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggleActive(p) {
    const res  = await fetch(SALES_ENDPOINTS.project(p.id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ is_active: !p.is_active }),
    });
    const data = await res.json();
    if (res.ok) { bustCache('projects'); setProjects(prev => prev.map(x => x.id === p.id ? data : x)); }
  }

  async function deleteProject(p) {
    if (!window.confirm(`Delete "${p.name}"? All linked leads will lose their project.`)) return;
    const res = await fetch(SALES_ENDPOINTS.project(p.id), { method: 'DELETE', headers: authHeaders() });
    if (res.ok) { bustCache('projects'); setProjects(prev => prev.filter(x => x.id !== p.id)); }
  }

  function onSaved(data) {
    bustCache('projects');
    setProjects(prev => {
      const idx = prev.findIndex(x => x.id === data.id);
      return idx >= 0 ? prev.map(x => x.id === data.id ? data : x) : [data, ...prev];
    });
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Projects</h1>
          <p style={{ fontSize: 13, color: '#8492A6' }}>{projects.length} projects</p>
        </div>
        <button onClick={() => setShowModal('add')} style={saveBtn}>+ Add Project</button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="s-skel" style={{ height: 200 }} />)}
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 80, color: '#8492A6' }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No projects yet</p>
          <p style={{ fontSize: 13 }}>Add your first real estate project to start assigning leads.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 16 }}>
          {projects.map(p => {
            const pc = p.plot_counts || {};
            const total = pc.total || 0;
            const sold = pc.sold || 0;
            const pct = total ? Math.round(sold / total * 100) : 0;
            return (
              <div key={p.id} style={card}>
                {/* Full-bleed image */}
                <div style={{ position: 'relative' }}>
                  {p.cover_image_url ? (
                    <img src={p.cover_image_url} alt={p.name}
                      style={{ width: '100%', height: 200, objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: 200, background: '#EEF1F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C0C8D8" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      <span style={{ fontSize: 12, color: '#B0BAC9' }}>No cover image</span>
                    </div>
                  )}
                  <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 11, fontWeight: 800, padding: '5px 10px', borderRadius: 18, backgroundColor: p.is_active ? '#E8F5E9' : '#FEF2F2', color: p.is_active ? '#2E7D32' : '#C62828', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                    {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                {/* Card content */}
                <div style={{ padding: '16px 18px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 2 }}>{p.name}</p>
                    {p.tagline && <p style={{ fontSize: 11, color: '#8492A6', fontStyle: 'italic', marginBottom: 2 }}>{p.tagline}</p>}
                    {p.location && <p style={{ fontSize: 12, color: '#8492A6' }}>📍 {p.location}</p>}
                  </div>
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 10, fontSize: 12, color: '#8492A6' }}>
                  <span style={{ textTransform: 'capitalize' }}>{p.project_type}</span>
                  {p.total_area && <span>• {p.total_area}</span>}
                  {p.price_range && <span>• {p.price_range}</span>}
                  {p.possession && <span>• {p.possession}</span>}
                  {p.rera && <span>• {p.rera}</span>}
                </div>

                {/* Plot progress */}
                {total > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8492A6', marginBottom: 4 }}>
                      <span>{total} plots</span>
                      <span style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: '#2E7D32' }}>✓ {pc.available} avail</span>
                        <span style={{ color: '#E65100' }}>⏸ {pc.hold} hold</span>
                        <span style={{ color: '#EF4444' }}>✕ {pc.sold} sold</span>
                      </span>
                    </div>
                    <div style={{ height: 5, borderRadius: 4, background: '#F0F3FA', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#3D5AFE,#E91E63)', borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#8492A6', marginTop: 2 }}>{pct}% sold</div>
                  </div>
                )}

                <p style={{ fontSize: 12, color: '#3D5AFE', fontWeight: 600, marginBottom: 12 }}>{p.lead_count} leads</p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {total > 0 && (
                    <button onClick={() => router.push(`/sales/projects/${p.id}`)} style={{ ...primaryOutlineBtn, flex: 1 }}>
                      Manage Plots
                    </button>
                  )}
                  <button onClick={() => setShowModal(p)} style={{ ...outlineBtn, flex: 1 }}>Edit</button>
                  <button onClick={() => toggleActive(p)} style={{ ...outlineBtn, flex: 1, color: p.is_active ? '#E65100' : '#2E7D32' }}>
                    {p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => deleteProject(p)} style={{ ...outlineBtn, color: '#EF4444', borderColor: '#EF4444' }}>✕</button>
                </div>
                </div>{/* end card content */}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ProjectModal
          project={showModal === 'add' ? null : showModal}
          onClose={() => setShowModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

const inp            = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #C6D0DB', fontSize: 13, boxSizing: 'border-box' };
const lbl            = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };
const saveBtn        = { padding: '9px 20px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const cancelBtn      = { padding: '9px 16px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const outlineBtn     = { padding: '7px 12px', backgroundColor: '#fff', border: '1.5px solid #C6D0DB', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#1A1A2E', cursor: 'pointer' };
const primaryOutlineBtn = { padding: '7px 12px', backgroundColor: '#F0F3FF', border: '1.5px solid #3D5AFE', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#3D5AFE', cursor: 'pointer' };
const card           = { backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(100,120,160,0.18)', border: '1px solid #C8D0E0', overflow: 'hidden' };
const overlay        = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal          = { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader    = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid #F0F3FA' };
const closeBtn       = { background: 'none', border: 'none', fontSize: 16, color: '#8492A6', cursor: 'pointer', padding: '2px 6px' };
