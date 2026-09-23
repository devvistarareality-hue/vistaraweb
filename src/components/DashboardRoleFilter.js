'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { ROLE_DASHBOARD_ENDPOINT } from '../constants/api';
import { apiFetch } from '../utils/apiFetch';
import { notify } from '../lib/notify';

// The role filter that sits on top of a module's Dashboard. Each module lists
// the dashboards it has — one per role level — and an admin flips between them
// to see what each role will get. The Copy button hands the dashboard you are
// looking at to another role, so a General Manager can open the same one as a
// Manager. Designation Master → Permissions pins it to a designation.
//
// None of this changes what the figures count: every list is scoped to the
// signed-in person by role and the reporting tree.
export default function DashboardRoleFilter({ options, value, onChange, module, roles }) {
  const [copying, setCopying] = useState(false);
  const [picked, setPicked] = useState([]);
  if (!options?.length) return null;

  const roleList = roles || [...new Set(options.map((o) => o.role).filter(Boolean))];
  const current = options.find((o) => o.key === value);

  async function copy() {
    if (!picked.length || !current) return;
    const r = await apiFetch(ROLE_DASHBOARD_ENDPOINT(), {
      method: 'POST',
      body: JSON.stringify({ module, view: current.key, roles: picked }),
    }).catch(() => null);
    if (!r || !r.ok) { notify('Could not copy that dashboard.', 'error'); return; }
    notify(`${current.label || current.key} is now what ${picked.join(' and ')} opens.`);
    setCopying(false); setPicked([]);
  }

  return (
    <div className="dbf">
      <span className="dbf-lead">Role</span>
      <button type="button" onClick={() => onChange('')}
        className={`nx-btn nx-btn-sm nx-toggle${value ? '' : ' is-on'}`}>Mine</button>
      {options.map((o) => (
        <button type="button" key={o.key} onClick={() => onChange(o.key)}
          className={`nx-btn nx-btn-sm nx-toggle${value === o.key ? ' is-on' : ''}`}>
          {o.label}
          {o.role && o.label !== o.role ? <small className="dbf-role">{o.role}</small> : null}
        </button>
      ))}

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
