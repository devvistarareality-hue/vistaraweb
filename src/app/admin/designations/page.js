'use client';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDesignations, createDesignation, deleteDesignation } from '../../../redux/actions/designationActions';
import Toast from '../../../components/Toast';
import { ALL_MODULES } from '../../../lib/moduleAccess';

import Icon from '../../../components/Icon';
const MODULE_COLOR = {
  Sales:      { bg: 'var(--warning-soft)', text: 'var(--warning-2)', dot: 'var(--warning-2)' },
  HR:         { bg: 'var(--accent-soft)', text: 'var(--accent)', dot: 'var(--accent)' },
  'Task Allocation': { bg: 'var(--warning-soft)', text: 'var(--warning-2)', dot: 'var(--warning-2)' },
  Purchase:   { bg: 'var(--accent-soft)', text: 'var(--accent-deep)', dot: 'var(--accent-deep)' },
  Land:       { bg: 'var(--success-soft)', text: 'var(--success)', dot: 'var(--success)' },
  'Club 1000': { bg: 'var(--success-soft)', text: 'var(--success)', dot: 'var(--success)' },
};

export default function DesignationMasterPage() {
  const dispatch = useDispatch();
  const { designations, error } = useSelector((s) => s.designations);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [form,  setForm]  = useState({ module: 'Sales', name: '' });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  useEffect(() => { dispatch(fetchDesignations(true, companyId)); }, [companyId]);

  const showToast = (message, type = 'success') =>
    setToast({ visible: true, message, type });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    dispatch(createDesignation({ module: form.module, name: form.name.trim(), ...(companyId ? { company_id: companyId } : {}) }));
    showToast(`"${form.name.trim()}" added to ${form.module}.`, 'success');
    setForm((f) => ({ ...f, name: '' }));
  };

  const handleDelete = (d) => {
    dispatch(deleteDesignation(d.id));
    showToast(`"${d.name}" removed.`, 'error');
  };

  // Group designations by module
  const grouped = ALL_MODULES.reduce((acc, mod) => {
    acc[mod] = designations.filter((d) => d.module === mod);
    return acc;
  }, {});

  return (
    <div style={s.page}>
      <Toast {...toast} onHide={() => setToast((t) => ({ ...t, visible: false }))} />

      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Designation Master</h1>
          <p style={s.pageSubtitle}>Define designations per module. These appear in the user creation form based on selected modules.</p>
        </div>
      </div>

      {/* Create form */}
      <div className="nx-card" style={{ backgroundColor: 'var(--surface)', borderRadius: 20, marginBottom: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--surface-3)', overflow: 'hidden' }}>
        <div className="nx-modal-head" style={{ background: 'var(--hero)', padding: '18px 24px 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Add New Designation</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Define designations per module for user profiles</div>
        </div>
        <form onSubmit={handleCreate} style={{ padding: '20px 24px', display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 }}>Module</label>
            <select className="nx-input" value={form.module} onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))}
              style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, backgroundColor: 'var(--surface-2)', outline: 'none', cursor: 'pointer' }}>
              {ALL_MODULES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 }}>Designation Name</label>
            <input className="nx-input" required type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Site Team Manager, HR Executive"
              style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--surface-2)' }}
              onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
          </div>
          <div>
            <button className="nx-btn nx-btn-sm nx-btn-primary" type="submit" style={{ height: 40, padding: '0 22px', background: 'var(--strong)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
        </form>
        {error && <div style={{ margin: '0 24px 16px', backgroundColor: 'var(--danger-soft)', border: '1px solid var(--danger-2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
      </div>

      {/* Designations grouped by module */}
      <div style={s.grid}>
        {ALL_MODULES.map((mod) => {
          const c    = MODULE_COLOR[mod] || { bg: 'var(--surface-2)', text: 'var(--text-3)', dot: 'var(--faint)' };
          const list = grouped[mod] || [];
          return (
            <div className="nx-card" key={mod} style={s.moduleCard}>
              <div style={s.moduleHeader}>
                <span style={{ ...s.moduleDot, backgroundColor: c.dot }} />
                <span style={{ ...s.moduleName, color: c.text }}>{mod}</span>
                <span style={s.moduleCount}>{list.length}</span>
              </div>
              {list.length === 0 ? (
                <p style={s.emptyHint}>No designations yet. Add one above.</p>
              ) : (
                <div style={s.chipList}>
                  {list.map((d) => (
                    <div key={d.id} style={{ ...s.chip, backgroundColor: c.bg }}>
                      <span style={{ ...s.chipText, color: c.text }}>{d.name}</span>
                      <button className="nx-btn nx-btn-sm nx-icon-btn nx-btn-ghost"
                        onClick={() => handleDelete(d)}
                        style={{ ...s.chipDel, color: c.text }}
                        title="Remove"
                      >
                        <Icon name="x" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  page:        { padding: '32px 36px', minHeight: '100vh', backgroundColor: 'transparent' },
  pageHeader:  { marginBottom: 24 },
  pageTitle:   { fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 4 },
  pageSubtitle:{ fontSize: 13, color: 'var(--muted)', margin: 0 },

  card:      { backgroundColor: 'var(--surface)', borderRadius: 20, padding: '24px', marginBottom: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--surface-3)' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16, marginTop: 0 },
  formRow:   { display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
  label:     { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 },
  select:    { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, backgroundColor: 'var(--surface)' },
  input:     { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, boxSizing: 'border-box' },
  addBtn:    { padding: '10px 22px', backgroundColor: 'var(--strong)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },

  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 },
  moduleCard:  { backgroundColor: 'var(--surface)', borderRadius: 18, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid var(--surface-3)', minHeight: 120 },
  moduleHeader:{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 },
  moduleDot:   { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  moduleName:  { fontSize: 14, fontWeight: 700, flex: 1 },
  moduleCount: { fontSize: 11, fontWeight: 600, color: 'var(--faint)', backgroundColor: 'var(--surface-2)', borderRadius: 14, padding: '2px 8px' },
  emptyHint:   { fontSize: 12, color: 'var(--faint)', margin: 0, fontStyle: 'italic' },
  chipList:    { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip:        { display: 'flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '4px 10px 4px 12px' },
  chipText:    { fontSize: 13, fontWeight: 600 },
  chipDel:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0, lineHeight: 1, opacity: 0.6 },
};
