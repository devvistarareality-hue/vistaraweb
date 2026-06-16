'use client';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { createUser, resetCreateUser } from '../../../../redux/actions/userManagementActions';
import Toast from '../../../../components/Toast';

const ALL_MODULES = ['Sales', 'Pre-Sales', 'HR', 'Execution', 'Purchase', 'Land'];
const ROLES       = ['Admin', 'Manager', 'Sales Executive', 'STM', 'Employee'];

export default function CreateUserPage() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { creating, createError, createSuccess } = useSelector((s) => s.userManagement);

  const [form, setForm] = useState({
    name:             '',
    email:            '',
    password:         '',
    role:             'Employee',
    modules:          [],
    manager_modules:  [],
    user_code_prefix: 'USR',
  });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  useEffect(() => {
    if (createSuccess) {
      setToast({ visible: true, message: 'User created successfully!', type: 'success' });
      dispatch(resetCreateUser());
      setTimeout(() => router.push('/admin/users'), 1200);
    }
    if (createError) {
      setToast({ visible: true, message: createError, type: 'error' });
      dispatch(resetCreateUser());
    }
  }, [createSuccess, createError]);

  const toggleModule = (mod, field) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(mod)
        ? f[field].filter((m) => m !== mod)
        : [...f[field], mod],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(createUser(form));
  };

  return (
    <div style={s.page}>
      <Toast {...toast} onHide={() => setToast((t) => ({ ...t, visible: false }))} />

      <div style={s.pageHeader}>
        <button onClick={() => router.back()} style={s.backBtn}>← Back</button>
        <h1 style={s.pageTitle}>Create New User</h1>
      </div>

      <div style={s.card}>
        <form onSubmit={handleSubmit}>

          <div style={s.grid2}>
            <div>
              <label style={s.label}>Full Name</label>
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={s.input}
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label style={s.label}>Email</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                style={s.input}
                placeholder="jane@company.com"
              />
            </div>
            <div>
              <label style={s.label}>Password</label>
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                style={s.input}
                minLength={6}
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label style={s.label}>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                style={s.input}
              >
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>User Code Prefix</label>
              <input
                type="text"
                value={form.user_code_prefix}
                onChange={(e) => setForm((f) => ({ ...f, user_code_prefix: e.target.value.toUpperCase() }))}
                style={s.input}
                placeholder="USR"
                maxLength={10}
              />
              <p style={s.hint}>Code auto-generated, e.g. USR001</p>
            </div>
          </div>

          <div style={{ marginTop: 24, marginBottom: 20 }}>
            <label style={s.label}>Modules</label>
            <div style={s.checkGrid}>
              {ALL_MODULES.map((mod) => (
                <label key={mod} style={s.checkLabel}>
                  <input
                    type="checkbox"
                    checked={form.modules.includes(mod)}
                    onChange={() => toggleModule(mod, 'modules')}
                  />
                  {mod}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={s.label}>Manager Modules</label>
            <div style={s.checkGrid}>
              {ALL_MODULES.map((mod) => (
                <label key={mod} style={s.checkLabel}>
                  <input
                    type="checkbox"
                    checked={form.manager_modules.includes(mod)}
                    onChange={() => toggleModule(mod, 'manager_modules')}
                  />
                  {mod}
                </label>
              ))}
            </div>
          </div>

          <div style={s.formFooter}>
            <button type="button" onClick={() => router.back()} style={s.cancelBtn}>Cancel</button>
            <button type="submit" disabled={creating} style={{ ...s.saveBtn, opacity: creating ? 0.6 : 1 }}>
              {creating ? 'Creating…' : 'Create User'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

const s = {
  page:       { padding: '32px 36px' },
  pageHeader: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  backBtn:    { background: 'none', border: 'none', fontSize: 14, color: '#8492A6', cursor: 'pointer', fontWeight: 600 },
  pageTitle:  { fontSize: 24, fontWeight: 800, color: '#1A1A2E' },
  card: {
    backgroundColor: '#fff',
    borderRadius:    16,
    padding:         '32px',
    boxShadow:       '0 4px 12px rgba(184,196,214,0.18)',
    maxWidth:        780,
  },
  grid2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px' },
  label:     { display: 'block', fontSize: 13, fontWeight: 600, color: '#8492A6', marginBottom: 6 },
  input:     { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 14 },
  hint:      { fontSize: 11, color: '#8492A6', marginTop: 5 },
  checkGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px 20px' },
  checkLabel:{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#1A1A2E', cursor: 'pointer' },
  formFooter:{ display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { padding: '10px 20px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  saveBtn:   { padding: '10px 28px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
};
