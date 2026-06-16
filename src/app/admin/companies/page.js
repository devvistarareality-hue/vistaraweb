'use client';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchCompanies, updateCompany, resetUpdateCompany,
  createCompany, resetCreateCompany,
} from '../../../redux/actions/companiesActions';
import Toast from '../../../components/Toast';
import { COLORS } from '../../../constants/theme';

const EMPTY_FORM = { code: '', name: '', email: '', phone: '' };

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

  useEffect(() => { dispatch(fetchCompanies()); }, []);

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

  const showToast = (message, type = 'success') =>
    setToast({ visible: true, message, type });

  const openEdit = (c) => {
    setEditId(c.id);
    setEditForm({ code: c.code, name: c.name });
  };

  const handleSave   = () => dispatch(updateCompany(editId, editForm));
  const handleCreate = (e) => {
    e.preventDefault();
    dispatch(createCompany({ ...createForm, code: createForm.code.toUpperCase() }));
  };

  return (
    <div style={s.page}>
      <Toast {...toast} onHide={() => setToast((t) => ({ ...t, visible: false }))} />

      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Company Management</h1>
          <p style={s.pageSub}>{companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={s.createBtn}>
          + Create Company
        </button>
      </div>

      {loading && <p style={s.info}>Loading…</p>}
      {error   && <p style={s.errorTxt}>{error}</p>}

      {!loading && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Code', 'Name', 'Email', 'Phone', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} style={s.tr}>
                  {editId === c.id ? (
                    <>
                      <td style={s.td}>
                        <input
                          value={editForm.code}
                          onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                          style={s.inlineInput}
                        />
                      </td>
                      <td style={s.td}>
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          style={s.inlineInput}
                        />
                      </td>
                      <td style={s.td}><span style={s.muted}>{c.email}</span></td>
                      <td style={s.td}><span style={s.muted}>{c.phone}</span></td>
                      <td style={s.td}>
                        <span style={{ ...s.statusPill, backgroundColor: c.is_active ? COLORS.success : COLORS.error }}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <div style={s.rowActions}>
                          <button
                            onClick={handleSave}
                            disabled={updating}
                            style={{ ...s.saveBtn, opacity: updating ? 0.6 : 1 }}
                          >
                            {updating ? 'Saving…' : 'Save'}
                          </button>
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
                      <td style={s.td}>
                        <span style={{ ...s.statusPill, backgroundColor: c.is_active ? COLORS.success : COLORS.error }}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <button onClick={() => openEdit(c)} style={s.editBtn}>Edit</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {companies.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ ...s.td, textAlign: 'center', color: '#8492A6', padding: '36px 16px' }}>
                    No companies found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Company Modal */}
      {showCreate && (
        <div style={s.modalOverlay} onClick={() => setShowCreate(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Create Company</h2>
              <button onClick={() => setShowCreate(false)} style={s.closeBtn}>✕</button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={s.fieldGroup}>
                <label style={s.label}>Company Code <span style={s.req}>*</span></label>
                <input
                  required
                  value={createForm.code}
                  onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  style={s.input}
                  placeholder="e.g. VISR"
                  maxLength={20}
                />
                <p style={s.hint}>Unique code employees use to log in. Cannot be changed easily.</p>
              </div>

              <div style={s.fieldGroup}>
                <label style={s.label}>Company Name <span style={s.req}>*</span></label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  style={s.input}
                  placeholder="Vistara Realty Pvt. Ltd."
                />
              </div>

              <div style={s.grid2}>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Email (optional)</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    style={s.input}
                    placeholder="company@example.com"
                  />
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Phone (optional)</label>
                  <input
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    style={s.input}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div style={s.modalFooter}>
                <button type="button" onClick={() => setShowCreate(false)} style={s.cancelBtn}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{ ...s.saveBtn, padding: '10px 28px', opacity: creating ? 0.6 : 1 }}
                >
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
  createBtn:  { padding: '10px 20px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  info:       { color: '#8492A6', fontSize: 14, padding: '20px 0' },
  errorTxt:   { color: '#EF4444', fontSize: 14, padding: '20px 0' },
  tableWrap:  { overflowX: 'auto', backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 4px 12px rgba(184,196,214,0.18)' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding:       '14px 16px',
    fontSize:      11,
    fontWeight:    700,
    color:         '#8492A6',
    textAlign:     'left',
    letterSpacing: 0.5,
    borderBottom:  '1px solid #EEF1F7',
    whiteSpace:    'nowrap',
  },
  tr:       { borderBottom: '1px solid #EEF1F7' },
  td:       { padding: '13px 16px', fontSize: 13, verticalAlign: 'middle' },
  codePill: { fontFamily: 'monospace', backgroundColor: '#F0F3FA', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#182350' },
  nameText: { fontWeight: 600, color: '#1A1A2E' },
  muted:    { color: '#8492A6' },
  statusPill:  { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#fff' },
  rowActions:  { display: 'flex', gap: 8 },
  editBtn:     { padding: '5px 12px', backgroundColor: '#E8EEFF', color: '#3D5AFE', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  inlineInput: { padding: '6px 10px', border: '1.5px solid #E0E6F0', borderRadius: 6, fontSize: 13, width: '100%' },
  saveBtn:     { padding: '5px 14px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  cancelBtn:   { padding: '5px 12px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },

  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { backgroundColor: '#fff', borderRadius: 20, padding: '32px', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle:   { fontSize: 20, fontWeight: 800, color: '#1A1A2E' },
  closeBtn:     { background: 'none', border: 'none', fontSize: 18, color: '#8492A6', cursor: 'pointer', lineHeight: 1 },
  modalFooter:  { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 28 },
  fieldGroup:   { marginBottom: 18 },
  label:        { display: 'block', fontSize: 13, fontWeight: 600, color: '#8492A6', marginBottom: 6 },
  req:          { color: '#EF4444' },
  input:        { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 14, boxSizing: 'border-box' },
  hint:         { fontSize: 11, color: '#8492A6', marginTop: 5 },
  grid2:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' },
};
