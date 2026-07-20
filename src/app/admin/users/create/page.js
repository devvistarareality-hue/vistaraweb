'use client';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { createUser, resetCreateUser, fetchUsers } from '../../../../redux/actions/userManagementActions';
import { fetchDesignations } from '../../../../redux/actions/designationActions';
import { fetchCompanies } from '../../../../redux/actions/companiesActions';
import Toast from '../../../../components/Toast';
import { ALL_MODULES } from '../../../../lib/moduleAccess';

const ROLES       = ['Manager', 'Employee', 'Intern'];

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
  const { creating, createError, createSuccess, users } = useSelector((s) => s.userManagement);
  const { designations } = useSelector((s) => s.designations);
  const { companies }    = useSelector((s) => s.companies);
  const loggedInUser     = useSelector((s) => s.auth.user);
  const isVRLAdmin       = loggedInUser?.company_code === 'VRL' && (loggedInUser?.role === 'Admin' || loggedInUser?.is_staff);

  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [managerSearch,     setManagerSearch]     = useState('');

  const selectedCompany    = companies.find((c) => String(c.id) === String(selectedCompanyId)) || null;
  const userCodePrefix     = generateUserCodePrefix(
    isVRLAdmin && selectedCompany ? selectedCompany.code : loggedInUser?.company_code
  );

  const [form, setForm] = useState({
    name:                 '',
    email:                '',
    phone:                '',
    password:             '',
    role:                 'Employee',
    designation:          '',
    modules:              [],
    manager_modules:      [],
    admin_modules:        [],
    reporting_manager_id: null,
  });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  useEffect(() => {
    dispatch(fetchUsers());
    if (isVRLAdmin) dispatch(fetchCompanies());
  }, []);

  // Clear reporting manager + reload the selected company's designations when it changes.
  useEffect(() => {
    setForm((f) => ({ ...f, reporting_manager_id: null }));
    setManagerSearch('');
    dispatch(fetchDesignations(true, selectedCompanyId || null));
  }, [selectedCompanyId]);

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

  const availableDesignations = designations.filter((d) => form.modules.includes(d.module));

  const availableManagers = users.filter((u) => {
    if (isVRLAdmin && selectedCompany) return u.company_code === selectedCompany.code;
    return true;
  });

  useEffect(() => {
    if (form.designation && !availableDesignations.find((d) => d.name === form.designation)) {
      setForm((f) => ({ ...f, designation: '' }));
    }
  }, [form.modules]);

  const toggleModule = (mod, field) => {
    setForm((f) => {
      const next   = f[field].includes(mod) ? f[field].filter((m) => m !== mod) : [...f[field], mod];
      const updated = { ...f, [field]: next };
      // Managers get Manager Modules auto-mirrored from Modules — any Modules
      // change overwrites Manager Modules to match.
      if (field === 'modules' && f.role === 'Manager') updated.manager_modules = next;
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isVRLAdmin && !selectedCompanyId) {
      setToast({ visible: true, message: 'Please select a company.', type: 'error' });
      return;
    }
    const payload = { ...form, user_code_prefix: userCodePrefix, reporting_manager_id: form.reporting_manager_id ? Number(form.reporting_manager_id) : null };
    if (isVRLAdmin && selectedCompanyId) payload.company_id = Number(selectedCompanyId);
    dispatch(createUser(payload));
  };

  return (
    <div style={s.page}>
      <Toast {...toast} onHide={() => setToast((t) => ({ ...t, visible: false }))} />

      <div style={s.pageHeader}>
        <button onClick={() => router.back()} style={s.backBtn}>← Back</button>
        <h1 style={s.pageTitle}>Create New User</h1>
      </div>

      <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg, #182350 0%, #2D3E8C 100%)', padding: '22px 28px 20px' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>New User</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>Fill in the details below to create a new user account</div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px 28px 28px' }}>

          {/* Company selector — VRL admin only */}
          {isVRLAdmin && (
            <div style={{ marginBottom: 24 }}>
              <label style={s.label}>
                Company <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                required
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                style={{ ...s.input, maxWidth: 420, color: selectedCompanyId ? '#1A1A2E' : '#8492A6' }}
              >
                <option value="">— Select a company —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              {selectedCompany && (
                <p style={s.hint}>
                  User will be created under <strong>{selectedCompany.name}</strong>.
                  Code prefix: <strong>{userCodePrefix}</strong>
                </p>
              )}
            </div>
          )}

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
              <label style={s.label}>Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                style={s.input}
                placeholder="+91 98765 43210"
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
                onChange={(e) => {
                  const role = e.target.value;
                  setForm((f) => ({ ...f, role, manager_modules: role === 'Manager' ? f.modules : f.manager_modules }));
                }}
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
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={s.label}>
              Reporting Manager <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
            </label>
            {isVRLAdmin && !selectedCompanyId ? (
              <p style={s.hint}>Select a company first to see available managers</p>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search by name or user code…"
                  value={managerSearch}
                  onChange={(e) => setManagerSearch(e.target.value)}
                  style={{ ...s.input, marginBottom: 6 }}
                />
                <select
                  value={form.reporting_manager_id || ''}
                  onChange={(e) => setForm((f) => ({ ...f, reporting_manager_id: e.target.value || null }))}
                  style={{ ...s.input, maxWidth: 420 }}
                >
                  <option value="">— None —</option>
                  {availableManagers
                    .filter((u) => {
                      if (!managerSearch) return true;
                      const q = managerSearch.toLowerCase();
                      return u.name?.toLowerCase().includes(q) || u.user_code?.toLowerCase().includes(q);
                    })
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}  ·  {u.user_code}  ·  {u.role}{u.designation ? `  ·  ${u.designation}` : ''}
                      </option>
                    ))}
                </select>
              </>
            )}
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={s.label}>
              Manager Modules
              {form.role === 'Manager' && <span style={s.hintInline}> — auto-matches Modules</span>}
            </label>
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

          {form.role === 'Manager' && (
            <div style={{ marginBottom: 28 }}>
              <label style={s.label}>Admin Modules</label>
              <div style={s.checkGrid}>
                {ALL_MODULES.map((mod) => (
                  <label key={mod} style={s.checkLabel}>
                    <input
                      type="checkbox"
                      checked={form.admin_modules.includes(mod)}
                      onChange={() => toggleModule(mod, 'admin_modules')}
                    />
                    {mod}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={() => router.back()} style={{ padding: '10px 20px', backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={creating} style={{ padding: '10px 28px', background: 'linear-gradient(135deg, #182350 0%, #3D5AFE 100%)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: creating ? 0.7 : 1, minWidth: 130 }}>
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
  input:      { width: '100%', height: 44, padding: '0 12px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 14, boxSizing: 'border-box' },
  hint:       { fontSize: 11, color: '#8492A6', marginTop: 5 },
  prefixBox: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 44, padding: '0 12px', borderRadius: 8,
    border: '1.5px solid #E0E6F0', backgroundColor: '#F5F6FA',
    fontSize: 14, boxSizing: 'border-box',
  },
  prefixValue: { fontWeight: 700, color: '#1A1A2E', letterSpacing: 2 },
  prefixAuto:  { fontSize: 11, fontWeight: 600, color: '#8492A6', backgroundColor: '#E0E6F0', borderRadius: 4, padding: '2px 7px' },
  checkGrid:  { display: 'flex', flexWrap: 'wrap', gap: '10px 20px' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#1A1A2E', cursor: 'pointer' },
  formFooter: { display: 'flex', justifyContent: 'flex-end', gap: 12 },
  cancelBtn:  { padding: '10px 20px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  saveBtn:    { padding: '10px 28px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
};
