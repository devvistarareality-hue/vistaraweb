'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Copy, Check } from 'lucide-react';
import { ROLE_DASHBOARD_ENDPOINT } from '../constants/api';
import { apiFetch } from '../utils/apiFetch';
import { notify } from '../lib/notify';

// The role filter that sits on top of a module's Dashboard. It answers one
// question — what does each role open here? — so picking a role shows exactly
// what someone at that level sees. The Copy button hands the dashboard you are
// looking at to another role, and the chips move with it: copy Manager onto
// Employee and the Employee chip then opens the manager's desk. Designation
// Master → Permissions still pins one to a single designation, and that pin wins.
//
// None of this changes what the figures count: every list is scoped to the
// signed-in person by role and the reporting tree.
export default function DashboardRoleFilter({ options, value, onChange, module, roles }) {
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [copying, setCopying] = useState(false);
  const [picked, setPicked] = useState([]);
  const [given, setGiven] = useState({});   // role → the dashboard it was handed
  const [role, setRole] = useState('');     // the role being previewed; '' is mine

  // What each role opens today. Without this the chips would only ever show the
  // dashboard originally built for a role, so a copy looked like it did nothing.
  useEffect(() => {
    if (!module) return undefined;
    let alive = true;
    const q = `?module=${encodeURIComponent(module)}${companyId ? `&company_id=${companyId}` : ''}`;
    apiFetch(ROLE_DASHBOARD_ENDPOINT() + q)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (alive) setGiven(Object.fromEntries((rows || []).map((r) => [r.role, r.view])));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [module, companyId]);

  // The dashboards this module has, grouped by the role they were built for.
  const byRole = useMemo(() => {
    const m = new Map();
    for (const o of options || []) {
      if (!o.role) continue;
      if (!m.has(o.role)) m.set(o.role, []);
      m.get(o.role).push(o);
    }
    return m;
  }, [options]);

  const roleList = roles || [...byRole.keys()];
  if (!options?.length) return null;

  // A role opens what it was given, or failing that the dashboard built for it.
  const viewFor = (r) => given[r] || byRole.get(r)?.[0]?.key || '';
  const labelOf = (key) => options.find((o) => o.key === key)?.label || '';
  const current = options.find((o) => o.key === value);
  // Sales has two dashboards for Employee (the call queue and the executive's own
  // pipeline). When a role has more than one, offer the choice rather than
  // silently previewing the first.
  const choices = role ? (byRole.get(role) || []) : [];

  function pickRole(r) {
    setRole(r);
    onChange(r ? viewFor(r) : '');
  }

  async function copy() {
    if (!picked.length || !current) return;
    const r = await apiFetch(ROLE_DASHBOARD_ENDPOINT(), {
      method: 'POST',
      body: JSON.stringify({ module, view: current.key, roles: picked, ...(companyId ? { company_id: companyId } : {}) }),
    }).catch(() => null);
    if (!r || !r.ok) { notify('Could not copy that dashboard.', 'error'); return; }
    // Show it straight away, so the chips agree with what was just saved.
    setGiven((g) => ({ ...g, ...Object.fromEntries(picked.map((x) => [x, current.key])) }));
    notify(`${current.label || current.key} is now what ${picked.join(' and ')} opens.`);
    setCopying(false); setPicked([]);
  }

  return (
    <div className="dbf">
      <span className="dbf-lead">Role</span>
      <button type="button" onClick={() => pickRole('')}
        className={`nx-btn nx-btn-sm nx-toggle${role ? '' : ' is-on'}`}>Mine</button>
      {roleList.map((r) => (
        <button type="button" key={r} onClick={() => pickRole(r)}
          className={`nx-btn nx-btn-sm nx-toggle${role === r ? ' is-on' : ''}`}>
          {r}
          {given[r] ? <small className="dbf-role">{labelOf(given[r])}</small> : null}
        </button>
      ))}

      {choices.length > 1 ? (
        <>
          <span className="dbf-lead">Dashboard</span>
          {choices.map((o) => (
            <button type="button" key={o.key} onClick={() => onChange(o.key)}
              className={`nx-btn nx-btn-sm nx-toggle${value === o.key ? ' is-on' : ''}`}>{o.label}</button>
          ))}
        </>
      ) : null}

      {module && current ? (
        copying ? (
          <span className="dbf-copy">
            <span>Give this to</span>
            {roleList.map((r) => (
              <button type="button" key={r} onClick={() => setPicked((p) => (
                p.includes(r) ? p.filter((x) => x !== r) : [...p, r]))}
                className={`nx-btn nx-btn-sm nx-toggle${picked.includes(r) ? ' is-on' : ''}`}>
                {picked.includes(r) ? <Check size={12} /> : null} {r}
              </button>
            ))}
            <button type="button" className="nx-btn nx-btn-sm nx-btn-primary" disabled={!picked.length} onClick={copy}>Copy</button>
            <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => { setCopying(false); setPicked([]); }}>Cancel</button>
          </span>
        ) : (
          <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary dbf-copybtn" onClick={() => setCopying(true)}>
            <Copy size={13} /> Copy to role
          </button>
        )
      ) : null}
    </div>
  );
}
