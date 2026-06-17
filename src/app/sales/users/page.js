'use client';
import { useState, useEffect, useCallback } from 'react';
import { SALES_ENDPOINTS, USER_ENDPOINTS } from '../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const ROLE_COLOR = {
  telecaller: { bg: '#FFF8E1', color: '#F9A825' },
  stm:        { bg: '#E8EEFF', color: '#3D5AFE' },
  manager:    { bg: '#E8F5E9', color: '#2E7D32' },
};

function RoleBadge({ role }) {
  const c = ROLE_COLOR[role] || { bg: '#F0F3FA', color: '#8492A6' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.color, textTransform: 'capitalize' }}>
      {role === 'stm' ? 'STM' : role}
    </span>
  );
}

function AssignRoleModal({ user, onClose, onSaved }) {
  const [crmRole, setCrmRole] = useState('telecaller');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const res  = await fetch(SALES_ENDPOINTS.team, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ user_id: user.id, crm_role: crmRole }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(data.detail || 'Failed to assign role'); return; }
    onSaved(data);
    onClose();
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Assign CRM Role</h2>
            <p style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>{user.name} · {user.user_code}</p>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>CRM Role *</label>
            <select value={crmRole} onChange={(e) => setCrmRole(e.target.value)} style={inp}>
              <option value="telecaller">Telecaller (Pre-Sales)</option>
              <option value="stm">STM – Site Transaction Manager</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          {err && <p style={{ color: '#EF4444', fontSize: 12 }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...saveBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Assign Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRoleModal({ member, user, onClose, onSaved }) {
  const [crmRole,  setCrmRole]  = useState(member.crm_role);
  const [isActive, setIsActive] = useState(member.is_active);
  const [saving,   setSaving]   = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const res  = await fetch(SALES_ENDPOINTS.teamMember(member.id), {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ crm_role: crmRole, is_active: isActive }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { onSaved({ ...member, ...data }); onClose(); }
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Edit CRM Role</h2>
            <p style={{ fontSize: 12, color: '#8492A6', marginTop: 2 }}>{user.name} · {user.user_code}</p>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>CRM Role</label>
            <select value={crmRole} onChange={(e) => setCrmRole(e.target.value)} style={inp}>
              <option value="telecaller">Telecaller (Pre-Sales)</option>
              <option value="stm">STM – Site Transaction Manager</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A1A2E', cursor: 'pointer' }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active in Sales CRM
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...saveBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SalesUsersPage() {
  const [erpUsers,  setErpUsers]  = useState([]);
  const [roleMap,   setRoleMap]   = useState({});   // userId → SalesTeamMember record
  const [loading,   setLoading]   = useState(true);
  const [apiError,  setApiError]  = useState('');
  const [assigning, setAssigning] = useState(null); // user object to assign role to
  const [editing,   setEditing]   = useState(null); // { user, member }

  const load = useCallback(async () => {
    setApiError('');
    try {
      const safeJson = (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      };
      const [uRes, mRes] = await Promise.all([
        fetch(USER_ENDPOINTS.list,  { headers: authHeaders() }).then(safeJson),
        fetch(SALES_ENDPOINTS.team, { headers: authHeaders() }).then(safeJson).catch(() => []),
      ]);
      const users   = (Array.isArray(uRes) ? uRes : (uRes.results || [])).filter((u) => u.role !== 'Admin');
      const members = Array.isArray(mRes) ? mRes : [];
      setErpUsers(users);
      const map = {};
      members.forEach((m) => { map[m.user_id] = m; });
      setRoleMap(map);
    } catch (err) {
      setApiError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function removeRole(member) {
    if (!window.confirm(`Remove CRM role from ${member.name}?`)) return;
    await fetch(SALES_ENDPOINTS.teamMember(member.id), { method: 'DELETE', headers: authHeaders() });
    setRoleMap((prev) => {
      const next = { ...prev };
      delete next[member.user_id];
      return next;
    });
  }

  function onRoleAssigned(data) {
    setRoleMap((prev) => ({ ...prev, [data.user_id]: data }));
  }

  function onRoleEdited(data) {
    setRoleMap((prev) => ({ ...prev, [data.user_id]: data }));
  }

  const assignedCount = Object.keys(roleMap).length;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Sales Team</h1>
          <p style={{ fontSize: 13, color: '#8492A6' }}>
            {erpUsers.length} company users · {assignedCount} assigned CRM roles
          </p>
        </div>
        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Telecallers', role: 'telecaller', color: '#F9A825', bg: '#FFF8E1' },
            { label: 'STMs',        role: 'stm',        color: '#3D5AFE', bg: '#E8EEFF' },
            { label: 'Managers',    role: 'manager',    color: '#2E7D32', bg: '#E8F5E9' },
          ].map((s) => {
            const cnt = Object.values(roleMap).filter((m) => m.crm_role === s.role).length;
            return (
              <div key={s.role} style={{ padding: '6px 14px', borderRadius: 20, backgroundColor: s.bg, color: s.color, fontSize: 12, fontWeight: 700 }}>
                {s.label}: {cnt}
              </div>
            );
          })}
        </div>
      </div>

      {apiError && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#EF4444', fontSize: 13 }}>
          {apiError}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#8492A6', textAlign: 'center', marginTop: 60 }}>Loading…</p>
      ) : erpUsers.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 80, color: '#8492A6' }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No users found</p>
          <p style={{ fontSize: 13 }}>Add users to your company in the ERP first.</p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(184,196,214,0.18)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead style={{ backgroundColor: '#F8FAFD' }}>
                <tr>
                  {['Name', 'User Code', 'Designation', 'Role (ERP)', 'Phone', 'CRM Role', 'Actions'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {erpUsers.map((u) => {
                  const member = roleMap[u.id];
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={avatarStyle}>{(u.name || 'U')[0].toUpperCase()}</div>
                          <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace', color: '#8492A6', fontSize: 12 }}>{u.user_code}</td>
                      <td style={{ ...td, color: '#8492A6' }}>{u.designation || '—'}</td>
                      <td style={{ ...td, color: '#8492A6' }}>{u.role || '—'}</td>
                      <td style={{ ...td, color: '#8492A6' }}>{u.phone || '—'}</td>
                      <td style={td}>
                        {member ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <RoleBadge role={member.crm_role} />
                            {!member.is_active && (
                              <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>Inactive</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#D1D5DB', fontStyle: 'italic' }}>No role</span>
                        )}
                      </td>
                      <td style={td}>
                        {member ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setEditing({ user: u, member })}
                              style={iconBtn}
                              title="Edit role">
                              ✎
                            </button>
                            <button
                              onClick={() => removeRole(member)}
                              style={{ ...iconBtn, color: '#EF4444' }}
                              title="Remove role">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssigning(u)}
                            style={assignBtn}>
                            + Assign Role
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {assigning && (
        <AssignRoleModal
          user={assigning}
          onClose={() => setAssigning(null)}
          onSaved={(data) => { onRoleAssigned({ ...data, user_id: assigning.id }); setAssigning(null); }}
        />
      )}
      {editing && (
        <EditRoleModal
          user={editing.user}
          member={editing.member}
          onClose={() => setEditing(null)}
          onSaved={(data) => { onRoleEdited({ ...data, user_id: editing.user.id }); setEditing(null); }}
        />
      )}
    </div>
  );
}

const inp  = { width: '100%', height: 40, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box' };
const lbl  = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };
const tbl  = { width: '100%', borderCollapse: 'collapse' };
const th   = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '10px 16px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td   = { padding: '12px 16px', fontSize: 13 };
const saveBtn   = { padding: '9px 20px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const cancelBtn = { padding: '9px 16px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const iconBtn   = { background: 'none', border: '1.5px solid #E0E6F0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 14, color: '#8492A6' };
const assignBtn = { padding: '5px 12px', backgroundColor: '#F0F3FA', color: '#182350', border: '1.5px solid #E0E6F0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const avatarStyle = { width: 32, height: 32, borderRadius: 9, backgroundColor: '#E8EEFF', color: '#3D5AFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 };
const overlay   = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal     = { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid #F0F3FA' };
const closeBtn  = { background: 'none', border: 'none', fontSize: 16, color: '#8492A6', cursor: 'pointer', padding: '2px 6px' };
