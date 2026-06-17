'use client';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDesignations, createDesignation, deleteDesignation } from '../../../redux/actions/designationActions';
import Toast from '../../../components/Toast';

const ALL_MODULES = ['Sales', 'HR', 'Execution', 'Purchase', 'Land'];

const MODULE_COLOR = {
  Sales:      { bg: '#FFF8E1', text: '#E6960A', dot: '#F9A825' },
  HR:         { bg: '#E8EEFF', text: '#3D5AFE', dot: '#3D5AFE' },
  Execution:  { bg: '#FFF0E6', text: '#EA580C', dot: '#EA580C' },
  Purchase:   { bg: '#F3E5F5', text: '#7B1FA2', dot: '#7B1FA2' },
  Land:       { bg: '#E8F5E9', text: '#2E7D32', dot: '#22C55E' },
};

export default function DesignationMasterPage() {
  const dispatch = useDispatch();
  const { designations, error } = useSelector((s) => s.designations);
  const [form,  setForm]  = useState({ module: 'Sales', name: '' });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  useEffect(() => { dispatch(fetchDesignations()); }, []);

  const showToast = (message, type = 'success') =>
    setToast({ visible: true, message, type });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    dispatch(createDesignation({ module: form.module, name: form.name.trim() }));
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
      <div style={s.card}>
        <h3 style={s.cardTitle}>Add New Designation</h3>
        <form onSubmit={handleCreate} style={s.formRow}>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Module</label>
            <select
              value={form.module}
              onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))}
              style={s.select}
            >
              {ALL_MODULES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label style={s.label}>Designation Name</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Site Team Manager, Channel Partner, HR Executive"
              style={s.input}
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button type="submit" style={s.addBtn}>+ Add</button>
          </div>
        </form>
        {error && <p style={{ color: '#DC2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      {/* Designations grouped by module */}
      <div style={s.grid}>
        {ALL_MODULES.map((mod) => {
          const c    = MODULE_COLOR[mod] || { bg: '#F5F6FA', text: '#6B7280', dot: '#9CA3AF' };
          const list = grouped[mod] || [];
          return (
            <div key={mod} style={s.moduleCard}>
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
                      <button
                        onClick={() => handleDelete(d)}
                        style={{ ...s.chipDel, color: c.text }}
                        title="Remove"
                      >
                        ✕
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
  page:        { padding: '32px 36px', minHeight: '100vh', backgroundColor: '#F4F6FB' },
  pageHeader:  { marginBottom: 24 },
  pageTitle:   { fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 },
  pageSubtitle:{ fontSize: 13, color: '#8492A6', margin: 0 },

  card:      { backgroundColor: '#fff', borderRadius: 16, padding: '24px', marginBottom: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #EEF1F7' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 16, marginTop: 0 },
  formRow:   { display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
  label:     { display: 'block', fontSize: 12, fontWeight: 600, color: '#8492A6', marginBottom: 6 },
  select:    { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 14, backgroundColor: '#fff' },
  input:     { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 14, boxSizing: 'border-box' },
  addBtn:    { padding: '10px 22px', backgroundColor: '#0C1E3C', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },

  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 },
  moduleCard:  { backgroundColor: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #EEF1F7', minHeight: 120 },
  moduleHeader:{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 },
  moduleDot:   { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  moduleName:  { fontSize: 14, fontWeight: 700, flex: 1 },
  moduleCount: { fontSize: 11, fontWeight: 600, color: '#9CA3AF', backgroundColor: '#F3F4F6', borderRadius: 10, padding: '2px 8px' },
  emptyHint:   { fontSize: 12, color: '#9CA3AF', margin: 0, fontStyle: 'italic' },
  chipList:    { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip:        { display: 'flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '4px 10px 4px 12px' },
  chipText:    { fontSize: 13, fontWeight: 600 },
  chipDel:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0, lineHeight: 1, opacity: 0.6 },
};
