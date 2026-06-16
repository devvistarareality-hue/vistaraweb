'use client';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { createUser, resetCreateUser } from '../../../../redux/actions/userManagementActions';
import { fetchDesignations } from '../../../../redux/actions/designationActions';
import Toast from '../../../../components/Toast';

const ALL_MODULES = ['Sales', 'Pre-Sales', 'HR', 'Execution', 'Purchase', 'Land'];
const ROLES       = ['Admin', 'Manager', 'Employee'];

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

function firstConsonantFrom(str, startIdx) {
  for (let i = startIdx; i < str.length; i++) {
    if (!VOWELS.has(str[i])) return str[i];
  }
  return str[startIdx] || 'X';
}

function generateUserCodePrefix(companyCode) {
  const code = (companyCode || '').toLowerCase().replace(/[^a-z]/g, '');
  if (code.length < 3) return (code + 'XXX').slice(0, 3).toUpperCase();
  const n  = code.length;
  const c1 = firstConsonantFrom(code, 0);
  const c2 = firstConsonantFrom(code, Math.floor(n * 0.4));
  const c3 = firstConsonantFrom(code, Math.floor(n * 0.8));
  return (c1 + c2 + c3).toUpperCase();
}

export default function CreateUserPage() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { creating, createError, createSuccess } = useSelector((s) => s.userManagement);
  const { designations } = useSelector((s) => s.designations);
  const loggedInUser   = useSelector((s) => s.auth.user);
  const userCodePrefix = generateUserCodePrefix(loggedInUser?.company_code);

  const [form, setForm] = useState({
    name:            '',
    email:           '',
    password:        '',
    role:            'Employee',
    designation:     '',
    modules:         [],
    manager_modules: [],
  });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  useEffect(() => { dispatch(fetchDesignations()); }, []);

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

  // Designations available for currently selected modules
  const availableDesignations = designations.filter((d) => form.modules.includes(d.module));

  // Reset designation if it no longer matches selected modules
  useEffect(() => {
    if (form.designation && !availableDesignations.find((d) => d.name === form.designation)) {
      setForm((f) => ({ ...f, designation: '' }));
    }
  }, [form.modules]);

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
    dispatch(createUser({ ...form, user_code_prefix: userCodePrefix }));
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
              <div style={s.prefixBox}>
                <span style={s.prefixValue}>{userCodePrefix}</span>
                <span style={s.prefixAuto}>auto</span>
              </div>
              <p style={s.hint}>
                System will assign full code, e.g.&nbsp;<strong>{userCodePrefix}001</strong>
              </p>
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

          <div style={{ marginBottom: 20 }}>
            <label style={s.label}>
              Designation
              {form.modules.length === 0 && (
                <span style={s.hintInline}> — select modules first</span>
              )}
            </label>
            <select
              value={form.designation}
              onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              style={{ ...s.input, maxWidth: 360, color: form.designation ? '#1A1A2E' : '#8492A6' }}
              disabled={availableDesignations.length === 0}
            >
              <option value="">
                {availableDesignations.length === 0
                  ? form.modules.length === 0 ? 'Select modules first' : 'No designations for selected modules'
                  : '— Select designation —'}
              </option>
              {availableDesignations.map((d) => (
                <option key={d.id} value={d.name}>{d.name} ({d.module})</option>
              ))}
            </select>
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
  grid2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 24px' },
  label:      { display: 'block', fontSize: 13, fontWeight: 600, color: '#8492A6', marginBottom: 6 },
  hintInline: { fontSize: 11, fontWeight: 500, color: '#9CA3AF' },
  input:      { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 14, boxSizing: 'border-box' },
  hint:       { fontSize: 11, color: '#8492A6', marginTop: 5 },
  prefixBox: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', borderRadius: 8,
    border: '1.5px solid #E0E6F0', backgroundColor: '#F5F6FA',
    fontSize: 14,
  },
  prefixValue: { fontWeight: 700, color: '#1A1A2E', letterSpacing: 2 },
  prefixAuto:  { fontSize: 11, fontWeight: 600, color: '#8492A6', backgroundColor: '#E0E6F0', borderRadius: 4, padding: '2px 7px' },
  checkGrid:  { display: 'flex', flexWrap: 'wrap', gap: '10px 20px' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#1A1A2E', cursor: 'pointer' },
  formFooter: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn:  { padding: '10px 20px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  saveBtn:    { padding: '10px 28px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
};
