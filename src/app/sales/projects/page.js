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

function PlotWizard({ hasTypes, setHasTypes, noTypePlots, setNoTypePlots, plotTypes, setPlotTypes, addType, removeType, updateType, validTypes, totalTypePlots, inp, lbl }) {
  return (
    <div>
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
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 32px', gap: 8, marginBottom: 6 }}>
            <span style={lbl}>Type Name</span>
            <span style={lbl}>From #</span>
            <span style={lbl}>To #</span>
            <span />
          </div>
          {plotTypes.map((pt, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input value={pt.name} onChange={e => updateType(i, 'name', e.target.value)} style={inp} placeholder="e.g. A" />
              <input type="number" min="1" value={pt.from} onChange={e => updateType(i, 'from', e.target.value)} style={inp} placeholder="1" />
              <input type="number" min="1" value={pt.to} onChange={e => updateType(i, 'to', e.target.value)} style={inp} placeholder="10" />
              <button type="button" onClick={() => removeType(i)}
                style={{ background: 'none', border: 'none', color: plotTypes.length > 1 ? '#EF4444' : '#D1D5DB', cursor: plotTypes.length > 1 ? 'pointer' : 'default', fontSize: 16, padding: 0 }}
                disabled={plotTypes.length === 1}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addType}
            style={{ fontSize: 12, fontWeight: 700, color: '#3D5AFE', background: 'none', border: '1.5px dashed #3D5AFE', borderRadius: 8, padding: '6px 16px', cursor: 'pointer', marginBottom: 10 }}>
            + Add Type
          </button>
          {validTypes.length > 0 && (
            <div style={{ background: '#F8FAFD', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#8492A6' }}>
              {validTypes.map(pt => (
                <div key={pt.name} style={{ marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, color: '#1A1A2E' }}>{pt.name}</span>{': '}
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
  );
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

  // Plot setup state (used for both Add and Edit)
  const [hasTypes,    setHasTypes]    = useState(false);
  const [noTypePlots, setNoTypePlots] = useState('');
  const [plotTypes,   setPlotTypes]   = useState([{ name: '', from: '1', to: '' }]);
  // For edit: track whether the "add more plots" section is expanded
  const [addingMore,  setAddingMore]  = useState(false);
  // For edit: editable type names — [{original, current}]
  const [editableTypes, setEditableTypes] = useState(
    () => (project?.plot_type_plans || []).map(pt => ({ original: pt.name, current: pt.name }))
  );

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

    // For new: build plots from wizard. For edit+addingMore: also build additional plots.
    const plots      = (!isEdit || addingMore) ? buildPlots() : [];
    const totalPlots = isEdit ? (form.total_plots === '' ? 0 : Number(form.total_plots)) : plots.length;

    setSaving(true); setErr('');

    const payload = { ...form, total_plots: isEdit ? totalPlots : 0 };
    const url    = isEdit ? SALES_ENDPOINTS.project(project.id) : SALES_ENDPOINTS.projects;
    const method = isEdit ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
    const data   = await res.json();

    if (!res.ok) { setSaving(false); setErr(data.detail || JSON.stringify(data)); return; }

    // Rename cluster_types on plots if type names changed (edit only)
    if (isEdit) {
      const renames = editableTypes.filter(t => t.original !== t.current && t.current.trim());
      for (const r of renames) {
        await fetch(SALES_ENDPOINTS.plotsRenameType, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ project_id: data.id, old_name: r.original, new_name: r.current.trim() }),
        });
      }
      // Also update plot_type_plans names to match
      if (renames.length > 0) {
        const updatedPlans = (project.plot_type_plans || []).map(pt => {
          const rename = renames.find(r => r.original === pt.name);
          return rename ? { ...pt, name: rename.current.trim() } : pt;
        });
        await fetch(SALES_ENDPOINTS.project(data.id), {
          method: 'PATCH', headers: authHeaders(),
          body: JSON.stringify({ plot_type_plans: updatedPlans }),
        });
      }
    }

    if (plots.length > 0) {
      await fetch(SALES_ENDPOINTS.plotsBulk, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ project_id: data.id, plots }),
      });
      const newTotal = isEdit ? totalPlots + plots.length : plots.length;
      await fetch(SALES_ENDPOINTS.project(data.id), {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ total_plots: newTotal }),
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

  const mInp = { width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: '#FAFAFA' };
  const mLbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 5 };
  const mSec = { fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 };

  return (
    <div style={overlay}>
      <div style={{ backgroundColor: '#fff', borderRadius: 20, width: '90%', maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(24,35,80,0.18)', overflow: 'hidden' }}>

        {/* Gradient Header */}
        <div style={{ background: 'linear-gradient(135deg, #182350 0%, #2D3E8C 100%)', padding: '22px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>{isEdit ? 'Edit Project' : 'Add Project'}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{isEdit ? 'Update project details' : 'Fill in details to create a new project'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <form onSubmit={submit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', flex: 1 }}>

          {/* Basic Info */}
          <div style={mSec}>Basic Info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={mLbl}>Project Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input value={form.name} onChange={e => set('name', e.target.value)} style={mInp} placeholder="e.g. Vistara Heights Phase 1"
                onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
            </div>
            <div>
              <label style={mLbl}>Tagline</label>
              <input value={form.tagline} onChange={e => set('tagline', e.target.value)} style={mInp} placeholder="Where Nature Meets Luxury"
                onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={mLbl}>Location</label>
                <input value={form.location} onChange={e => set('location', e.target.value)} style={mInp} placeholder="Pune, Maharashtra"
                  onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
              </div>
              <div>
                <label style={mLbl}>Type</label>
                <select value={form.project_type} onChange={e => set('project_type', e.target.value)} style={{ ...mInp, cursor: 'pointer' }}>
                  {['residential','commercial','plots','villa','apartment','industrial'].map(t => (
                    <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={mLbl}>RERA Number</label>
                <input value={form.rera} onChange={e => set('rera', e.target.value)} style={mInp} placeholder="RERA/PNE/2024/001"
                  onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
              </div>
              <div>
                <label style={mLbl}>Total Area</label>
                <input value={form.total_area} onChange={e => set('total_area', e.target.value)} style={mInp} placeholder="25 Acres"
                  onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={mLbl}>Price Range</label>
                <input value={form.price_range} onChange={e => set('price_range', e.target.value)} style={mInp} placeholder="₹45L – ₹1.2Cr"
                  onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
              </div>
              <div>
                <label style={mLbl}>Possession Date</label>
                <input value={form.possession} onChange={e => set('possession', e.target.value)} style={mInp} placeholder="Dec 2026"
                  onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
              </div>
            </div>
            <div>
              <label style={mLbl}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} style={{ ...mInp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1A2E', cursor: 'pointer', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${form.is_active ? '#BBF7D0' : '#E5E7EB'}`, backgroundColor: form.is_active ? '#F0FFF4' : '#FAFAFA' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} style={{ accentColor: '#2E7D32' }} />
              <span style={{ fontWeight: 600, color: form.is_active ? '#2E7D32' : '#6B7280' }}>Active project</span>
            </label>
          </div>

          {/* Media */}
          <div style={mSec}>Media</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <MediaUpload label="Cover Image" value={form.cover_image_url} onChange={v => set('cover_image_url', v)}
              folder="erp/projects/covers" accept="image/*" hint="Upload project cover image (JPG / PNG)" />
            <MediaUpload label="Master Plan" value={form.master_plan_url} onChange={v => set('master_plan_url', v)}
              folder="erp/projects/masterplans" accept="image/*,application/pdf" hint="Upload master plan image or PDF" />
          </div>

          {/* Plot Setup */}
          <div style={mSec}>Plot Setup</div>
          <div style={{ marginBottom: 20 }}>
            {isEdit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {editableTypes.length > 0 && (
                  <div>
                    <label style={mLbl}>Plot Types — click to rename</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {editableTypes.map((t, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <input value={t.current}
                            onChange={e => setEditableTypes(prev => prev.map((x, xi) => xi === i ? { ...x, current: e.target.value } : x))}
                            style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: t.original !== t.current ? '#FFF7ED' : '#EDE7F6', color: t.original !== t.current ? '#C2410C' : '#673AB7', border: `1.5px solid ${t.original !== t.current ? '#FED7AA' : '#C4B5E0'}`, outline: 'none', minWidth: 70, textAlign: 'center' }} />
                          {t.original !== t.current && (
                            <span style={{ position: 'absolute', top: -6, right: -4, fontSize: 9, background: '#C2410C', color: '#fff', borderRadius: 10, padding: '1px 5px', fontWeight: 700 }}>renamed</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {editableTypes.some(t => t.original !== t.current) && (
                      <p style={{ fontSize: 11, color: '#C2410C', marginTop: 6 }}>⚠ Renaming will update all plots with that type name.</p>
                    )}
                  </div>
                )}
                <div style={{ maxWidth: 200 }}>
                  <label style={mLbl}>Total Plots / Units</label>
                  <input type="number" min="0" value={form.total_plots} onChange={e => set('total_plots', e.target.value)} style={mInp} placeholder="e.g. 36" />
                </div>
                <button type="button" onClick={() => setAddingMore(m => !m)}
                  style={{ fontSize: 12, fontWeight: 700, color: addingMore ? '#EF4444' : '#3D5AFE', background: 'none', border: `1.5px dashed ${addingMore ? '#EF4444' : '#3D5AFE'}`, borderRadius: 8, padding: '6px 16px', cursor: 'pointer', width: 'fit-content' }}>
                  {addingMore ? '✕ Cancel adding plots' : '+ Add More Plots'}
                </button>
                {addingMore && <PlotWizard hasTypes={hasTypes} setHasTypes={setHasTypes} noTypePlots={noTypePlots} setNoTypePlots={setNoTypePlots} plotTypes={plotTypes} setPlotTypes={setPlotTypes} addType={addType} removeType={removeType} updateType={updateType} validTypes={validTypes} totalTypePlots={totalTypePlots} inp={mInp} lbl={mLbl} />}
              </div>
            ) : (
              <PlotWizard hasTypes={hasTypes} setHasTypes={setHasTypes} noTypePlots={noTypePlots} setNoTypePlots={setNoTypePlots} plotTypes={plotTypes} setPlotTypes={setPlotTypes} addType={addType} removeType={removeType} updateType={updateType} validTypes={validTypes} totalTypePlots={totalTypePlots} inp={mInp} lbl={mLbl} />
            )}
          </div>

          {err && <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px', marginBottom: 12, fontSize: 12, color: '#DC2626' }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #182350 0%, #3D5AFE 100%)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, minWidth: 120 }}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : '+ Add Project'}
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
