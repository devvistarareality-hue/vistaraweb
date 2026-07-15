'use client';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { fetchUsers, updateUser, deleteUser, resetUpdateUser } from '../../../redux/actions/userManagementActions';
import { fetchDesignations } from '../../../redux/actions/designationActions';
import Toast from '../../../components/Toast';

const ALL_MODULES = ['Sales', 'HR', 'Accounts & Finance', 'Execution', 'Purchase', 'Land'];
const ROLES       = ['Admin', 'Manager', 'Employee'];

const mInp = { width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: '#FAFAFA' };
const mLbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 5 };
const mSec = { fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 };

function ConfirmModal({ open, title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={{ backgroundColor: '#fff', borderRadius: 20, width: 420, maxWidth: '92vw', boxShadow: '0 24px 80px rgba(24,35,80,0.18)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: 'linear-gradient(135deg, #182350 0%, #2D3E8C 100%)', padding: '20px 24px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{title}</div>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '0 24px 20px' }}>
          <button onClick={onCancel} style={{ padding: '10px 20px', backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '10px 24px', backgroundColor: confirmColor || '#182350', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { users, loading, error, updating, updateSuccess, updateError } = useSelector((s) => s.userManagement);
  const { designations } = useSelector((s) => s.designations);
  const companyId = useSelector((s) => s.adminFilter?.companyId);

  const [search,            setSearch]            = useState('');
  const [editUser,          setEditUser]          = useState(null);
  const [form,              setForm]              = useState({});
  const [toast,             setToast]             = useState({ visible: false, message: '', type: 'success' });
  const [dialog,            setDialog]            = useState({ open: false });
  const [editManagerSearch, setEditManagerSearch] = useState('');
  const opLabel = useRef('updated');

  useEffect(() => {
    dispatch(fetchUsers(true, companyId));
    dispatch(fetchDesignations(true, companyId));
  }, [companyId]);

  const handleRefresh = () => { dispatch(fetchUsers(true, companyId)); dispatch(fetchDesignations(true, companyId)); };

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
    setEditManagerSearch('');
    setForm({
      name:                 u.name            || '',
      email:                u.email           || '',
      phone:                u.phone           || '',
      user_code:            u.user_code       || '',
      password:             '',
      role:                 u.role            || 'Employee',
      designation:          u.designation     || '',
      modules:              u.modules         || [],
      manager_modules:      u.manager_modules || [],
      is_active:            u.is_active,
      reporting_manager_id: u.reporting_manager?.id ?? null,
    });
  };

  const handleSave = () => {
    opLabel.current = 'updated';
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    dispatch(updateUser(editUser.id, payload));
  };

  const closeDialog = () => setDialog({ open: false });

  const handleDeactivate = (u) => {
    setDialog({
      open:         true,
      title:        'Deactivate User',
      message:      `Deactivate ${u.name}? They will no longer be able to log in.`,
      confirmLabel: 'Deactivate',
      confirmColor: '#EA580C',
      onConfirm:    () => {
        opLabel.current = 'deactivated';
        dispatch(updateUser(u.id, { is_active: false }));
        closeDialog();
      },
    });
  };

  const handleActivate = (u) => {
    setDialog({
      open:         true,
      title:        'Reactivate User',
      message:      `Reactivate ${u.name}? They will regain access to the system.`,
      confirmLabel: 'Activate',
      confirmColor: '#15803D',
      onConfirm:    () => {
        opLabel.current = 'reactivated';
        dispatch(updateUser(u.id, { is_active: true }));
        closeDialog();
      },
    });
  };

  const handleDelete = (u) => {
    setDialog({
      open:         true,
      title:        'Delete User',
      message:      `Permanently delete ${u.name}? This cannot be undone and all their data will be removed.`,
      confirmLabel: 'Delete',
      confirmColor: '#DC2626',
      onConfirm:    () => {
        dispatch(deleteUser(u.id));
        showToast(`${u.name} permanently deleted.`, 'error');
        closeDialog();
      },
    });
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
      <ConfirmModal {...dialog} onCancel={closeDialog} />

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
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleRefresh} disabled={loading} title="Refresh" style={{ ...s.refreshBtn, opacity: loading ? 0.5 : 1 }}>↻</button>
          <button onClick={() => router.push('/admin/org-chart')} style={{ ...s.createBtn, background: '#fff', color: '#3D5AFE', border: '1.5px solid #C7D2FE' }}>🗂 Org Chart</button>
          <button onClick={() => router.push('/admin/users/create')} style={s.createBtn}>+ Create User</button>
        </div>
      </div>

      {/* ── Search ── */}
      <input type="text" placeholder="Search by name, code, or email…" value={search} onChange={(e) => setSearch(e.target.value)} style={s.searchInput} />

      {loading && users.length === 0 && <p style={s.info}>Loading users…</p>}
      {error   && <p style={s.errorTxt}>{error}</p>}

      {/* ── Table ── */}
      {(users.length > 0 || !loading) && (
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
                <tr key={u.id} style={{ ...s.tr, backgroundColor: u.is_active ? '#fff' : '#F9FAFB' }}>
                  <td style={s.td}><code style={{ ...s.codePill, opacity: u.is_active ? 1 : 0.55 }}>{u.user_code}</code></td>
                  <td style={s.td}><span style={{ ...s.nameText, color: u.is_active ? '#1A1A2E' : '#9CA3AF' }}>{u.name}</span></td>
                  <td style={s.td}><span style={s.muted}>{u.email}</span></td>
                  <td style={s.td}><span style={s.rolePill}>{u.role}</span></td>
                  <td style={s.td}><span style={s.muted}>{u.modules?.length || 0}</span></td>
                  <td style={s.td}>
                    <span style={{ ...s.statusPill, backgroundColor: u.is_active ? '#DCFCE7' : '#F3F4F6', color: u.is_active ? '#15803D' : '#6B7280', border: `1px solid ${u.is_active ? '#86EFAC' : '#D1D5DB'}` }}>
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
                <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: '#8492A6', padding: '40px 16px' }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editUser && (
        <div style={s.overlay} onClick={() => setEditUser(null)}>
          <div style={{ backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(24,35,80,0.18)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>

            {/* Gradient Header */}
            <div style={{ background: 'linear-gradient(135deg, #182350 0%, #2D3E8C 100%)', padding: '22px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>Edit User</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{editUser.name} · {editUser.user_code}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: editUser.is_active ? '#86EFAC' : '#D1D5DB', backgroundColor: 'rgba(255,255,255,0.12)', padding: '3px 10px', borderRadius: 10 }}>
                  {editUser.is_active ? '● Active' : '○ Inactive'}
                </span>
                <button onClick={() => setEditUser(null)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

              <div style={mSec}>Personal Info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 18 }}>
                {[
                  { label: 'Full Name', key: 'name', type: 'text' },
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Phone Number', key: 'phone', type: 'tel' },
                  { label: 'User Code', key: 'user_code', type: 'text' },
                  { label: 'New Password (blank = keep)', key: 'password', type: 'password' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label style={mLbl}>{label}</label>
                    <input type={type} value={form[key] || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={mInp}
                      onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                  </div>
                ))}
              </div>

              <div style={mSec}>Role & Designation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 18 }}>
                <div>
                  <label style={mLbl}>Role</label>
                  <select value={form.role || 'Employee'} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={{ ...mInp, cursor: 'pointer' }}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={mLbl}>Designation</label>
                  {(() => {
                    const avail = designations.filter((d) => (form.modules || []).includes(d.module));
                    return (
                      <select value={form.designation || ''} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} style={{ ...mInp, cursor: 'pointer' }} disabled={avail.length === 0}>
                        <option value="">{avail.length === 0 ? 'Select modules first' : '— Select —'}</option>
                        {avail.map((d) => <option key={d.id} value={d.name}>{d.name} ({d.module})</option>)}
                      </select>
                    );
                  })()}
                </div>
              </div>

              <div style={mSec}>Reporting Manager</div>
              <div style={{ marginBottom: 18 }}>
                <input type="text" placeholder="Search by name or user code…" value={editManagerSearch} onChange={(e) => setEditManagerSearch(e.target.value)}
                  style={{ ...mInp, marginBottom: 8 }} onFocus={e => e.target.style.borderColor='#3D5AFE'} onBlur={e => e.target.style.borderColor='#E5E7EB'} />
                <select value={form.reporting_manager_id || ''} onChange={(e) => setForm((f) => ({ ...f, reporting_manager_id: e.target.value ? Number(e.target.value) : null }))} style={{ ...mInp, cursor: 'pointer' }}>
                  <option value="">— None —</option>
                  {users.filter((u) => {
                    if (u.id === editUser?.id) return false;
                    if (u.company_code !== editUser?.company_code) return false;
                    if (!editManagerSearch) return true;
                    const q = editManagerSearch.toLowerCase();
                    return u.name?.toLowerCase().includes(q) || u.user_code?.toLowerCase().includes(q);
                  }).map((u) => <option key={u.id} value={u.id}>{u.name}  ·  {u.user_code}  ·  {u.role}{u.designation ? `  ·  ${u.designation}` : ''}</option>)}
                </select>
              </div>

              <div style={mSec}>Modules</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginBottom: 18 }}>
                {ALL_MODULES.map((mod) => (
                  <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#1A1A2E', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${(form.modules||[]).includes(mod) ? '#3D5AFE' : '#E5E7EB'}`, backgroundColor: (form.modules||[]).includes(mod) ? '#F0F3FF' : '#FAFAFA' }}>
                    <input type="checkbox" checked={(form.modules || []).includes(mod)} onChange={() => toggleModule(mod, 'modules')} style={{ accentColor: '#3D5AFE' }} />
                    {mod}
                  </label>
                ))}
              </div>

              <div style={mSec}>Manager Modules</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginBottom: 18 }}>
                {ALL_MODULES.map((mod) => (
                  <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#1A1A2E', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${(form.manager_modules||[]).includes(mod) ? '#3D5AFE' : '#E5E7EB'}`, backgroundColor: (form.manager_modules||[]).includes(mod) ? '#F0F3FF' : '#FAFAFA' }}>
                    <input type="checkbox" checked={(form.manager_modules || []).includes(mod)} onChange={() => toggleModule(mod, 'manager_modules')} style={{ accentColor: '#3D5AFE' }} />
                    {mod}
                  </label>
                ))}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1A2E', cursor: 'pointer', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${form.is_active ? '#BBF7D0' : '#E5E7EB'}`, backgroundColor: form.is_active ? '#F0FFF4' : '#FAFAFA', marginBottom: 4 }}>
                <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} style={{ accentColor: '#2E7D32' }} />
                <span style={{ fontWeight: 600, color: form.is_active ? '#2E7D32' : '#6B7280' }}>Account Active</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid #F0F3FA' }}>
              <button onClick={() => setEditUser(null)} style={{ padding: '10px 20px', backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={updating} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #182350 0%, #3D5AFE 100%)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: updating ? 0.7 : 1, minWidth: 120 }}>
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
  page:      { padding: '32px 36px', minHeight: '100vh', backgroundColor: '#DFE4EE' },
  pageHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: 800, color: '#1A1A2E', marginBottom: 8 },
  statRow:   { display: 'flex', gap: 10 },
  statChip:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#6B7280', backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 20, padding: '4px 10px' },
  statDot:   { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  createBtn:  { padding: '10px 20px', background: 'linear-gradient(135deg, #182350 0%, #3D5AFE 100%)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  refreshBtn: { padding: '10px 14px', backgroundColor: '#F0F3FA', color: '#0C1E3C', border: '1.5px solid #DDE3F0', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1 },
  searchInput:{ width: '100%', maxWidth: 380, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E0E6F0', fontSize: 14, marginBottom: 20, display: 'block', backgroundColor: '#fff' },
  info:      { color: '#8492A6', fontSize: 14, padding: '20px 0' },
  errorTxt:  { color: '#EF4444', fontSize: 14, padding: '20px 0' },
  tableWrap: { overflowX: 'auto', backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #EEF1F7' },
  table:     { width: '100%', borderCollapse: 'collapse', minWidth: 800 },
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
};
