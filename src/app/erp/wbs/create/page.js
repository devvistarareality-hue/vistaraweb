'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ERP_MASTER } from '../../../../constants/api';

const GREEN = '#2E7D32';

const inputStyle = {
  width: '100%', padding: '10px 13px', borderRadius: 10,
  border: '1.5px solid #E0E6F0', fontSize: 13, color: '#1A1A2E',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
};
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const labelStyle  = { display: 'block', fontSize: 10, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 5 };

const fmtINR = (n) => {
  const v = parseFloat(n) || 0;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(2)} L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

const emptyLine = () => ({
  parentId:    '',
  wbsCode:     '',
  description: '',
  itemCode:    '',
  uom:         '',
  budgetedQty: '',
  unitRate:    '',
});

export default function CreateWBSPage() {
  const router = useRouter();
  const [projects,   setProjects]   = useState([]);
  const [materials,  setMaterials]  = useState([]);
  const [parentOpts, setParentOpts] = useState([]);
  const [projectId,  setProjectId]  = useState('');
  const [lines,      setLines]      = useState([emptyLine()]);
  const [saving,     setSaving]     = useState(false);
  const [progress,   setProgress]   = useState('');
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');

  useEffect(() => { loadMaster(); }, []);

  async function loadMaster() {
    const token = localStorage.getItem('access_token');
    const h = { Authorization: `Bearer ${token}` };
    const [prjRes, matRes] = await Promise.all([
      fetch(ERP_MASTER.projects, { headers: h }),
      fetch(ERP_MASTER.materials, { headers: h }),
    ]);
    if (prjRes.ok) { const d = await prjRes.json(); setProjects(Array.isArray(d) ? d : (d.results || [])); }
    if (matRes.ok) { const d = await matRes.json(); setMaterials(Array.isArray(d) ? d : (d.results || [])); }
  }

  async function handleProjectChange(pid) {
    setProjectId(pid);
    setParentOpts([]);
    setLines([emptyLine()]);
    if (!pid) return;
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${ERP_MASTER.wbs}?project=${pid}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const d = await res.json(); setParentOpts(Array.isArray(d) ? d : (d.results || [])); }
  }

  function updateLine(idx, patch) {
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, ...patch };
      if (patch.itemCode !== undefined) {
        const mat = materials.find((m) => String(m.id) === String(patch.itemCode));
        if (mat?.uom) updated.uom = mat.uom;
      }
      return updated;
    }));
  }

  const grandTotal = lines.reduce((s, l) => s + (parseFloat(l.budgetedQty) || 0) * (parseFloat(l.unitRate) || 0), 0);

  async function handleSubmit() {
    setError(''); setSuccess(''); setProgress('');
    if (!projectId) { setError('Please select a project.'); return; }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.wbsCode.trim())     { setError(`Line ${i + 1}: WBS Code is required.`);    return; }
      if (!l.description.trim()) { setError(`Line ${i + 1}: Description is required.`); return; }
      if (!l.budgetedQty || parseFloat(l.budgetedQty) < 0) { setError(`Line ${i + 1}: Enter a valid budgeted quantity.`); return; }
      if (!l.unitRate    || parseFloat(l.unitRate) < 0)    { setError(`Line ${i + 1}: Enter a valid unit rate.`);         return; }
    }

    setSaving(true);
    const token = localStorage.getItem('access_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const created = [];
    const errors  = [];

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      setProgress(`Saving ${i + 1} of ${lines.length}...`);
      try {
        const res = await fetch(ERP_MASTER.wbs, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            project:         parseInt(projectId),
            parent_activity: l.parentId ? parseInt(l.parentId) : null,
            wbs_code:        l.wbsCode.trim(),
            description:     l.description.trim(),
            item_code:       l.itemCode ? parseInt(l.itemCode) : null,
            uom:             l.uom.trim(),
            budgeted_qty:    parseFloat(l.budgetedQty),
            unit_rate:       parseFloat(l.unitRate),
          }),
        });
        if (res.ok) {
          const d = await res.json();
          created.push(d.wbs_code);
        } else {
          const e = await res.json();
          errors.push(`Line ${i + 1} (${l.wbsCode}): ${JSON.stringify(e)}`);
        }
      } catch {
        errors.push(`Line ${i + 1} (${l.wbsCode}): Network error`);
      }
    }

    setProgress('');
    setSaving(false);

    if (errors.length === 0) {
      setSuccess(`${created.length} WBS ${created.length === 1 ? 'entry' : 'entries'} saved successfully! (${created.join(', ')})`);
      setTimeout(() => router.push('/erp/wbs'), 1800);
    } else {
      if (created.length > 0) setSuccess(`${created.length} saved: ${created.join(', ')}`);
      setError(errors.join('\n'));
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.push('/erp/wbs')}
          style={{ background: '#E8F5E9', border: 'none', borderRadius: 10, padding: '8px 14px', color: GREEN, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          ← Back
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>New WBS / BOQ Entries</h1>
          <p style={{ fontSize: 13, color: '#8492A6', margin: '4px 0 0' }}>Add multiple BOQ activities in one go — all lines saved together</p>
        </div>
      </div>

      {error   && <div style={{ background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 10, padding: '12px 16px', color: '#C62828', fontSize: 13, marginBottom: 16, whiteSpace: 'pre-line' }}>{error}</div>}
      {success && <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 10, padding: '12px 16px', color: '#2E7D32', fontSize: 13, marginBottom: 16 }}>{success}</div>}
      {progress && <div style={{ background: '#EEF0FF', border: '1px solid #C5CAE9', borderRadius: 10, padding: '12px 16px', color: '#3D5AFE', fontSize: 13, marginBottom: 16 }}>{progress}</div>}

      {/* Project selector — shared across all lines */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#8492A6', letterSpacing: 1.2, marginBottom: 16 }}>PROJECT</div>
        <select value={projectId} onChange={(e) => handleProjectChange(e.target.value)}
          style={{ ...selectStyle, maxWidth: 400 }}>
          <option value="">Select project...</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {projectId && (
          <p style={{ fontSize: 12, color: '#8492A6', margin: '8px 0 0' }}>
            All entries below will be added to this project.
            {parentOpts.length > 0 && ` ${parentOpts.length} existing activities available as parents.`}
          </p>
        )}
      </div>

      {/* Lines header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#8492A6', letterSpacing: 1.2 }}>
          WBS ACTIVITIES ({lines.length} {lines.length === 1 ? 'entry' : 'entries'})
        </div>
        <button
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          style={{ background: '#E8F5E9', border: 'none', borderRadius: 8, padding: '7px 16px', color: GREEN, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          + Add Line
        </button>
      </div>

      {/* Line cards */}
      {lines.map((line, idx) => {
        const lineCost = (parseFloat(line.budgetedQty) || 0) * (parseFloat(line.unitRate) || 0);
        return (
          <div key={idx} style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', borderLeft: `4px solid ${GREEN}`, marginBottom: 14 }}>
            {/* Line header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: GREEN }}>Activity {idx + 1}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {lineCost > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: GREEN, background: '#E8F5E9', padding: '3px 12px', borderRadius: 20 }}>
                    {fmtINR(lineCost)}
                  </span>
                )}
                {lines.length > 1 && (
                  <button onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    style={{ background: '#FFEBEE', border: 'none', borderRadius: 8, padding: '5px 12px', color: '#C62828', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Row 1: WBS Code + Description + Parent */}
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 240px', gap: '0 14px', marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>WBS CODE *</label>
                <input value={line.wbsCode} onChange={(e) => updateLine(idx, { wbsCode: e.target.value })}
                  placeholder="1.1 / A-01" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>DESCRIPTION *</label>
                <input value={line.description} onChange={(e) => updateLine(idx, { description: e.target.value })}
                  placeholder="Activity description..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>PARENT ACTIVITY</label>
                <select value={line.parentId} onChange={(e) => updateLine(idx, { parentId: e.target.value })}
                  disabled={!projectId}
                  style={{ ...selectStyle, background: projectId ? '#fff' : '#F5F6FA', cursor: projectId ? 'pointer' : 'not-allowed' }}>
                  <option value="">None (top-level)</option>
                  {parentOpts.map((a) => (
                    <option key={a.id} value={a.id}>{a.wbs_code} — {a.description?.slice(0, 35)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Material + UOM + Qty + Rate + Cost */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 130px 150px 150px', gap: '0 14px', alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>MATERIAL (optional)</label>
                <select value={line.itemCode} onChange={(e) => updateLine(idx, { itemCode: e.target.value })} style={selectStyle}>
                  <option value="">Select material...</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>UOM</label>
                <input value={line.uom} onChange={(e) => updateLine(idx, { uom: e.target.value })}
                  placeholder="Sqm" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>BUDGETED QTY *</label>
                <input type="number" value={line.budgetedQty} onChange={(e) => updateLine(idx, { budgetedQty: e.target.value })}
                  placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>UNIT RATE (₹) *</label>
                <input type="number" value={line.unitRate} onChange={(e) => updateLine(idx, { unitRate: e.target.value })}
                  placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>BUDGETED COST</label>
                <div style={{ ...inputStyle, background: lineCost > 0 ? '#E8F5E9' : '#F5F6FA', color: lineCost > 0 ? GREEN : '#8492A6', fontWeight: 700, cursor: 'default' }}>
                  {lineCost > 0 ? fmtINR(lineCost) : '—'}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Grand Total + Submit */}
      <div style={{ background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', borderRadius: 16, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, marginBottom: 3 }}>TOTAL WBS ESTIMATION</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{lines.length} {lines.length === 1 ? 'activity' : 'activities'} · Qty × Rate</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{fmtINR(grandTotal)}</div>
          {grandTotal >= 100000 && grandTotal < 10000000 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving || !projectId}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', background: GREEN, border: 'none', borderRadius: 12, padding: '16px', color: '#fff', fontSize: 15, fontWeight: 800, cursor: (saving || !projectId) ? 'not-allowed' : 'pointer', opacity: (saving || !projectId) ? 0.65 : 1 }}
      >
        {saving ? progress || 'Saving...' : `📐 Save ${lines.length} WBS ${lines.length === 1 ? 'Entry' : 'Entries'}`}
      </button>
    </div>
  );
}
