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
  const isEdit = !!project;

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

  // Plot setup (new projects only)
  const [hasTypes,    setHasTypes]    = useState(false);
  const [noTypePlots, setNoTypePlots] = useState('');
  const [plotTypes,   setPlotTypes]   = useState([{ name: '', from: '1', to: '' }]);

  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function addType()              { setPlotTypes(p => [...p, { name: '', from: '1', to: '' }]); }
  function removeType(i)          { setPlotTypes(p => p.filter((_, idx) => idx !== i)); }
  function updateType(i, k, v)    { setPlotTypes(p => p.map((t, idx) => idx === i ? { ...t, [k]: v } : t)); }

  function buildPlots() {
    if (hasTypes) {
      const arr = [];
      for (const pt of plotTypes) {
        const name = pt.name.trim();
        const from = Number(pt.from);
        const to   = Number(pt.to);
        if (!name || !from || !to || to < from) continue;
        for (let n = from; n <= to; n++) arr.push({ number: `${name}${n}`, cluster_type: name });
      }
      return arr;
    }
    const count = Number(noTypePlots);
    if (!count || count < 1) return [];
    return Array.from({ length: count }, (_, i) => ({ number: String(i + 1), cluster_type: '' }));
  }

  const validTypes    = plotTypes.filter(pt => pt.name.trim() && Number(pt.from) && Number(pt.to) && Number(pt.to) >= Number(pt.from));
  const totalTypePlots = validTypes.reduce((s, pt) => s + Number(pt.to) - Number(pt.from) + 1, 0);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Project name is required.'); return; }

    const plots      = !isEdit ? buildPlots() : [];
    const totalPlots = isEdit ? (form.total_plots === '' ? 0 : Number(form.total_plots)) : plots.length;

    setSaving(true); setErr('');

    // Send total_plots=0 on new project so the backend _sync_plots() creates nothing.
    // We'll bulk-create plots ourselves, then PATCH total_plots to the real count.
    const payload = { ...form, total_plots: isEdit ? totalPlots : 0 };
    const url    = isEdit ? SALES_ENDPOINTS.project(project.id) : SALES_ENDPOINTS.projects;
    const method = isEdit ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
    const data   = await res.json();

    if (!res.ok) { setSaving(false); setErr(data.detail || JSON.stringify(data)); return; }

    if (!isEdit && plots.length > 0) {
      await fetch(SALES_ENDPOINTS.plotsBulk, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ project_id: data.id, plots }),
      });
      // Update total_plots to the real count now that plots are created
      await fetch(SALES_ENDPOINTS.project(data.id), {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ total_plots: totalPlots }),
      });
    }

    // Fetch the project fresh so plot_counts reflects the new plots
    let finalData = data;
    try {
      const r = await fetch(SALES_ENDPOINTS.project(data.id), { headers: authHeaders() });
      if (r.ok) finalData = await r.json();
    } catch { /* use original data */ }

    setSaving(false);
    onSaved(finalData);
    onClose();
  }

  return (
    <div style={overlay}>
      <div style={{ ...modal, maxWidth: 560, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={modalHeader}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{isEdit ? 'Edit Project' : 'Add Project'}</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Name */}
          <div>
            <label style={lbl}>Project Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} style={inp} placeholder="e.g. Vistara Heights Phase 1" />
          </div>

          {/* Tagline */}
          <div>
            <label style={lbl}>Tagline</label>
            <input value={form.tagline} onChange={e => set('tagline', e.target.value)} style={inp} placeholder="Where Nature Meets Luxury" />
          </div>

          {/* Location + Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} style={inp} placeholder="Pune, Maharashtra" />
            </div>
            <div>
              <label style={lbl}>Type</label>
              <select value={form.project_type} onChange={e => set('project_type', e.target.value)} style={inp}>
                {['residential','commercial','plots','villa','apartment','industrial'].map(t => (
                  <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* RERA + Total Area */}
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

          {/* Price Range + Possession (+ Total Plots for edit mode only) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Price Range</label>
              <input value={form.price_range} onChange={e => set('price_range', e.target.value)} style={inp} placeholder="₹45L – ₹1.2Cr" />
            </div>
            <div>
              <label style={lbl}>Possession Date</label>
              <input value={form.possession} onChange={e => set('possession', e.target.value)} style={inp} placeholder="Dec 2026" />
            </div>
          </div>

          {isEdit && (
            <div style={{ maxWidth: 200 }}>
              <label style={lbl}>Total Plots / Units</label>
              <input type="number" min="0" value={form.total_plots} onChange={e => set('total_plots', e.target.value)} style={inp} placeholder="240" />
            </div>
          )}

          {/* Description */}
          <div>
            <label style={lbl}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} style={{ ...inp, height: 'auto', padding: '8px 12px', resize: 'vertical' }} />
          </div>

          {/* Cover Image */}
          <MediaUpload label="Cover Image" value={form.cover_image_url} onChange={v => set('cover_image_url', v)}
            folder="erp/projects/covers" accept="image/*" hint="Upload project cover image (JPG / PNG)" />

          {/* Master Plan */}
          <MediaUpload label="Master Plan" value={form.master_plan_url} onChange={v => set('master_plan_url', v)}
            folder="erp/projects/masterplans" accept="image/*,application/pdf" hint="Upload master plan image or PDF" />

          {/* Active */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1A2E', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Active project
          </label>

          {/* ── Plot Setup (new projects only) ── */}
          {!isEdit && (
            <div style={{ borderTop: '1.5px solid #F0F3FA', paddingTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Plot Setup
              </p>

              {/* Has types toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: '#1A1A2E', fontWeight: 600 }}>Does this project have plot types?</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['No', false], ['Yes', true]].map(([label, val]) => (
                    <button key={label} type="button" onClick={() => setHasTypes(val)}
                      style={{ padding: '5px 16px', borderRadius: 7, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        borderColor: hasTypes === val ? (val ? '#3D5AFE' : '#182350') : '#E0E6F0',
                        backgroundColor: hasTypes === val ? (val ? '#3D5AFE' : '#182350') : '#fff',
                        color: hasTypes === val ? '#fff' : '#8492A6' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {!hasTypes ? (
                /* No types — simple count */
                <div>
                  <label style={lbl}>Number of Plots</label>
                  <input type="number" min="0" max="9999" value={noTypePlots}
                    onChange={e => setNoTypePlots(e.target.value)}
                    style={{ ...inp, maxWidth: 160 }} placeholder="e.g. 20" />
                  {Number(noTypePlots) > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#3D5AFE', background: '#F0F3FF', padding: '8px 12px', borderRadius: 8 }}>
                      Will create <strong>{noTypePlots}</strong> plots numbered <strong>1</strong> to <strong>{noTypePlots}</strong>
                    </div>
                  )}
                </div>
              ) : (
                /* With types */
                <div>
                  {/* Header labels */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 32px', gap: 8, marginBottom: 6 }}>
                    <span style={lbl}>Type Name</span>
                    <span style={lbl}>From #</span>
                    <span style={lbl}>To #</span>
                    <span />
                  </div>
                  {plotTypes.map((pt, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input value={pt.name} onChange={e => updateType(i, 'name', e.target.value)}
                        style={inp} placeholder='e.g. A' />
                      <input type="number" min="1" value={pt.from} onChange={e => updateType(i, 'from', e.target.value)}
                        style={inp} placeholder="1" />
                      <input type="number" min="1" value={pt.to} onChange={e => updateType(i, 'to', e.target.value)}
                        style={inp} placeholder="10" />
                      <button type="button" onClick={() => removeType(i)}
                        style={{ background: 'none', border: 'none', color: plotTypes.length > 1 ? '#EF4444' : '#D1D5DB', cursor: plotTypes.length > 1 ? 'pointer' : 'default', fontSize: 16, padding: 0 }}
                        disabled={plotTypes.length === 1}>✕</button>
                    </div>
                  ))}

                  <button type="button" onClick={addType}
                    style={{ fontSize: 12, fontWeight: 700, color: '#3D5AFE', background: 'none', border: '1.5px dashed #3D5AFE', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', marginBottom: 10 }}>
                    + Add Type
                  </button>

                  {/* Preview */}
                  {validTypes.length > 0 && (
                    <div style={{ background: '#F8FAFD', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#8492A6' }}>
                      {validTypes.map(pt => (
                        <div key={pt.name} style={{ marginBottom: 3 }}>
                          <span style={{ fontWeight: 700, color: '#1A1A2E' }}>{pt.name}</span>
                          {': '}
                          <span style={{ color: '#3D5AFE' }}>{pt.name}{pt.from} → {pt.name}{pt.to}</span>
                          <span style={{ marginLeft: 6 }}>({Number(pt.to) - Number(pt.from) + 1} plots)</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 6, fontWeight: 700, color: '#182350', borderTop: '1px solid #E8ECF4', paddingTop: 6 }}>
                        Total: {totalTypePlots} plots
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {err && <p style={{ color: '#EF4444', fontSize: 12 }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...saveBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating…' : isEdit ? 'Save Changes' : 'Add Project'}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 24 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="s-skel" style={{ height: 200 }} />)}
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 80, color: '#8492A6' }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No projects yet</p>
          <p style={{ fontSize: 13 }}>Add your first real estate project to start assigning leads.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 24 }}>
          {projects.map(p => {
            const pc = p.plot_counts || {};
            const total = pc.total || 0;
            const sold = pc.sold || 0;
            const pct = total ? Math.round(sold / total * 100) : 0;
            return (
              <div key={p.id} style={card}>
                {/* Image area — contain so nothing is cropped */}
                <div style={{ position: 'relative', background: '#F2F4F8', height: 180, overflow: 'hidden' }}>
                  {p.cover_image_url ? (
                    <img src={p.cover_image_url} alt={p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C0C8D8" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      <span style={{ fontSize: 12, color: '#C0C8D8' }}>No cover image</span>
                    </div>
                  )}
                  {/* Status badge + type chip overlaid */}
                  <div style={{ position: 'absolute', top: 10, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', color: '#8492A6', textTransform: 'capitalize', backdropFilter: 'blur(4px)' }}>
                      {p.project_type}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20, backgroundColor: p.is_active ? '#E8F5E9' : '#FEF2F2', color: p.is_active ? '#2E7D32' : '#C62828', boxShadow: '0 1px 6px rgba(0,0,0,0.10)' }}>
                      {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>

                {/* Card content */}
                <div style={{ padding: '14px 16px 16px' }}>
                  {/* Name + location */}
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E', marginBottom: 2 }}>{p.name}</p>
                  {p.location && <p style={{ fontSize: 12, color: '#8492A6', marginBottom: 6 }}>📍 {p.location}</p>}
                  {p.tagline && <p style={{ fontSize: 11, color: '#A0AABA', fontStyle: 'italic', marginBottom: 6 }}>{p.tagline}</p>}

                  {/* Meta chips */}
                  {(p.total_area || p.price_range || p.possession) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {p.total_area   && <span style={metaChip}>{p.total_area}</span>}
                      {p.price_range  && <span style={metaChip}>{p.price_range}</span>}
                      {p.possession   && <span style={metaChip}>📅 {p.possession}</span>}
                    </div>
                  )}

                  {/* Plot stats */}
                  {total > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8492A6', marginBottom: 5 }}>
                        <span style={{ fontWeight: 600 }}>{total} plots</span>
                        <span style={{ display: 'flex', gap: 10 }}>
                          <span style={{ color: '#2E7D32', fontWeight: 600 }}>✓ {pc.available}</span>
                          <span style={{ color: '#E65100', fontWeight: 600 }}>⏸ {pc.hold}</span>
                          <span style={{ color: '#EF4444', fontWeight: 600 }}>✕ {pc.sold}</span>
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 4, background: '#EEF1F7', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#3D5AFE,#E91E63)', borderRadius: 4 }} />
                      </div>
                    </div>
                  )}

                  {/* Leads */}
                  <p style={{ fontSize: 12, color: '#3D5AFE', fontWeight: 700, marginBottom: 12 }}>
                    {p.lead_count} {p.lead_count === 1 ? 'lead' : 'leads'}
                  </p>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {total > 0 && (
                      <button onClick={() => router.push(`/sales/projects/${p.id}`)} style={{ ...primaryOutlineBtn, flex: 1 }}>
                        Manage Plots
                      </button>
                    )}
                    <button onClick={() => setShowModal(p)} style={{ ...outlineBtn, flex: 1 }}>Edit</button>
                    <button onClick={() => toggleActive(p)} style={{ ...outlineBtn, flex: 1, color: p.is_active ? '#E65100' : '#2E7D32', borderColor: p.is_active ? '#E6510030' : '#2E7D3230' }}>
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => deleteProject(p)} style={{ ...outlineBtn, color: '#EF4444', borderColor: '#EF444440', padding: '7px 10px' }}>✕</button>
                  </div>
                </div>
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
const card           = { backgroundColor: '#fff', borderRadius: 18, boxShadow: '0 6px 28px rgba(100,120,160,0.16)', border: '1.5px solid #DDE3EE', overflow: 'hidden' };
const metaChip       = { fontSize: 11, fontWeight: 600, color: '#6B7A90', backgroundColor: '#F0F3F8', padding: '3px 8px', borderRadius: 6 };
const overlay        = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal          = { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader    = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid #F0F3FA' };
const closeBtn       = { background: 'none', border: 'none', fontSize: 16, color: '#8492A6', cursor: 'pointer', padding: '2px 6px' };
