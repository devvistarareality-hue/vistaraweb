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

const ASSIGN_DESIGS = ['TELECALLER', 'STM'];

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '5px 11px', borderRadius: 20, border: `1px solid ${active ? '#182350' : '#E0E6F0'}`, background: active ? '#182350' : '#EEF1F7', color: active ? '#fff' : '#8492A6', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  );
}

function AssignProjectsModal({ member, projects, onClose }) {
  const [selected, setSelected]  = useState([]);
  const [loading,  setLoading]   = useState(true);
  const [saving,   setSaving]    = useState(false);

  useEffect(() => {
    fetch(`${SALES_ENDPOINTS.userProjects}?user_id=${member.id}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(ids => { setSelected(Array.isArray(ids) ? ids : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [member.id]);

  function toggle(pid) {
    setSelected(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
  }

  async function save() {
    setSaving(true);
    await fetch(SALES_ENDPOINTS.userProjects, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ user_id: member.id, project_ids: selected }),
    });
    setSaving(false);
    onClose(selected);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 20, width: 440, maxWidth: '92vw', boxShadow: '0 24px 80px rgba(24,35,80,0.18)', overflow: 'hidden' }}>

        {/* Gradient Header */}
        <div style={{ background: 'linear-gradient(135deg, #182350 0%, #2D3E8C 100%)', padding: '20px 24px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Assign Projects</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{member.name} · {member.designation}</div>
          </div>
          <button onClick={() => onClose(null)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Project list */}
        <div style={{ padding: '16px 22px', maxHeight: 380, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#8492A6', padding: '30px 0' }}>Loading…</p>
          ) : projects.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#8492A6', padding: '30px 0' }}>No projects found.</p>
          ) : (
            projects.map(p => {
              const checked = selected.includes(p.id);
              return (
                <div key={p.id} onClick={() => toggle(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12, marginBottom: 8, cursor: 'pointer', border: `1.5px solid ${checked ? '#3D5AFE' : '#E8ECF4'}`, backgroundColor: checked ? '#F0F3FF' : '#FAFAFA', transition: 'all 0.15s' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${checked ? '#3D5AFE' : '#C8D0E0'}`, backgroundColor: checked ? '#3D5AFE' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {checked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{p.name}</div>
                    {p.location && <div style={{ fontSize: 12, color: '#8492A6', marginTop: 1 }}>{p.location}</div>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px 20px', borderTop: '1px solid #F0F3FA' }}>
          <button onClick={() => onClose(null)} style={{ padding: '10px 20px', backgroundColor: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #182350 0%, #3D5AFE 100%)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, minWidth: 100 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SalesUsersPage() {
  const router    = useRouter();
  const user      = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);

  useEffect(() => {
    if (user && user.role !== 'Admin' && !user.is_staff) router.replace('/sales');
  }, [user]);

  const [members,  setMembers]  = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [apiError, setApiError] = useState('');
  const [search,   setSearch]   = useState('');
  const [desigFilter, setDesigFilter] = useState(null);
  const [roleFilter,  setRoleFilter]  = useState(null);
  const [assignMember, setAssignMember] = useState(null); // member being assigned
  // track assigned project counts per user
  const [projectCounts, setProjectCounts] = useState({}); // {user_id: count}

  const load = useCallback(async () => {
    setApiError('');
    setLoading(true);
    const cq = companyId ? `?company_id=${companyId}` : '';
    try {
      const [teamRes, projRes] = await Promise.all([
        fetch(SALES_ENDPOINTS.team     + cq, { headers: authHeaders() }).then(r => r.json()),
        fetch(SALES_ENDPOINTS.projects + cq, { headers: authHeaders() }).then(r => r.json()),
      ]);
      const teamList = Array.isArray(teamRes) ? teamRes : [];
      setMembers(teamList);
      setProjects(Array.isArray(projRes) ? projRes : []);

      // Load project counts for TELECALLER/STM users (best-effort — backend may not be deployed yet)
      const assignable = teamList.filter(m => ASSIGN_DESIGS.includes(m.designation?.toUpperCase()));
      const counts = {};
      await Promise.allSettled(assignable.map(async m => {
        try {
          const r = await fetch(`${SALES_ENDPOINTS.userProjects}?user_id=${m.id}`, { headers: authHeaders() });
          if (r.ok) {
            const ids = await r.json();
            counts[m.id] = Array.isArray(ids) ? ids.length : 0;
          }
        } catch { counts[m.id] = 0; }
      }));
      setProjectCounts(counts);
    } catch (err) {
      setApiError(err.message || 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function handleAssignClose(newIds) {
    setAssignMember(null);
    if (newIds !== null && assignMember) {
      setProjectCounts(prev => ({ ...prev, [assignMember.id]: newIds.length }));
    }
  }

  const desigs = [...new Set(members.map((m) => m.designation?.toUpperCase()).filter(Boolean))].sort();
  const roles  = [...new Set(members.map((m) => m.role).filter(Boolean))].sort();

  const filtered = members.filter((m) => {
    if (search.trim() && !(
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.user_code?.toLowerCase().includes(search.toLowerCase()) ||
      m.designation?.toLowerCase().includes(search.toLowerCase()) ||
      m.role?.toLowerCase().includes(search.toLowerCase())
    )) return false;
    if (desigFilter && m.designation?.toUpperCase() !== desigFilter) return false;
    if (roleFilter && m.role !== roleFilter) return false;
    return true;
  });

  const isAssignable = (m) => ASSIGN_DESIGS.includes(m.designation?.toUpperCase());

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
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Search by name, user code or designation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 360, height: 38, padding: '0 12px', borderRadius: 9, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box' }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', marginRight: 4 }}>ROLE</span>
        <FilterChip label="All" active={!roleFilter} onClick={() => setRoleFilter(null)} />
        {roles.map((r) => <FilterChip key={r} label={r} active={roleFilter === r} onClick={() => setRoleFilter(roleFilter === r ? null : r)} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', marginRight: 4 }}>DESIG</span>
        <FilterChip label="All" active={!desigFilter} onClick={() => setDesigFilter(null)} />
        {desigs.map((d) => <FilterChip key={d} label={`${d} (${members.filter((m) => m.designation?.toUpperCase() === d).length})`} active={desigFilter === d} onClick={() => setDesigFilter(desigFilter === d ? null : d)} />)}
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
        <div style={{ backgroundColor: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(184,196,214,0.18)', overflowX: 'auto' }}>
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead style={{ backgroundColor: '#F8FAFD' }}>
                <tr>
                  {['Name', 'User Code', 'Designation', 'Role', 'Projects', 'Phone', 'Email'].map((h) => (
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
                    <td style={td}>
                      {isAssignable(m) ? (
                        <button onClick={() => setAssignMember(m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1.5px solid #3D5AFE', backgroundColor: '#F0F3FF', color: '#3D5AFE', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          🗂 {projectCounts[m.id] > 0 ? `${projectCounts[m.id]} assigned` : 'Assign'}
                        </button>
                      ) : (
                        <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>
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

      {assignMember && (
        <AssignProjectsModal
          member={assignMember}
          projects={projects}
          onClose={handleAssignClose}
        />
      )}
    </div>
  );
}

const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '10px 16px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', fontSize: 13 };
const avatarStyle = { width: 34, height: 34, borderRadius: 9, backgroundColor: '#E8EEFF', color: '#3D5AFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 };
