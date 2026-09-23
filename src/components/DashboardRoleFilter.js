'use client';

// The role filter that sits on top of a module's Dashboard. Each module lists
// the dashboards it has — one per role level — and an admin flips between them
// to see what each role will get. Designation Master → Permissions is where a
// dashboard is then pinned to a designation; this only changes what you are
// looking at, never what the figures count (those stay scoped by the reporting
// tree, for whoever is signed in).
export default function DashboardRoleFilter({ options, value, onChange }) {
  if (!options?.length) return null;
  return (
    <div className="dbf">
      <span className="dbf-lead">Role</span>
      <button type="button" onClick={() => onChange('')}
        className={`nx-btn nx-btn-sm nx-toggle${value ? '' : ' is-on'}`}>Mine</button>
      {options.map((o) => (
        <button type="button" key={o.key} onClick={() => onChange(o.key)}
          className={`nx-btn nx-btn-sm nx-toggle${value === o.key ? ' is-on' : ''}`}>
          {o.label}
          <small className="dbf-role">{o.role}</small>
        </button>
      ))}
    </div>
  );
}
