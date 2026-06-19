'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { SALES_ENDPOINTS } from '../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function RoleBadge({ role }) {
  if (!role) return <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>;
  const colors = {
    Admin:    { bg: '#FEE2E2', color: '#DC2626' },
    Manager:  { bg: '#E8EEFF', color: '#3D5AFE' },
    Employee: { bg: '#E8F5E9', color: '#2E7D32' },
  };
  const c = colors[role] || { bg: '#F0F3FA', color: '#8492A6' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>
      {role}
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

  const filtered = search.trim()
    ? members.filter((m) =>
        m.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.user_code?.toLowerCase().includes(search.toLowerCase()) ||
        m.designation?.toLowerCase().includes(search.toLowerCase()) ||
        m.role?.toLowerCase().includes(search.toLowerCase())
      )
    : members;

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
                  {['Name', 'User Code', 'Designation', 'Role', 'Phone', 'Email'].map((h) => (
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
                        <div style={{ fontWeight: 600, color: '#1A1A2E' }}>{m.name}</div>
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#8492A6', fontSize: 12 }}>{m.user_code}</td>
                    <td style={td}><DesigBadge desig={m.designation} /></td>
                    <td style={td}><RoleBadge role={m.role} /></td>
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
