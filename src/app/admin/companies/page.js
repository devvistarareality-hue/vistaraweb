'use client';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchCompanies, updateCompany, resetUpdateCompany,
  createCompany, resetCreateCompany, deleteCompany,
} from '../../../redux/actions/companiesActions';
import Toast from '../../../components/Toast';
import { COLORS } from '../../../constants/theme';

const EMPTY_FORM = { code: '', name: '', email: '', phone: '' };

const mInp = { width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: '#FAFAFA' };
const mLbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 5 };

function ConfirmModal({ open, title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={{ backgroundColor: '#fff', borderRadius: 20, width: 420, maxWidth: '92vw', boxShadow: '0 24px 80px rgba(24,35,80,0.18)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: 'linear-gradient(135deg, #182350 0%, #2D3E8C 100%)', padding: '20px 24px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{title}</div>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <p style={{ padding: '20px 24px 0', fontSize: 14, color: '#374151', lineHeight: 1.6, margin: 0 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px 20px' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '10px 24px', backgroundColor: confirmColor || '#182350', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function CompanyManagementPage() {
  const dispatch = useDispatch();
  const {
    companies, loading, error,
    updating, updateSuccess, updateError,
    creating, createSuccess, createError,
  } = useSelector((s) => s.companies);

  const [editId,     setEditId]     = useState(null);
  const [editForm,   setEditForm]   = useState({ code: '', name: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [toast,      setToast]      = useState({ visible: false, message: '', type: 'success' });
  const [dialog,     setDialog]     = useState({ open: false });

  useEffect(() => { dispatch(fetchCompanies()); }, []);

  const handleRefresh = () => dispatch(fetchCompanies(true));

  useEffect(() => {
    if (updateSuccess) {
      showToast('Company updated successfully.', 'success');
      setEditId(null);
      dispatch(resetUpdateCompany());
    }
    if (updateError) {
      showToast(updateError, 'error');
      dispatch(resetUpdateCompany());
    }
  }, [updateSuccess, updateError]);

  useEffect(() => {
    if (createSuccess) {
      showToast('Company created successfully.', 'success');
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
      dispatch(resetCreateCompany());
    }
    if (createError) {
      showToast(createError, 'error');
      dispatch(resetCreateCompany());
    }
  }, [createSuccess, createError]);

  const showToast = (message, type = 'success') => setToast({ visible: true, message, type });

  const openEdit = (c) => { setEditId(c.id); setEditForm({ code: c.code, name: c.name }); };
  const closeDialog = () => setDialog({ open: false });

  const handleSave   = () => dispatch(updateCompany(editId, editForm));
  const handleCreate = (e) => {
    e.preventDefault();
    dispatch(createCompany({ ...createForm, code: createForm.code.toUpperCase() }));
  };

  const handleDeactivate = (c) => {
    setDialog({ open: true, title: 'Deactivate Company', message: `Deactivate "${c.name}"? Users of this company will no longer be able to log in.`, confirmLabel: 'Deactivate', confirmColor: '#EA580C',
      onConfirm: () => { dispatch(updateCompany(c.id, { is_active: false })); showToast(`"${c.name}" deactivated.`, 'success'); closeDialog(); } });
  };
  const handleActivate = (c) => {
    setDialog({ open: true, title: 'Reactivate Company', message: `Reactivate "${c.name}"? Users will regain access.`, confirmLabel: 'Activate', confirmColor: '#15803D',
      onConfirm: () => { dispatch(updateCompany(c.id, { is_active: true })); showToast(`"${c.name}" reactivated.`, 'success'); closeDialog(); } });
  };
  const handleDelete = (c) => {
    setDialog({ open: true, title: 'Delete Company', message: `Permanently delete "${c.name}"? This cannot be undone and all related data will be removed.`, confirmLabel: 'Delete', confirmColor: '#DC2626',
      onConfirm: () => { dispatch(deleteCompany(c.id)); showToast(`"${c.name}" permanently deleted.`, 'error'); closeDialog(); } });
  };

  return (
    <div style={s.page}>
      <Toast {...toast} onHide={() => setToast((t) => ({ ...t, visible: false }))} />
      <ConfirmModal {...dialog} onCancel={closeDialog} />

      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Company Management</h1>
          <p style={s.pageSub}>{companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleRefresh} disabled={loading} title="Refresh" style={{ ...s.refreshBtn, opacity: loading ? 0.5 : 1 }}>↻</button>
          <button onClick={() => setShowCreate(true)} style={s.createBtn}>+ Create Company</button>
        </div>
      </div>

      {loading && companies.length === 0 && <p style={s.info}>Loading…</p>}
      {error   && <p style={s.errorTxt}>{error}</p>}

      {(companies.length > 0 || !loading) && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>{['Code', 'Name', 'Email', 'Phone', 'Status', 'Actions'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} style={s.tr}>
                  {editId === c.id ? (
                    <>
                      <td style={s.td}><input value={editForm.code} onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} style={s.inlineInput} /></td>
                      <td style={s.td}><input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} style={s.inlineInput} /></td>
                      <td style={s.td}><span style={s.muted}>{c.email}</span></td>
                      <td style={s.td}><span style={s.muted}>{c.phone}</span></td>
                      <td style={s.td}><span style={{ ...s.statusPill, backgroundColor: c.is_active ? COLORS.success : COLORS.error }}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td style={s.td}>
                        <div style={s.rowActions}>
                          <button onClick={handleSave} disabled={updating} style={{ ...s.saveBtn, opacity: updating ? 0.6 : 1 }}>{updating ? 'Saving…' : 'Save'}</button>
                          <button onClick={() => setEditId(null)} style={s.cancelBtn}>Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={s.td}><code style={s.codePill}>{c.code}</code></td>
                      <td style={s.td}><span style={s.nameText}>{c.name}</span></td>
                      <td style={s.td}><span style={s.muted}>{c.email || '—'}</span></td>
                      <td style={s.td}><span style={s.muted}>{c.phone || '—'}</span></td>
                      <td style={s.td}><span style={{ ...s.statusPill, backgroundColor: c.is_active ? COLORS.success : COLORS.error }}>{c.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td style={s.td}>
                        <div style={s.rowActions}>
                          <button onClick={() => openEdit(c)} style={s.editBtn}>Edit</button>
                          {c.is_active
                            ? <button onClick={() => handleDeactivate(c)} style={s.deactBtn}>Deactivate</button>
                            : <button onClick={() => handleActivate(c)}   style={s.activateBtn}>Activate</button>
                          }
                          <button onClick={() => handleDelete(c)} style={s.deleteBtn}>Delete</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {companies.length === 0 && !loading && (
                <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#8492A6', padding: '36px 16px' }}>No companies found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Company Modal */}
      {showCreate && (
        <div style={s.overlay} onClick={() => setShowCreate(false)}>
          <div style={{ backgroundColor: '#fff', borderRadius: 20, width: '90%', maxWidth: 520, boxShadow: '0 24px 80px rgba(24,35,80,0.18)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>

            {/* Gradient Header */}
            <div style={{ background: 'linear-gradient(135deg, #182350 0%, #2D3E8C 100%)', padding: '22px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>Create Company</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Fill in the details to create a new company</div>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: '22px 24px 24px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Company Details</div>
              <div style={{ marginBottom: 14 }}>
                <label style={mLbl}>Company Code <span style={{ color: '#EF4444' }}>*</span></label>
                <input required value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} style={mInp} placeholder="e.g. VISR" maxLength={20}
                  onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>Unique code employees use to log in. Cannot be changed easily.</p>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={mLbl}>Company Name <span style={{ color: '#EF4444' }}>*</span></label>
                <input required value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} style={mInp} placeholder="Vistara Realty Pvt. Ltd."
                  onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px', marginBottom: 20 }}>
                <div>
                  <label style={mLbl}>Email (optional)</label>
                  <input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} style={mInp} placeholder="company@example.com"
                    onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
                <div>
                  <label style={mLbl}>Phone (optional)</label>
                  <input value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} style={mInp} placeholder="+91 98765 43210"
                    onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '10px 20px', backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={creating} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #182350 0%, #3D5AFE 100%)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: creating ? 0.7 : 1, minWidth: 140 }}>
                  {creating ? 'Creating…' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page:       { padding: '32px 36px' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle:  { fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 },
  pageSub:    { fontSize: 13, color: '#8492A6' },
  createBtn:  { padding: '10px 20px', background: 'linear-gradient(135deg, #182350 0%, #3D5AFE 100%)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  refreshBtn: { padding: '10px 14px', backgroundColor: '#F0F3FA', color: '#182350', border: '1.5px solid #DDE3F0', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1 },
  info:       { color: '#8492A6', fontSize: 14, padding: '20px 0' },
  errorTxt:   { color: '#EF4444', fontSize: 14, padding: '20px 0' },
  tableWrap:  { overflowX: 'auto', backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 4px 12px rgba(184,196,214,0.18)' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th:         { padding: '14px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textAlign: 'left', letterSpacing: 0.5, borderBottom: '1px solid #EEF1F7', whiteSpace: 'nowrap' },
  tr:         { borderBottom: '1px solid #EEF1F7' },
  td:         { padding: '13px 16px', fontSize: 13, verticalAlign: 'middle' },
  codePill:   { fontFamily: 'monospace', backgroundColor: '#F0F3FA', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#182350' },
  nameText:   { fontWeight: 600, color: '#1A1A2E' },
  muted:      { color: '#8492A6' },
  statusPill: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#fff' },
  rowActions: { display: 'flex', gap: 6 },
  editBtn:    { padding: '5px 12px', backgroundColor: '#E8EEFF', color: '#3D5AFE', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  inlineInput:{ padding: '6px 10px', border: '1.5px solid #E0E6F0', borderRadius: 6, fontSize: 13, width: '100%' },
  saveBtn:    { padding: '5px 14px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  cancelBtn:  { padding: '5px 12px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  deactBtn:   { padding: '5px 10px', backgroundColor: '#FFF7ED', color: '#EA580C', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  activateBtn:{ padding: '5px 10px', backgroundColor: '#F0FDF4', color: '#15803D', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  deleteBtn:  { padding: '5px 10px', backgroundColor: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  overlay:    { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
};
