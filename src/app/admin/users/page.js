'use client';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { fetchUsers, updateUser, deleteUser, resetUpdateUser } from '../../../redux/actions/userManagementActions';
import { fetchDesignations } from '../../../redux/actions/designationActions';
import Toast from '../../../components/Toast';
import { ALL_MODULES, isSuperAdmin } from '../../../lib/moduleAccess';
import { startImpersonation } from '../../../lib/impersonate';
import { isManagerRole } from '../../../lib/moduleAccess';
import PasswordInput from '../../../components/PasswordInput';
import { needsReportingManager } from '../../../lib/orgTree';

import Icon from '../../../components/Icon';
// Seniority order, most senior first. Everything down to Manager carries manager
// authority (see MANAGER_ROLES in the backend). Kiosk is not a rank -- it's the
// unattended self-booking account -- so it sits apart at the end.
const ROLES       = ['Director', 'General Manager', 'Manager', 'Employee', 'Intern', 'Kiosk'];

const mInp = { width: '100%', height: 40, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', backgroundColor: 'var(--surface-2)' };
const mLbl = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 5 };
const mSec = { fontSize: 10, fontWeight: 700, color: 'var(--faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 };

function ConfirmModal({ open, title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="nx-modal-backdrop" style={s.overlay} onClick={onCancel}>
      <div className="nx-modal" style={{ backgroundColor: 'var(--surface)', borderRadius: 20, width: 420, maxWidth: '92vw', boxShadow: '0 24px 80px rgba(var(--ink-rgb),0.18)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div className="nx-modal-head" style={{ background: 'var(--hero)', padding: '20px 24px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{title}</div>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" /></button>
        </div>
        <div style={{ padding: '20px 24px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '0 24px 20px' }}>
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={onCancel} style={{ padding: '10px 20px', backgroundColor: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={onConfirm} style={{ padding: '10px 24px', backgroundColor: confirmColor || 'var(--strong)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{confirmLabel}</button>
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
  const me = useSelector((st) => st.auth?.user);
  const canViewAs = isSuperAdmin(me);

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
      admin_modules:        u.admin_modules   || [],
      can_export_bookings:  !!u.can_export_bookings,
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
      confirmColor: 'var(--warning-solid)',
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
      confirmColor: 'var(--success-solid)',
      onConfirm:    () => {
        opLabel.current = 'reactivated';
        dispatch(updateUser(u.id, { is_active: true }));
        closeDialog();
      },
    });
  };

  // Open the app as this person, to see exactly what they see. Confirmed first
  // because it is a real session in their account, not a read-only preview.
  const handleViewAs = (u) => {
    setDialog({
      open:         true,
      title:        'View as User',
      message:      `Open the app as ${u.name}? You will see what they see, and anything you do will be recorded against them. Use Exit in the banner to come back.`,
      confirmLabel: 'View as user',
      confirmColor: 'var(--warning-solid)',
      onConfirm:    async () => {
        closeDialog();
        try {
          await startImpersonation(u.id);
          window.location.replace(window.location.origin + '/');
        } catch (e) {
          showToast(e.message, 'error');
        }
      },
    });
  };

  const handleDelete = (u) => {
    setDialog({
      open:         true,
      title:        'Delete User',
      message:      `Permanently delete ${u.name}? This cannot be undone and all their data will be removed.`,
      confirmLabel: 'Delete',
      confirmColor: 'var(--danger-solid)',
      onConfirm:    () => {
        dispatch(deleteUser(u.id));
        showToast(`${u.name} permanently deleted.`, 'error');
        closeDialog();
      },
    });
  };

  const toggleModule = (mod, field) => {
    setForm((f) => {
      const next   = f[field].includes(mod) ? f[field].filter((m) => m !== mod) : [...f[field], mod];
      const updated = { ...f, [field]: next };
      // Managers get Manager Modules auto-mirrored from Modules — any Modules
      // change overwrites Manager Modules to match.
      if (field === 'modules' && isManagerRole(f)) updated.manager_modules = next;
      return updated;
    });
  };

  const filtered = users.filter((u) =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.user_code?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => String(a.user_code || '').localeCompare(String(b.user_code || ''), undefined, { numeric: true }));

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
            <span className="nx-badge" style={s.statChip}>
              <span style={{ ...s.statDot, backgroundColor: 'var(--success-solid)' }} />
              {activeCount} active
            </span>
            {inactiveCount > 0 && (
              <span className="nx-badge" style={s.statChip}>
                <span style={{ ...s.statDot, backgroundColor: 'var(--faint-solid)' }} />
                {inactiveCount} inactive
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="nx-btn nx-btn-lg nx-btn-secondary" onClick={handleRefresh} disabled={loading} title="Refresh" style={{ ...s.refreshBtn, opacity: loading ? 0.5 : 1 }}>↻</button>
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => router.push('/admin/org-chart')} style={{ ...s.createBtn, background: 'var(--surface)', color: 'var(--accent)', border: '1.5px solid var(--blue-2)' }}><Icon name="folder" /> Org Chart</button>
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => router.push('/admin/users/create')} style={s.createBtn}>+ Create User</button>
        </div>
      </div>

      {/* ── Search ── */}
      <input className="nx-input" type="text" placeholder="Search by name, code, or email…" value={search} onChange={(e) => setSearch(e.target.value)} style={s.searchInput} />

      {loading && users.length === 0 && <p style={s.info}>Loading users…</p>}
      {error   && <p style={s.errorTxt}>{error}</p>}

      {/* ── Table ── */}
      {(users.length > 0 || !loading) && (
        <div className="nx-card" style={s.tableWrap}>
          <table className="nx-table" style={s.table}>
            <thead>
              <tr>
                {['Code', 'Name', 'Email', 'Role', 'Modules', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ ...s.tr, backgroundColor: u.is_active ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <td style={s.td}><code style={{ ...s.codePill, opacity: u.is_active ? 1 : 0.55 }}>{u.user_code}</code></td>
                  <td style={s.td}><span style={{ ...s.nameText, color: u.is_active ? 'var(--text)' : 'var(--faint)' }}>{u.name}</span></td>
                  <td style={s.td}><span style={s.muted}>{u.email}</span></td>
                  <td style={s.td}><span className="nx-badge" style={s.rolePill}>{u.role}</span></td>
                  <td style={s.td}><span style={s.muted}>{u.modules?.length || 0}</span></td>
                  <td style={s.td}>
                    <span className={`nx-status ${u.is_active ? 'ok' : 'off'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={s.rowActions}>
                      <button className="nx-btn nx-btn-sm nx-btn-soft" onClick={() => openEdit(u)} style={s.editBtn}>Edit</button>
                      {canViewAs && u.is_active && !u.is_staff && u.id !== me?.id && (
                        <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => handleViewAs(u)} style={s.viewAsBtn}>View as</button>
                      )}
                      {u.is_active
                        ? <button onClick={() => handleDeactivate(u)} style={s.deactBtn}>Deactivate</button>
                        : <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => handleActivate(u)}   style={s.activateBtn}>Activate</button>
                      }
                      <button className="nx-btn nx-btn-sm nx-btn-danger-soft" onClick={() => handleDelete(u)} style={s.deleteBtn}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: 'var(--muted)', padding: '40px 16px' }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editUser && (
        <div className="nx-modal-backdrop" style={s.overlay} onClick={() => setEditUser(null)}>
          <div className="nx-modal" style={{ backgroundColor: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(var(--ink-rgb),0.18)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>

            {/* Gradient Header */}
            <div className="nx-modal-head" style={{ background: 'var(--hero)', padding: '22px 24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>Edit User</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{editUser.name} · {editUser.user_code}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`nx-hero-chip ${editUser.is_active ? 'on' : 'off'}`}>
                  {editUser.is_active ? '● Active' : '○ Inactive'}
                </span>
                <button onClick={() => setEditUser(null)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" /></button>
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
                    {/* The password box gets a Show toggle — it reveals what is being
                        typed, not the account's current password, which is stored
                        one-way hashed and cannot be read back by anyone. */}
                    {type === 'password' ? (
                      <>
                        <PasswordInput value={form[key] || ''} style={mInp}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                        {/* Said here rather than left to be discovered: hitting Show on
                            an empty box and getting nothing back reads as a broken
                            toggle. "Hashed, not encrypted" is the important word —
                            calling it encrypted invites "so decrypt it", and there is
                            nothing to decrypt: the original text was never stored. */}
                        <p style={{ fontSize: 11, color: 'var(--muted)', margin: '5px 2px 0', lineHeight: 1.45 }}>
                          The current password can&apos;t be shown to anyone. It isn&apos;t stored — only a
                          one-way hash of it is, which can check a password but can&apos;t be turned back
                          into one. Type a new one here to replace it, then tell them what it is.
                        </p>
                      </>
                    ) : (
                      <input className="nx-input" type={type} value={form[key] || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={mInp}
                        onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
                    )}
                  </div>
                ))}
              </div>

              <div style={mSec}>Role & Designation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 18 }}>
                <div>
                  <label style={mLbl}>Role</label>
                  <select className="nx-input" value={form.role || 'Employee'} onChange={(e) => {
                    const role = e.target.value;
                    setForm((f) => ({ ...f, role, manager_modules: isManagerRole({ role }) ? (f.modules || []) : f.manager_modules }));
                  }} style={{ ...mInp, cursor: 'pointer' }}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={mLbl}>Designation</label>
                  {(() => {
                    const avail = designations.filter((d) => (form.modules || []).includes(d.module));
                    return (
                      <select className="nx-input" value={form.designation || ''} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} style={{ ...mInp, cursor: 'pointer' }} disabled={avail.length === 0}>
                        <option value="">{avail.length === 0 ? 'Select modules first' : '— Select —'}</option>
                        {avail.map((d) => <option key={d.id} value={d.name}>{d.name} ({d.module})</option>)}
                      </select>
                    );
                  })()}
                </div>
              </div>

              <div style={mSec}>Reporting Manager{needsReportingManager(form.role) ? ' *' : ''}</div>
              <div style={{ marginBottom: 18 }}>
                <input className="nx-input" type="text" placeholder="Search by name or user code…" value={editManagerSearch} onChange={(e) => setEditManagerSearch(e.target.value)}
                  style={{ ...mInp, marginBottom: 8 }} onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--border)'} />
                <select className="nx-input" value={form.reporting_manager_id || ''} onChange={(e) => setForm((f) => ({ ...f, reporting_manager_id: e.target.value ? Number(e.target.value) : null }))} style={{ ...mInp, cursor: 'pointer' }}>
                  <option value="">— None —</option>
                  {users.filter((u) => {
                    if (u.id === editUser?.id) return false;
                    if (u.company_code !== editUser?.company_code) return false;
                    if (!editManagerSearch) return true;
                    const q = editManagerSearch.toLowerCase();
                    return u.name?.toLowerCase().includes(q) || u.user_code?.toLowerCase().includes(q);
                  }).map((u) => <option key={u.id} value={u.id}>{u.name}  ·  {u.user_code}  ·  {u.role}{u.designation ? `  ·  ${u.designation}` : ''}</option>)}
                </select>
                {/* Said before saving rather than after: the API refuses this, and an
                    error on submit teaches the rule one failed save at a time. */}
                {needsReportingManager(form.role) && !form.reporting_manager_id && (
                  <p style={{ fontSize: 11, color: 'var(--warning)', margin: '6px 2px 0', lineHeight: 1.45 }}>
                    Required at this role. Visibility runs on the reporting tree, so with no
                    manager this person is invisible to every manager — their leads and bookings
                    appear in nobody&apos;s list.
                  </p>
                )}
              </div>

              <div style={mSec}>Modules</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginBottom: 18 }}>
                {ALL_MODULES.map((mod) => (
                  <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text)', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${(form.modules||[]).includes(mod) ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: (form.modules||[]).includes(mod) ? 'var(--accent-softer)' : 'var(--surface-2)' }}>
                    <input type="checkbox" checked={(form.modules || []).includes(mod)} onChange={() => toggleModule(mod, 'modules')} style={{ accentColor: 'var(--accent)' }} />
                    {mod}
                  </label>
                ))}
              </div>

              <div style={mSec}>
                Manager Modules
                {isManagerRole(form) && <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--faint)', letterSpacing: 0 }}> — auto-matches Modules</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginBottom: 18 }}>
                {ALL_MODULES.map((mod) => (
                  <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text)', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${(form.manager_modules||[]).includes(mod) ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: (form.manager_modules||[]).includes(mod) ? 'var(--accent-softer)' : 'var(--surface-2)' }}>
                    <input type="checkbox" checked={(form.manager_modules || []).includes(mod)} onChange={() => toggleModule(mod, 'manager_modules')} style={{ accentColor: 'var(--accent)' }} />
                    {mod}
                  </label>
                ))}
              </div>

              {isManagerRole(form) && (
                <>
                  <div style={mSec}>Admin Modules</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginBottom: 18 }}>
                    {ALL_MODULES.map((mod) => (
                      <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text)', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${(form.admin_modules||[]).includes(mod) ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: (form.admin_modules||[]).includes(mod) ? 'var(--accent-softer)' : 'var(--surface-2)' }}>
                        <input type="checkbox" checked={(form.admin_modules || []).includes(mod)} onChange={() => toggleModule(mod, 'admin_modules')} style={{ accentColor: 'var(--accent)' }} />
                        {mod}
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div style={mSec}>Data Access</div>
              {/* The Sales module's booking export: every approved deal in the company,
                  Sales and CP together, with all its commercial figures. Deliberately
                  separate from module access — working your own bookings and downloading
                  everyone's are different things. */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer', padding: '10px 14px', borderRadius: 14, border: `1.5px solid ${form.can_export_bookings ? 'var(--success-2)' : 'var(--border)'}`, backgroundColor: form.can_export_bookings ? 'var(--success-soft)' : 'var(--surface-2)', marginBottom: 14 }}>
                <input type="checkbox" checked={!!form.can_export_bookings} onChange={(e) => setForm((f) => ({ ...f, can_export_bookings: e.target.checked }))} style={{ accentColor: 'var(--success)' }} />
                <span style={{ fontWeight: 600, color: form.can_export_bookings ? 'var(--success)' : 'var(--text-3)' }}>Download booking Excel</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>— approved bookings, Sales &amp; CP, with totals</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer', padding: '10px 14px', borderRadius: 14, border: `1.5px solid ${form.is_active ? 'var(--success-2)' : 'var(--border)'}`, backgroundColor: form.is_active ? 'var(--success-soft)' : 'var(--surface-2)', marginBottom: 4 }}>
                <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} style={{ accentColor: 'var(--success)' }} />
                <span style={{ fontWeight: 600, color: form.is_active ? 'var(--success)' : 'var(--text-3)' }}>Account Active</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--surface-2)' }}>
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setEditUser(null)} style={{ padding: '10px 20px', backgroundColor: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button className="nx-btn nx-btn-md nx-btn-primary" onClick={handleSave} disabled={updating} style={{ padding: '10px 24px', background: 'var(--strong)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: updating ? 0.7 : 1, minWidth: 120 }}>
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
  page:      { padding: '32px 36px', minHeight: '100vh', backgroundColor: 'transparent' },
  pageHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 },
  statRow:   { display: 'flex', gap: 10 },
  statChip:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-3)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 10px' },
  statDot:   { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  createBtn:  { padding: '10px 20px', background: 'var(--strong)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  refreshBtn: { padding: '10px 14px', backgroundColor: 'var(--surface-2)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1 },
  searchInput:{ width: '100%', maxWidth: 380, padding: '10px 14px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 14, marginBottom: 20, display: 'block', backgroundColor: 'var(--surface)' },
  info:      { color: 'var(--muted)', fontSize: 14, padding: '20px 0' },
  errorTxt:  { color: 'var(--danger)', fontSize: 14, padding: '20px 0' },
  tableWrap: { overflowX: 'auto', backgroundColor: 'var(--surface)', borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid var(--surface-3)' },
  table:     { width: '100%', borderCollapse: 'collapse', minWidth: 800 },
  th:        { padding: '14px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textAlign: 'left', letterSpacing: 0.6, borderBottom: '1px solid var(--surface-3)', whiteSpace: 'nowrap', backgroundColor: 'var(--surface-2)' },
  tr:        { borderBottom: '1px solid var(--surface-2)', transition: 'background 0.1s' },
  td:        { padding: '13px 16px', fontSize: 13, verticalAlign: 'middle' },
  codePill:  { fontFamily: 'monospace', backgroundColor: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)' },
  nameText:  { fontWeight: 600 },
  muted:     { color: 'var(--muted)' },
  rolePill:  { backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  rowActions:{ display: 'flex', gap: 6, flexWrap: 'nowrap' },
  viewAsBtn: { padding: '6px 12px', borderRadius: 10, border: '1.5px solid var(--warning-2)', background: 'var(--surface)', color: 'var(--warning-2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  editBtn:     { padding: '5px 10px', backgroundColor: 'var(--accent-softer)', color: 'var(--accent)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  deactBtn:    { padding: '5px 10px', backgroundColor: 'var(--warning-soft)', color: 'var(--warning-2)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  activateBtn: { padding: '5px 10px', backgroundColor: 'var(--surface-2)', color: 'var(--success)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  deleteBtn:   { padding: '5px 10px', backgroundColor: 'var(--danger-soft)', color: 'var(--danger)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  overlay:     { position: 'fixed', inset: 0, backgroundColor: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
};
