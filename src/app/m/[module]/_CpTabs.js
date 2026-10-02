'use client';
/**
 * The CP Leads / CP Details toggle, shared by the Channel Partner module's
 * screens.
 *
 * All Leads has had this pair since the directory landed; Site Visits and
 * Follow-Ups now carry the same one, because each of those also has two
 * audiences — the partner's leads, and the partner themselves. Same control in
 * the same place on every screen, so the split reads as one idea rather than
 * three different arrangements.
 *
 * All Leads still renders its own copy inline (legacy inline styles); this is
 * the version new screens use.
 */
const TABS = [
  { key: 'leads', label: 'CP Leads' },
  { key: 'details', label: 'CP Details' },
];

export default function CpTabs({ value, onChange }) {
  return (
    <div className="cpt-wrap">
      <div className="cpt-eyebrow">Channel Partner</div>
      <div className="cpt-pills" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={value === t.key}
            className={`cpt-pill${value === t.key ? ' is-on' : ''}`}
            onClick={() => onChange(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
