'use client';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { fetchUsers, updateUser, deleteUser, resetUpdateUser } from '../../../redux/actions/userManagementActions';
import Toast from '../../../components/Toast';

const ALL_MODULES = ['Sales', 'Pre-Sales', 'HR', 'Execution', 'Purchase', 'Land'];
const ROLES       = ['Admin', 'Manager', 'Sales Executive', 'STM', 'Employee'];

export default function UserManagementPage() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { users, loading, error, updating, updateSuccess, updateError } = useSelector((s) => s.userManagement);

  const [search,    setSearch]    = useState('');
  const [editUser,  setEditUser]  = useState(null);
  const [form,      setForm]      = useState({});
  const [toast,     setToast]     = useState({ visible: false, message: '', type: 'success' });
  const opLabel = useRef('updated');

  useEffect(() => { dispatch(fetchUsers()); }, []);

  useEffect(() => {
    if (updateSuccess) {
      showToast(`User ${opLabel.current} successfully.`, 'success');
      setEditUser(null);
      opLabel.current = 'updated';
      dispatch(resetUpdateUser());
    }
    if (updateError) {
      showToast(updateError, 'error');
      dispatch(resetUpdateUser());
    }
  }, [updateSuccess, updateError]);

  const showToast = (message, type = 'success') =>
    setToast({ visible: true, message, type });

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      name:            u.name            || '',
      email:           u.email           || '',
      user_code:       u.user_code       || '',
      password:        '',
      role:            u.role            || 'Employee',
      modules:         u.modules         || [],
      manager_modules: u.manager_modules || [],
      is_active:       u.is_active,
    });
  };

  const handleSave = () => {
    opLabel.current = 'updated';
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    dispatch(updateUser(editUser.id, payload));
  };

  const handleDeactivate = (u) => {
    if (!confirm(`Deactivate ${u.name}? They will no longer be able to log in.`)) return;
    opLabel.current = 'deactivated';
    dispatch(updateUser(u.id, { is_active: false }));
  };

  const handleActivate = (u) => {
    if (!confirm(`Reactivate ${u.name}? They will regain access to the system.`)) return;
    opLabel.current = 'reactivated';
    dispatch(updateUser(u.id, { is_active: true }));
  };

  const handleDelete = (u) => {
    if (!confirm(`Permanently delete ${u.name}? This cannot be undone and all their data will be removed.`)) return;
    dispatch(deleteUser(u.id));
    showToast(`${u.name} permanently deleted.`, 'error');
  };

  const toggleModule = (mod, field) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(mod)
        ? f[field].filter((m) => m !== mod)
        : [...f[field], mod],
    }));
  };

  const filtered = users.filter((u) =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.user_code?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount   = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;

  return (
    <div style={s.page}>
      <Toast {...toast} onHide={() => setToast((t) => ({ ...t, visible: false }))} />

      {/* ── Header ── */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>User Management</h1>
          <div style={s.statRow}>
            <span style={s.statChip}>
              <span style={{ ...s.statDot, backgroundColor: '#22C55E' }} />
              {activeCount} active
            </span>
            {inactiveCount > 0 && (
              <span style={s.statChip}>
                <span style={{ ...s.statDot, backgroundColor: '#9CA3AF' }} />
                {inactiveCount} inactive
              </span>
            )}
          </div>
        </div>
        <button onClick={() => router.push('/admin/users/create')} style={s.createBtn}>
          + Create User
        </button>
      </div>

      {/* ── Search ── */}
      <input
        type="text"
        placeholder="Search by name, code, or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={s.searchInput}
      />

      {loading && <p style={s.info}>Loading users…</p>}
      {error   && <p style={s.errorTxt}>{error}</p>}

      {/* ── Table ── */}
      {!loading && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Code', 'Name', 'Email', 'Role', 'Modules', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  style={{ ...s.tr, backgroundColor: u.is_active ? '#fff' : '#F9FAFB' }}
                >
                  <td style={s.td}>
                    <code style={{ ...s.codePill, opacity: u.is_active ? 1 : 0.55 }}>{u.user_code}</code>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.nameText, color: u.is_active ? '#1A1A2E' : '#9CA3AF' }}>
                      {u.name}
                    </span>
                  </td>
                  <td style={s.td}><span style={s.muted}>{u.email}</span></td>
                  <td style={s.td}><span style={s.rolePill}>{u.role}</span></td>
                  <td style={s.td}><span style={s.muted}>{u.modules?.length || 0}</span></td>
                  <td style={s.td}>
                    <span style={{
                      ...s.statusPill,
                      backgroundColor: u.is_active ? '#DCFCE7' : '#F3F4F6',
                      color:           u.is_active ? '#15803D' : '#6B7280',
                      border: `1px solid ${u.is_active ? '#86EFAC' : '#D1D5DB'}`,
                    }}>
                      {u.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={s.rowActions}>
                      <button onClick={() => openEdit(u)} style={s.editBtn}>Edit</button>
                      {u.is_active
                        ? <button onClick={() => handleDeactivate(u)} style={s.deactBtn}>Deactivate</button>
                        : <button onClick={() => handleActivate(u)}   style={s.activateBtn}>Activate</button>
                      }
                      <button onClick={() => handleDelete(u)} style={s.deleteBtn}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} style={{ ...s.td, textAlign: 'center', color: '#8492A6', padding: '40px 16px' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editUser && (
        <div style={s.overlay} onClick={() => setEditUser(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>

            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>Edit — {editUser.name}</h3>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: editUser.is_active ? '#15803D' : '#6B7280',
                  backgroundColor: editUser.is_active ? '#DCFCE7' : '#F3F4F6',
                  padding: '2px 8px', borderRadius: 10,
                }}>
                  {editUser.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <button onClick={() => setEditUser(null)} style={s.closeBtn}>✕</button>
            </div>

            <div style={s.modalBody}>
              <div style={s.modalGrid}>
                {[
                  { label: 'Full Name',    key: 'name',      type: 'text' },
                  { label: 'Email',        key: 'email',     type: 'email' },
                  { label: 'User Code',    key: 'user_code', type: 'text' },
                  { label: 'New Password (leave blank to keep)', key: 'password', type: 'password' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label style={s.label}>{label}</label>
                    <input
                      type={type}
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      style={s.input}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Role</label>
                <select
                  value={form.role || 'Employee'}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  style={s.input}
                >
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Modules</label>
                <div style={s.checkGrid}>
                  {ALL_MODULES.map((mod) => (
                    <label key={mod} style={s.checkLabel}>
                      <input
                        type="checkbox"
                        checked={(form.modules || []).includes(mod)}
                        onChange={() => toggleModule(mod, 'modules')}
                      />
                      {mod}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Manager Modules</label>
                <div style={s.checkGrid}>
                  {ALL_MODULES.map((mod) => (
                    <label key={mod} style={s.checkLabel}>
                      <input
                        type="checkbox"
                        checked={(form.manager_modules || []).includes(mod)}
                        onChange={() => toggleModule(mod, 'manager_modules')}
                      />
                      {mod}
                    </label>
                  ))}
                </div>
              </div>

              <label style={{ ...s.checkLabel, marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={!!form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                <span style={{ fontWeight: 600 }}>Account Active</span>
              </label>
            </div>

            <div style={s.modalFooter}>
              <button onClick={() => setEditUser(null)} style={s.cancelBtn}>Cancel</button>
              <button onClick={handleSave} disabled={updating} style={{ ...s.saveBtn, opacity: updating ? 0.6 : 1 }}>
                {updating ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page:      { padding: '32px 36px', minHeight: '100vh', backgroundColor: '#F4F6FB' },
  pageHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginBottom: 8 },
  statRow:   { display: 'flex', gap: 10 },
  statChip:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#6B7280', backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 20, padding: '4px 10px' },
  statDot:   { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  createBtn: { padding: '10px 20px', backgroundColor: '#0C1E3C', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  searchInput:{ width: '100%', maxWidth: 380, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E0E6F0', fontSize: 14, marginBottom: 20, display: 'block', backgroundColor: '#fff' },
  info:      { color: '#8492A6', fontSize: 14, padding: '20px 0' },
  errorTxt:  { color: '#EF4444', fontSize: 14, padding: '20px 0' },
  tableWrap: { overflowX: 'auto', backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #EEF1F7' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { padding: '14px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textAlign: 'left', letterSpacing: 0.6, borderBottom: '1px solid #EEF1F7', whiteSpace: 'nowrap', backgroundColor: '#FAFBFD' },
  tr:        { borderBottom: '1px solid #F3F4F6', transition: 'background 0.1s' },
  td:        { padding: '13px 16px', fontSize: 13, verticalAlign: 'middle' },
  codePill:  { fontFamily: 'monospace', backgroundColor: '#F0F3FA', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#0C1E3C' },
  nameText:  { fontWeight: 600 },
  muted:     { color: '#8492A6' },
  rolePill:  { backgroundColor: '#E8EEFF', color: '#3D5AFE', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  statusPill:{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  rowActions:{ display: 'flex', gap: 6, flexWrap: 'nowrap' },
  editBtn:     { padding: '5px 10px', backgroundColor: '#EEF1FF', color: '#3D5AFE', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  deactBtn:    { padding: '5px 10px', backgroundColor: '#FFF7ED', color: '#EA580C', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  activateBtn: { padding: '5px 10px', backgroundColor: '#F0FDF4', color: '#15803D', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  deleteBtn:   { padding: '5px 10px', backgroundColor: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },

  overlay:     { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal:       { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 580, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #EEF1F7' },
  modalTitle:  { fontSize: 18, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 },
  closeBtn:    { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8492A6', padding: '4px 8px', borderRadius: 8 },
  modalBody:   { padding: '24px' },
  modalGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginBottom: 16 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid #EEF1F7' },
  label:     { display: 'block', fontSize: 13, fontWeight: 600, color: '#8492A6', marginBottom: 6 },
  input:     { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 14, boxSizing: 'border-box' },
  checkGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px 16px' },
  checkLabel:{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#1A1A2E', cursor: 'pointer' },
  cancelBtn: { padding: '10px 20px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  saveBtn:   { padding: '10px 24px', backgroundColor: '#0C1E3C', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
};
