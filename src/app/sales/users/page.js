'use client';
import { useState, useEffect, useCallback } from 'react';
import { USER_ENDPOINTS } from '../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const DESIG_STYLE = {
  TELECALLER:       { bg: '#FFF8E1', color: '#F9A825' },
  STM:              { bg: '#E8EEFF', color: '#3D5AFE' },
  'SALES CLUSTER HEAD': { bg: '#EDE7F6', color: '#6A1B9A' },
  'REGIONAL HEAD':  { bg: '#E8F5E9', color: '#2E7D32' },
  CMO:              { bg: '#FCE4EC', color: '#C62828' },
  'CP CLUSTER HEAD':{ bg: '#E3F2FD', color: '#1565C0' },
  MANAGER:          { bg: '#E8F5E9', color: '#2E7D32' },
};

function DesigBadge({ desig }) {
  if (!desig) return <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>;
  const d = desig.toUpperCase();
  const c = Object.entries(DESIG_STYLE).find(([k]) => d.includes(k))?.[1]
            || { bg: '#F0F3FA', color: '#8492A6' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>
      {desig}
    </span>
  );
}

export default function SalesUsersPage() {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [apiError, setApiError] = useState('');
  const [search,   setSearch]   = useState('');

  const load = useCallback(async () => {
    setApiError('');
    try {
      const res  = await fetch(USER_ENDPOINTS.list, { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      const all  = Array.isArray(data) ? data : (data.results || []);
      setUsers(all.filter((u) => u.role !== 'Admin'));
    } catch (err) {
      setApiError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? users.filter((u) =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.user_code?.toLowerCase().includes(search.toLowerCase()) ||
        u.designation?.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  // Count by designation keyword
  const count = (kw) => users.filter((u) => u.designation?.toUpperCase().includes(kw)).length;

  const chips = [
    { label: 'Telecallers',  kw: 'TELECALLER', color: '#F9A825', bg: '#FFF8E1' },
    { label: 'STMs',         kw: 'STM',        color: '#3D5AFE', bg: '#E8EEFF' },
    { label: 'Sales Heads',  kw: 'SALES',      color: '#6A1B9A', bg: '#EDE7F6' },
    { label: 'Regional',     kw: 'REGIONAL',   color: '#2E7D32', bg: '#E8F5E9' },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Sales Team</h1>
          <p style={{ fontSize: 13, color: '#8492A6' }}>{users.length} team members</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {chips.map((c) => (
            <div key={c.kw} style={{ padding: '6px 14px', borderRadius: 20, backgroundColor: c.bg, color: c.color, fontSize: 12, fontWeight: 700 }}>
              {c.label}: {count(c.kw)}
            </div>
          ))}
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
                  {['Name', 'User Code', 'Designation', 'Phone', 'Email'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={avatarStyle}>{(u.name || 'U')[0].toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1A1A2E' }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: '#8492A6', marginTop: 1 }}>{u.role}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#8492A6', fontSize: 12 }}>{u.user_code}</td>
                    <td style={td}><DesigBadge desig={u.designation} /></td>
                    <td style={{ ...td, color: '#8492A6' }}>{u.phone || '—'}</td>
                    <td style={{ ...td, color: '#8492A6', fontSize: 12 }}>{u.email || '—'}</td>
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
