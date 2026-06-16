'use client';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCompanies, updateCompany, resetUpdateCompany } from '../../../redux/actions/companiesActions';
import Toast from '../../../components/Toast';
import { COLORS } from '../../../constants/theme';

export default function CompanyManagementPage() {
  const dispatch = useDispatch();
  const { companies, loading, error, updating, updateSuccess, updateError } = useSelector((s) => s.companies);

  const [editId, setEditId] = useState(null);
  const [form,   setForm]   = useState({ code: '', name: '' });
  const [toast,  setToast]  = useState({ visible: false, message: '', type: 'success' });

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

  const showToast = (message, type = 'success') =>
    setToast({ visible: true, message, type });

  const openEdit = (c) => {
    setEditId(c.id);
    setForm({ code: c.code, name: c.name });
  };

  const handleSave = () => dispatch(updateCompany(editId, form));

  return (
    <div style={s.page}>
      <Toast {...toast} onHide={() => setToast((t) => ({ ...t, visible: false }))} />

      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Company Management</h1>
        <p style={s.pageSub}>{companies.length} compan{companies.length !== 1 ? 'ies' : 'y'}</p>
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
                          value={form.code}
                          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                          style={s.inlineInput}
                        />
                      </td>
                      <td style={s.td}>
                        <input
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
    </div>
  );
}

const s = {
  page:       { padding: '32px 36px' },
  pageHeader: { marginBottom: 24 },
  pageTitle:  { fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 },
  pageSub:    { fontSize: 13, color: '#8492A6' },
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
  statusPill: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#fff' },
  rowActions: { display: 'flex', gap: 8 },
  editBtn:    { padding: '5px 12px', backgroundColor: '#E8EEFF', color: '#3D5AFE', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  inlineInput:{ padding: '6px 10px', border: '1.5px solid #E0E6F0', borderRadius: 6, fontSize: 13, width: '100%' },
  saveBtn:    { padding: '5px 14px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  cancelBtn:  { padding: '5px 12px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
};
