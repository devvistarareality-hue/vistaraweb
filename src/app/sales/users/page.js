'use client';
import { useState, useEffect, useCallback } from 'react';
import { SALES_ENDPOINTS, USER_ENDPOINTS } from '../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const CRM_ROLES = ['telecaller', 'stm', 'manager'];

const ROLE_COLOR = {
  telecaller: { bg: '#FFF8E1', color: '#F9A825' },
  stm:        { bg: '#E8EEFF', color: '#3D5AFE' },
  manager:    { bg: '#E8F5E9', color: '#2E7D32' },
  admin:      { bg: '#FCE4EC', color: '#C62828' },
};

function RoleBadge({ role }) {
  const c = ROLE_COLOR[role] || { bg: '#F0F3FA', color: '#8492A6' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.color, textTransform: 'capitalize' }}>
      {role}
    </span>
  );
}

function AddMemberModal({ erpUsers, onClose, onAdded }) {
  const [userId,  setUserId]  = useState('');
  const [crmRole, setCrmRole] = useState('telecaller');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!userId) { setErr('Select a user.'); return; }
    setSaving(true);
    const res  = await fetch(SALES_ENDPOINTS.team, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ user_id: userId, crm_role: crmRole }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(data.detail || 'Failed'); return; }
    onAdded(data);
    onClose();
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Add Team Member</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Select ERP User *</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} style={inp}>
              <option value="">— Choose user —</option>
              {erpUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} · {u.user_code} · {u.role}</option>
              ))}
            </select>
          </div>
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
              {saving ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRoleModal({ member, onClose, onSaved }) {
  const [crmRole,   setCrmRole]  = useState(member.crm_role);
  const [isActive,  setIsActive] = useState(member.is_active);
  const [saving,    setSaving]   = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const res  = await fetch(SALES_ENDPOINTS.teamMember(member.id), {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ crm_role: crmRole, is_active: isActive }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { onSaved(data); onClose(); }
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>Edit — {member.name}</h2>
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
  const [members,  setMembers]  = useState([]);
  const [erpUsers, setErpUsers] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [editMember, setEditMember] = useState(null);

  const load = useCallback(async () => {
    const [mRes, uRes] = await Promise.all([
      fetch(SALES_ENDPOINTS.team, { headers: authHeaders() }).then((r) => r.json()),
      fetch(USER_ENDPOINTS.list, { headers: authHeaders() }).then((r) => r.json()).catch(() => []),
    ]);
    setMembers(Array.isArray(mRes) ? mRes : []);
    setErpUsers(Array.isArray(uRes) ? uRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function removeMember(m) {
    if (!window.confirm(`Remove ${m.name} from Sales CRM?`)) return;
    await fetch(SALES_ENDPOINTS.teamMember(m.id), { method: 'DELETE', headers: authHeaders() });
    setMembers((prev) => prev.filter((x) => x.id !== m.id));
  }

  function onAdded(data) {
    setMembers((prev) => [data, ...prev]);
  }

  function onSaved(data) {
    setMembers((prev) => prev.map((m) => m.id === data.id ? { ...m, ...data } : m));
  }

  const existingUserIds = new Set(members.map((m) => m.user_id));
  const availableUsers  = erpUsers.filter((u) => !existingUserIds.has(u.id));

  const grouped = {
    telecaller: members.filter((m) => m.crm_role === 'telecaller'),
    stm:        members.filter((m) => m.crm_role === 'stm'),
    manager:    members.filter((m) => m.crm_role === 'manager'),
  };

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Sales Team</h1>
          <p style={{ fontSize: 13, color: '#8492A6' }}>{members.length} team members</p>
        </div>
        <button onClick={() => setAddModal(true)} style={saveBtn}>+ Add Team Member</button>
      </div>

      {loading ? (
        <p style={{ color: '#8492A6', textAlign: 'center', marginTop: 60 }}>Loading…</p>
      ) : members.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 80, color: '#8492A6' }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No team members yet</p>
          <p style={{ fontSize: 13 }}>Add ERP users to the Sales CRM team to start assigning leads.</p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(184,196,214,0.18)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead style={{ backgroundColor: '#F8FAFD' }}>
                <tr>
                  {['Name', 'User Code', 'Department', 'Phone', 'CRM Role', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={avatar}>{(m.name || 'U')[0].toUpperCase()}</div>
                        <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{m.name}</span>
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#8492A6' }}>{m.user_code}</td>
                    <td style={{ ...td, color: '#8492A6' }}>{m.department || '—'}</td>
                    <td style={{ ...td, color: '#8492A6' }}>{m.phone || '—'}</td>
                    <td style={td}><RoleBadge role={m.crm_role} /></td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                        backgroundColor: m.is_active ? '#E8F5E9' : '#FEE2E2',
                        color: m.is_active ? '#2E7D32' : '#EF4444',
                      }}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditMember(m)} style={iconBtn} title="Edit role">✎</button>
                        <button onClick={() => removeMember(m)} style={{ ...iconBtn, color: '#EF4444' }} title="Remove">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {addModal && (
        <AddMemberModal erpUsers={availableUsers} onClose={() => setAddModal(false)} onAdded={onAdded} />
      )}
      {editMember && (
        <EditRoleModal member={editMember} onClose={() => setEditMember(null)} onSaved={onSaved} />
      )}
    </div>
  );
}

const inp = { width: '100%', height: 40, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };
const tbl = { width: '100%', borderCollapse: 'collapse' };
const th  = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '10px 16px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td  = { padding: '12px 16px', fontSize: 13 };
const saveBtn   = { padding: '9px 20px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const cancelBtn = { padding: '9px 16px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const iconBtn   = { background: 'none', border: '1.5px solid #E0E6F0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 14, color: '#8492A6' };
const avatar    = { width: 32, height: 32, borderRadius: 9, backgroundColor: '#E8EEFF', color: '#3D5AFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 };
const overlay   = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal     = { backgroundColor: '#fff', borderRadius: 16, width: '90%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '1px solid #F0F3FA' };
const closeBtn  = { background: 'none', border: 'none', fontSize: 16, color: '#8492A6', cursor: 'pointer', padding: '2px 6px' };
