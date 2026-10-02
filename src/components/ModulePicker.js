'use client';
import { GROUPS } from '../lib/moduleGroups';

// Departments that hold modules (Administration holds pages, not modules).
const DEPTS = GROUPS.filter((g) => g.parts.some((p) => p.module));

// Module access checkboxes, grouped by department the way the home screen is
// (lib/moduleGroups). Access is still granted per module — this only lays them out.
export default function ModulePicker({ selected = [], onToggle }) {
  return (
    <div className="mp">
      {DEPTS.map((g) => (
        <div key={g.key} className="mp-row">
          <div className="mp-dept">{g.title}</div>
          <div className="mp-mods">
            {g.parts.filter((p) => p.module).map((p) => {
              const on = selected.includes(p.module);
              return (
                <label key={p.module} className={`mp-mod${on ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => onToggle(p.module)} />
                  {p.title}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
