'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { SALES_ENDPOINTS } from '../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const CRM_ROLES = [
  { value: 'telecaller', label: 'Telecaller', bg: '#FFF8E1', color: '#F9A825' },
  { value: 'stm',        label: 'STM (Sales)', bg: '#E8EEFF', color: '#3D5AFE' },
  { value: 'manager',    label: 'Manager',     bg: '#E8F5E9', color: '#2E7D32' },
];

function CrmRoleBadge({ role }) {
  const r = CRM_ROLES.find(r => r.value === role);
  if (!r) return <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: r.bg, color: r.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>
      {r.label}
    </span>
  );
}

function DesigBadge({ desig }) {
  if (!desig) return <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: '#F0F3FA', color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.3 }}>
      {desig}
    </span>
  );
}

export default function SalesUsersPage() {
  const router = useRouter();
  const user   = useSelector((s) => s.auth.user);

  useEffect(() => {
    if (user && user.role !== 'Admin' && !user.is_staff) router.replace('/sales');
  }, [user]);

  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [apiError, setApiError] = useState('');
  const [search,   setSearch]   = useState('');
  const [saving,   setSaving]   = useState(null); // member id being saved

  const load = useCallback(async () => {
    setApiError('');
    setLoading(true);
    try {
      const res  = await fetch(SALES_ENDPOINTS.team, { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setApiError(err.message || 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRole = async (memberId, newRole) => {
    setSaving(memberId);
    try {
      const res = await fetch(SALES_ENDPOINTS.teamMember(memberId), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ crm_role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, crm_role: newRole } : m));
    } catch {
      alert('Could not update CRM role. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const filtered = search.trim()
    ? members.filter((m) =>
        m.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.user_code?.toLowerCase().includes(search.toLowerCase()) ||
        m.designation?.toLowerCase().includes(search.toLowerCase()) ||
        m.crm_role?.toLowerCase().includes(search.toLowerCase())
      )
    : members;

  // Count by CRM role
  const roleCounts = members.reduce((acc, m) => {
    const key = m.crm_role || 'unset';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Sales Team</h1>
            <p style={{ fontSize: 13, color: '#8492A6' }}>{members.length} team members</p>
          </div>
          <button onClick={load} title="Refresh" style={{ background: 'none', border: '1.5px solid #E0E6F0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14, color: '#8492A6' }}>↺</button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {CRM_ROLES.map(r => (
            <div key={r.value} style={{ padding: '5px 12px', borderRadius: 20, backgroundColor: r.bg, color: r.color, fontSize: 11, fontWeight: 700 }}>
              {r.label}: {roleCounts[r.value] || 0}
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: '#FFF8E1', border: '1px solid #F9A825', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#92600A' }}>
        <b>Tip:</b> Set the <b>CRM Role</b> for each team member so the app knows who is a Telecaller and who is an STM.
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Search by name, user code or designation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 360, height: 38, padding: '0 12px', borderRadius: 9, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box' }}
        />
      </div>

      {apiError && (
        <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#EF4444', fontSize: 13 }}>
          {apiError}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#8492A6', textAlign: 'center', marginTop: 60 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#8492A6', textAlign: 'center', marginTop: 60, fontSize: 14 }}>
          {search ? 'No users match your search.' : 'No team members found.'}
        </p>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(184,196,214,0.18)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#F8FAFD' }}>
                <tr>
                  {['Name', 'User Code', 'Designation', 'CRM Role', 'Phone', 'Email'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={avatarStyle}>{(m.name || 'U')[0].toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1A1A2E' }}>{m.name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#8492A6', fontSize: 12 }}>{m.user_code}</td>
                    <td style={td}><DesigBadge desig={m.designation} /></td>
                    <td style={td}>
                      {saving === m.id ? (
                        <span style={{ fontSize: 12, color: '#8492A6' }}>Saving…</span>
                      ) : (
                        <select
                          value={m.crm_role || ''}
                          onChange={(e) => updateRole(m.id, e.target.value)}
                          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, border: '1.5px solid #E0E6F0', backgroundColor: '#fff', color: '#1A1A2E', cursor: 'pointer' }}
                        >
                          <option value="">— Select Role —</option>
                          {CRM_ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td style={{ ...td, color: '#8492A6' }}>{m.phone || '—'}</td>
                    <td style={{ ...td, color: '#8492A6', fontSize: 12 }}>{m.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '10px 16px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', fontSize: 13 };
const avatarStyle = { width: 34, height: 34, borderRadius: 9, backgroundColor: '#E8EEFF', color: '#3D5AFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 };
