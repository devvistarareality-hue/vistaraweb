'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ERP_MASTER, ERP_EXECUTION } from '../../../../constants/api';

const GREEN = '#2E7D32';

function Select({ label, value, onChange, options, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 6 }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E0E6F0', fontSize: 14, color: value ? '#1A1A2E' : '#8492A6', background: '#fff', outline: 'none', cursor: 'pointer' }}
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E0E6F0', fontSize: 14, color: '#1A1A2E', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  );
}

const emptyLine = () => ({ activity: '', item_code: '', qty_required: '', uom: '', required_date: '', remarks: '' });

export default function CreatePRPage() {
  const router = useRouter();
  const [projects,    setProjects]    = useState([]);
  const [activities,  setActivities]  = useState([]);
  const [materials,   setMaterials]   = useState([]);
  const [projectId,   setProjectId]   = useState('');
  const [remarks,     setRemarks]     = useState('');
  const [lines,       setLines]       = useState([emptyLine()]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  useEffect(() => { loadMaster(); }, []);

  async function loadMaster() {
    const token = localStorage.getItem('access_token');
    const h = { Authorization: `Bearer ${token}` };
    const [prjRes, matRes] = await Promise.all([
      fetch(ERP_MASTER.projects, { headers: h }),
      fetch(ERP_MASTER.materials, { headers: h }),
    ]);
    if (prjRes.ok) { const d = await prjRes.json(); setProjects((Array.isArray(d) ? d : d.results || []).map((p) => ({ id: p.id, label: p.name }))); }
    if (matRes.ok) { const d = await matRes.json(); setMaterials((Array.isArray(d) ? d : d.results || []).map((m) => ({ id: m.id, label: m.name, uom: m.uom }))); }
  }

  async function handleProjectChange(pid) {
    setProjectId(pid);
    setActivities([]);
    if (!pid) return;
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${ERP_MASTER.wbs}?project=${pid}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setActivities((Array.isArray(d) ? d : d.results || []).map((a) => ({ id: a.id, label: `${a.wbs_code} — ${a.name}` }))); }
  }

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, ...patch };
      if (patch.item_code) {
        const mat = materials.find((m) => String(m.id) === String(patch.item_code));
        if (mat) updated.uom = mat.uom || '';
      }
      return updated;
    }));
  }

  async function handleSubmit() {
    setError(''); setSuccess('');
    if (!projectId) { setError('Please select a project.'); return; }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.activity) { setError(`Line ${i + 1}: Select a WBS activity.`); return; }
      if (!l.item_code) { setError(`Line ${i + 1}: Select a material.`); return; }
      if (!l.qty_required || parseFloat(l.qty_required) <= 0) { setError(`Line ${i + 1}: Enter valid quantity.`); return; }
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const body = {
        project: parseInt(projectId),
        remarks,
        lines: lines.map((l) => ({
          activity:     parseInt(l.activity),
          project:      parseInt(projectId),
          item_code:    parseInt(l.item_code),
          qty_required: parseFloat(l.qty_required),
          uom:          l.uom,
          required_date: l.required_date || null,
          remarks:       l.remarks,
        })),
      };
      const res = await fetch(ERP_EXECUTION.prs, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`PR ${data.pr_no} created successfully!`);
        setTimeout(() => router.push('/erp/pr'), 1600);
      } else {
        const e = await res.json();
        setError(JSON.stringify(e));
      }
    } catch { setError('Network error. Please try again.'); }
    setSaving(false);
  }

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.push('/erp/pr')} style={{ background: '#E8F5E9', border: 'none', borderRadius: 10, padding: '8px 14px', color: GREEN, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>← Back</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>New Purchase Requisition</h1>
          <p style={{ fontSize: 13, color: '#8492A6', margin: '4px 0 0' }}>Raise a material request from site to procurement</p>
        </div>
      </div>

      {error   && <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 10, padding: '12px 16px', color: '#C62828', fontSize: 13, marginBottom: 20 }}>{error}</div>}
      {success && <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 10, padding: '12px 16px', color: '#2E7D32', fontSize: 13, marginBottom: 20 }}>{success}</div>}

      <div style={{ background: '#fff', borderRadius: 18, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 20 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1.2, marginTop: 0, marginBottom: 20 }}>PR DETAILS</h3>
        <Select label="PROJECT *" value={projectId} onChange={handleProjectChange} options={projects} placeholder="Select project..." />
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 6 }}>REMARKS</label>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Optional remarks..."
            style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E0E6F0', fontSize: 14, color: '#1A1A2E', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      {/* Lines */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1.2, margin: 0 }}>PR LINES *</h3>
        <button onClick={() => setLines((prev) => [...prev, emptyLine()])}
          style={{ background: '#E8F5E9', border: 'none', borderRadius: 8, padding: '7px 14px', color: GREEN, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          + Add Line
        </button>
      </div>

      {lines.map((line, idx) => (
        <div key={idx} style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', borderLeft: `4px solid ${GREEN}`, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: GREEN }}>Line {idx + 1}</span>
            {lines.length > 1 && (
              <button onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                style={{ background: '#FFEBEE', border: 'none', borderRadius: 8, padding: '5px 10px', color: '#C62828', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                Remove
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Select label="WBS ACTIVITY *" value={line.activity} onChange={(v) => updateLine(idx, { activity: v })}
              options={activities} placeholder={projectId ? 'Select activity...' : 'Select project first'} />
            <Select label="MATERIAL *" value={line.item_code} onChange={(v) => updateLine(idx, { item_code: v })}
              options={materials} placeholder="Select material..." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px', gridColumn: 'span 2' }}>
              <Input label="QTY REQUIRED *" value={line.qty_required} onChange={(v) => updateLine(idx, { qty_required: v })} type="number" placeholder="0" />
              <Input label="UOM" value={line.uom} onChange={(v) => updateLine(idx, { uom: v })} placeholder="Nos" />
              <Input label="REQUIRED DATE" value={line.required_date} onChange={(v) => updateLine(idx, { required_date: v })} type="date" />
              <Input label="LINE REMARKS" value={line.remarks} onChange={(v) => updateLine(idx, { remarks: v })} placeholder="Optional" />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={saving}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', background: GREEN, border: 'none', borderRadius: 12, padding: '16px', color: '#fff', fontSize: 15, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: 10 }}
      >
        {saving ? 'Creating...' : '📋 Raise Purchase Requisition'}
      </button>
    </div>
  );
}
