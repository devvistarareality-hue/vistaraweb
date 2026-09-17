'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../constants/api';
import { isManagerRole } from '../lib/moduleAccess';
import Loader from './Loader';


// Reusable org chart. `module` scopes to a department (admins only); `scope="all"`
// shows the whole company. Non-admins always get their own reporting subtree.
// `adminView` is for a Sales Admin-Modules user viewing this from the mirrored
// Admin section — it asks the backend for the full company org via `admin_view=1`
// (see _sees_all_company in backend/sales/views.py), without affecting real admins.
// `cp` is the Channel Partner chart: scoped by CP designation rather than by module,
// since CP staff sit in Sales and there is no module to assign them to.
export default function OrgChartView({ module = '', scope = '', title = 'My Team', adminView = false, cp = false }) {
  const me = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const companies = useSelector((s) => s.companies?.companies || []);
  const isAdmin = me?.role === 'Admin' || me?.is_staff;
  const companyName = (companyId && companies.find((c) => c.id === companyId)?.name) || me?.company_name || 'Organisation';
  const query = (() => {
    const parts = [];
    if (isAdmin) {
      if (cp) parts.push('cp=1');
      else if (scope === 'all') parts.push('scope=all');
      else if (module) parts.push(`module=${encodeURIComponent(module)}`);
    }
    if (adminView) parts.push('admin_view=1');
    if (companyId) parts.push(`company_id=${companyId}`);   // honour "Viewing Company" filter
    return parts.length ? '?' + parts.join('&') : '';
  })();

  // What the department node and the count are named. Separate from `module`, which
  // is a query scope — the CP chart has a department name but no module to ask for.
  const label = cp ? 'Channel Partner' : module;

  const [team,    setTeam]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState('');
  const [view,    setView]    = useState('chart');

  useEffect(() => {
    setLoading(true);
    fetch(SALES_ENDPOINTS.myTeam + query, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setTeam(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [query]);

  const ql = q.trim().toLowerCase();
  const visible = ql
    ? team.filter((m) => [m.name, m.user_code, m.designation].some((v) => (v || '').toLowerCase().includes(ql)))
    : team;
  const directs = team.filter((m) => m.is_direct_report).length;

  const tree = (() => {
    if (!team.length) return null;
    const byId = {}; team.forEach((m) => { byId[m.id] = m; });
    const byParent = {};
    team.forEach((m) => { (byParent[m.reporting_manager_id] = byParent[m.reporting_manager_id] || []).push(m); });
    const build = (u) => ({ ...u, _isMe: u.id === me?.id, children: sortSiblings(byParent[u.id] || []).map(build) });
    if (!isAdmin && (byParent[me?.id] || []).length > 0) {
      // Manager view: show the department header on top, then the manager + their team.
      const meNode = build({ id: me?.id, name: me?.name, designation: me?.designation, role: me?.role });
      return {
        name: label || companyName,
        designation: label ? 'Department' : 'Company',
        _root: true, children: [meNode],
      };
    }
    let tops = team.filter((m) => isManagerRole(m) && !m.reporting_manager_id);
    if (!tops.length) tops = team.filter((m) => !m.reporting_manager_id || !byId[m.reporting_manager_id]);
    tops = sortSiblings(tops);
    // Always show a department/company header so the context is consistent.
    return {
      name: scope === 'all' ? companyName : (label || companyName),
      designation: scope === 'all' ? 'Organisation' : (label ? 'Department' : 'Company'),
      _root: true, children: tops.map(build),
    };
  })();

  const orgView = !!(tree && !tree._isMe);
  const showStats = cp || module === 'Sales';   // leads/closures are sales-only, and CP is part of Sales
  const n = team.length;
  const subtitle = scope === 'all'
    ? `${n} ${n === 1 ? 'person' : 'people'} across the organisation`
    : label && isAdmin
    ? `${n} ${n === 1 ? 'person' : 'people'} in ${label}`
    : orgView
    ? `${n} ${n === 1 ? 'person' : 'people'} across the organisation`
    : `${n} ${n === 1 ? 'person' : 'people'} reporting under you${n ? ` · ${directs} direct` : ''}`;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{title}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-3)', borderRadius: 14, padding: 4 }}>
          {[['chart', "Org Chart"], ['table', "List"]].map(([k, label]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: view === k ? 'var(--surface)' : 'transparent', color: view === k ? 'var(--accent)' : 'var(--muted)',
                boxShadow: view === k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Loader label="Loading…" style={{ padding: '28px 0' }} />
      ) : team.length === 0 ? (
        <div className="nx-card" style={{ background: 'var(--surface)', borderRadius: 18, padding: '48px 24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(140,148,160,0.18)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No org chart yet.</p>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Assign people to this {label ? 'department' : 'team'} and set their <strong>Reporting Manager</strong>, and they’ll appear here.</p>
        </div>
      ) : view === 'chart' ? (
        <div style={{ background: 'radial-gradient(circle at 1px 1px, var(--surface-3) 1px, transparent 0) 0 0 / 22px 22px, var(--surface-2)', borderRadius: 20, border: '1px solid var(--surface-3)', boxShadow: 'inset 0 0 40px rgba(201,205,210,0.18)', padding: '36px 20px', overflowX: 'auto' }}>
          <div className="org-tree"><ul><OrgNode node={tree} showStats={showStats} /></ul></div>
        </div>
      ) : (
        <>
          <input className="nx-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code or designation…"
            style={{ width: '100%', maxWidth: 420, height: 40, padding: '0 14px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', marginBottom: 18, boxSizing: 'border-box' }} />
          <div className="nx-card" style={{ background: 'var(--surface)', borderRadius: 18, boxShadow: '0 2px 8px rgba(140,148,160,0.18)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="nx-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead style={{ backgroundColor: 'var(--surface-2)' }}>
                  <tr>{['Name', 'User Code', 'Designation', 'Role', 'Reports To', ...(showStats ? ['Leads', 'Closures'] : [])].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {visible.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--surface-2)' }}>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={avatar}>{(m.name || '?')[0].toUpperCase()}</div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
                            {m.email && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.email}</div>}
                          </div>
                          {m._isMe && <span className="nx-badge" style={directBadge}>YOU</span>}
                        </div>
                      </td>
                      <td style={{ ...td, color: 'var(--muted)', fontFamily: 'monospace' }}>{m.user_code || '—'}</td>
                      <td style={td}><span style={chip}>{m.designation || '—'}</span></td>
                      <td style={{ ...td, color: 'var(--text-3)' }}>{m.role || '—'}</td>
                      <td style={{ ...td, color: 'var(--text-3)' }}>{m.reporting_manager || '—'}</td>
                      {showStats && <td style={{ ...td, fontWeight: 700, color: 'var(--accent)' }}>{m.leads}</td>}
                      {showStats && <td style={{ ...td, fontWeight: 700, color: 'var(--success)' }}>{m.closures}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        .org-tree { width: max-content; margin: 0 auto; text-align: center; }
        .org-tree ul { padding-top: 28px; position: relative; display: flex; justify-content: center; margin: 0; list-style: none; }
        .org-tree li { list-style: none; position: relative; padding: 28px 11px 0; text-align: center; }
        .org-tree li::before, .org-tree li::after { content: ''; position: absolute; top: 0; right: 50%; width: 50%; height: 28px; border-top: 1.5px solid var(--border-strong); }
        .org-tree li::after { right: auto; left: 50%; border-left: 1.5px solid var(--border-strong); }
        .org-tree li:only-child::before, .org-tree li:only-child::after { display: none; }
        .org-tree li:only-child { padding-top: 0; }
        .org-tree li:first-child::before, .org-tree li:last-child::after { border: 0 none; }
        .org-tree li:last-child::before { border-right: 1.5px solid var(--border-strong); border-radius: 0 8px 0 0; }
        .org-tree li:first-child::after { border-radius: 8px 0 0 0; }
        .org-tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; width: 0; height: 28px; border-left: 1.5px solid var(--border-strong); }
        .org-card { position: relative; display: inline-block; width: 196px; box-sizing: border-box; padding: 14px 16px 12px; border-radius: 12px; background: var(--surface); border: 1px solid var(--surface-3); box-shadow: 0 6px 20px rgba(110,114,120,0.12); transition: transform .15s ease, box-shadow .15s ease; cursor: default; }
        .org-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(110,114,120,0.22); }
        .org-card-top { position: absolute; top: 0; left: 16px; right: 16px; height: 3px; border-radius: 0 0 4px 4px; }
        .org-avatar { width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; }
      `}</style>
    </div>
  );
}

function sortSiblings(arr) {
  const rank = (d = '') => {
    d = d.toLowerCase();
    if (d.includes('director') || d.includes('chief') || ['cmo', 'cao', 'cfo', 'ceo'].some((t) => d.includes(t))) return -1;
    if (d.includes('head') || d.includes('manager') || d.includes('coordinator')) return 0;
    if (d.includes('stm') || d.includes('sales'))   return 1;
    if (d.includes('cp')  || d.includes('channel')) return 2;
    if (d.includes('telecaller') || d.includes('pre-sale')) return 3;
    return 4;
  };
  return [...arr].sort((a, b) =>
    rank(a.designation) - rank(b.designation) ||
    (a.designation || '').localeCompare(b.designation || '') ||
    (a.name || '').localeCompare(b.name || ''));
}

function accentFor(node) {
  const d = (node.designation || '').toLowerCase();
  if (node._root)                                         return 'var(--accent)';
  if (d.includes('telecaller') || d.includes('pre-sale')) return 'var(--accent-deep)';
  if (d.includes('cp ') || d.includes('channel'))         return 'var(--warning)';
  if (d.includes('stm') || d.includes('sales'))           return 'var(--accent)';
  if (d.includes('market'))                               return 'var(--danger)';
  if (d.includes('account') || d.includes('finance'))     return 'var(--success)';
  if (isManagerRole(node))                            return 'var(--accent)';
  return 'var(--text-3)';
}

function OrgNode({ node, showStats }) {
  const root = node._root;
  const c = accentFor(node);
  return (
    <li>
      <div className="org-card" style={{ '--accent': c }}>
        <span className="org-card-top" style={{ background: c }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="org-avatar" style={{ background: root ? `linear-gradient(135deg,${c},var(--strong))` : `color-mix(in srgb, ${c} 9%, transparent)`, color: root ? '#fff' : c }}>
            {(node.name || '?')[0].toUpperCase()}
          </div>
          <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name || '—'}</div>
              {node._isMe && !root && <span className="nx-badge" style={{ fontSize: 8, fontWeight: 800, color: '#fff', background: 'var(--primary)', padding: '1px 5px', borderRadius: 20 }}>YOU</span>}
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: c, lineHeight: 1.25 }}>
              {node.designation || node.role || '—'}
            </div>
          </div>
        </div>
        {(node._isMe || (showStats && node.leads != null)) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--surface-3)' }}>
            {node._isMe ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>You · {node.role || ''}</span>
            ) : (
              <>
                <span className="nx-badge" style={pill}>{node.leads} leads</span>
                <span className="nx-badge" style={{ ...pill, color: 'var(--success)', background: 'var(--success-soft)' }}>{node.closures} closed</span>
              </>
            )}
          </div>
        )}
      </div>
      {node.children?.length > 0 && <ul>{node.children.map((c2) => <OrgNode key={c2.id} node={c2} showStats={showStats} />)}</ul>}
    </li>
  );
}

const pill = { fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-softer)', padding: '2px 7px', borderRadius: 20 };
const th   = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '10px 14px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td   = { padding: '11px 14px', fontSize: 13, color: 'var(--text)' };
const chip = { fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-softer)', padding: '3px 9px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.3 };
const avatar = { width: 30, height: 30, borderRadius: 9, background: 'var(--accent-softer)', color: 'var(--accent)', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const directBadge = { fontSize: 10, fontWeight: 700, color: 'var(--success)', background: 'var(--success-soft)', padding: '2px 7px', borderRadius: 20 };
