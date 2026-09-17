'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';


import Icon from '../../../components/Icon';
import Loader from '../../../components/Loader';
function RoleBadge({ role }) {
  if (!role) return <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>—</span>;
  const colors = {
    Admin:    { bg: 'var(--danger-soft)', color: 'var(--danger)' },
    Manager:  { bg: 'var(--accent-soft)', color: 'var(--accent)' },
    Employee: { bg: 'var(--success-soft)', color: 'var(--success)' },
  };
  const c = colors[role] || { bg: 'var(--surface-2)', color: 'var(--muted)' };
  return (
    <span className="nx-badge" style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>
      {role}
    </span>
  );
}

function DesigBadge({ desig }) {
  if (!desig) return <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>—</span>;
  return (
    <span className="nx-badge" style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: 'var(--surface-2)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
      {desig}
    </span>
  );
}

// Frontline designations always take project assignments — that is how leads are
// routed to them. Manager takes them too, because an assignment is what confines a
// manager's leads/visits/closures to those projects (see manager_project_ids in the
// backend). Director and General Manager sit above the project line: they always see
// the whole company, so offering them an assignment would imply a limit that does
// not exist. Keep in step with PROJECT_SCOPED_ROLES on the backend.
const ASSIGN_DESIGS = ['TELECALLER', 'STM'];
const canHoldProjects = (m) =>
  ASSIGN_DESIGS.includes((m?.designation || '').toUpperCase()) || m?.role === 'Manager';

function FilterChip({ label, active, onClick }) {
  return (
    <button className="nx-btn nx-btn-sm nx-btn-primary" onClick={onClick} style={{ padding: '5px 11px', borderRadius: 20, border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, background: active ? 'var(--strong)' : 'var(--surface-3)', color: active ? '#fff' : 'var(--muted)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
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
    <div className="nx-modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div className="nx-modal" style={{ backgroundColor: 'var(--surface)', borderRadius: 20, width: 440, maxWidth: '92vw', boxShadow: '0 24px 80px rgba(var(--ink-rgb),0.18)', overflow: 'hidden' }}>

        {/* Gradient Header */}
        <div className="nx-modal-head" style={{ background: 'var(--hero)', padding: '20px 24px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Assign Projects</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{member.name} · {member.designation}</div>
          </div>
          <button onClick={() => onClose(null)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" /></button>
        </div>

        {/* Project list */}
        <div style={{ padding: '16px 22px', maxHeight: 380, overflowY: 'auto' }}>
          {loading ? (
            <Loader label="Loading…" style={{ padding: '28px 0' }} />
          ) : projects.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '30px 0' }}>No projects found.</p>
          ) : (
            projects.map(p => {
              const checked = selected.includes(p.id);
              return (
                <div key={p.id} onClick={() => toggle(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 16, marginBottom: 8, cursor: 'pointer', border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--surface-3)'}`, backgroundColor: checked ? 'var(--accent-softer)' : 'var(--surface-2)', transition: 'all 0.15s' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`, backgroundColor: checked ? 'var(--primary)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {checked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}><Icon name="check" /></span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{p.name}</div>
                    {p.location && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{p.location}</div>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px 20px', borderTop: '1px solid var(--surface-2)' }}>
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => onClose(null)} style={{ padding: '10px 20px', backgroundColor: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 24px', background: 'var(--strong)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1, minWidth: 100 }}>
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
    if (user && user.role !== 'Admin' && !user.is_staff && !(user.admin_modules || []).includes('Sales')) router.replace('/sales');
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
      const assignable = teamList.filter(canHoldProjects);
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

  const isAssignable = (m) => canHoldProjects(m);

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Sales Team</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{members.length} team members</p>
          </div>
          <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={load} title="Refresh" style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14, color: 'var(--muted)' }}>↺</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input className="nx-input"
          placeholder="Search by name, user code or designation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: 360, height: 38, padding: '0 12px', borderRadius: 9, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box' }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--faint)', marginRight: 4 }}>ROLE</span>
        <FilterChip label="All" active={!roleFilter} onClick={() => setRoleFilter(null)} />
        {roles.map((r) => <FilterChip key={r} label={r} active={roleFilter === r} onClick={() => setRoleFilter(roleFilter === r ? null : r)} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--faint)', marginRight: 4 }}>DESIG</span>
        <FilterChip label="All" active={!desigFilter} onClick={() => setDesigFilter(null)} />
        {desigs.map((d) => <FilterChip key={d} label={`${d} (${members.filter((m) => m.designation?.toUpperCase() === d).length})`} active={desigFilter === d} onClick={() => setDesigFilter(desigFilter === d ? null : d)} />)}
      </div>

      {apiError && (
        <div style={{ backgroundColor: 'var(--danger-soft)', border: '1px solid var(--danger-2)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, color: 'var(--danger)', fontSize: 13 }}>
          {apiError}
        </div>
      )}

      {loading ? (
        <Loader label="Loading…" style={{ padding: '28px 0' }} />
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 60, fontSize: 14 }}>
          {search ? 'No users match your search.' : 'No team members found.'}
        </p>
      ) : (
        <div className="nx-card" style={{ backgroundColor: 'var(--surface)', borderRadius: 18, boxShadow: '0 2px 8px rgba(140,148,160,0.18)', overflowX: 'auto' }}>
          <div>
            <table className="nx-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead style={{ backgroundColor: 'var(--surface-2)' }}>
                <tr>
                  {['Name', 'User Code', 'Designation', 'Role', 'Projects', 'Phone', 'Email'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--surface-2)' }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={avatarStyle}>{(m.name || 'U')[0].toUpperCase()}</div>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', color: 'var(--muted)', fontSize: 12 }}>{m.user_code}</td>
                    <td style={td}><DesigBadge desig={m.designation} /></td>
                    <td style={td}><RoleBadge role={m.role} /></td>
                    <td style={td}>
                      {isAssignable(m) ? (
                        <button className="nx-btn nx-btn-sm nx-btn-soft" onClick={() => setAssignMember(m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1.5px solid var(--accent)', backgroundColor: 'var(--accent-softer)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          <Icon name="folder" /> {projectCounts[m.id] > 0 ? `${projectCounts[m.id]} assigned` : 'Assign'}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, color: 'var(--muted)' }}>{m.phone || '—'}</td>
                    <td style={{ ...td, color: 'var(--muted)', fontSize: 12 }}>{m.email || '—'}</td>
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

const th = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '10px 16px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', fontSize: 13 };
const avatarStyle = { width: 34, height: 34, borderRadius: 9, backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 };
