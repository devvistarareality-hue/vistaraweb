'use client';
import Icon from './Icon';

// A project's standard unit types — [{type, plot_area, const_area}] — edited as rows.
// Used twice on the project form: EOI Unit Types (before plots exist) and LOI Unit
// Types (a new LOI, or an EOI converted to LOI). Picking a type on the booking form
// fills the areas from the row. `noPlotArea`: the LOI list has no Plot Area — on an
// LOI the plot is real, and its area is the one fixed when the project was mapped.
export default function UnitTypesEditor({ title, hint, value, onChange, copyFrom, copyLabel, noPlotArea = false }) {
  const rows = value || [];
  const set = (next) => onChange(next);
  const update = (i, k, v) => set(rows.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)));
  const canCopy = (copyFrom || []).some((t) => (t.type || '').trim());
  return (
    <div className="ut-box">
      <div className="ut-title">{title}</div>
      <p className="ut-hint">{hint}</p>
      {rows.length > 0 && (
        <div className={`ut-row ut-head${noPlotArea ? ' ut-row-2' : ''}`}>
          <span>Type</span>{!noPlotArea && <span>Plot Area</span>}<span>Const. Area</span><span />
        </div>
      )}
      {rows.map((t, i) => (
        <div key={i} className={`ut-row${noPlotArea ? ' ut-row-2' : ''}`}>
          <input className="nx-input" value={t.type} onChange={(e) => update(i, 'type', e.target.value)} placeholder="e.g. 2 BHK" />
          {!noPlotArea && <input className="nx-input" value={t.plot_area} onChange={(e) => update(i, 'plot_area', e.target.value)} placeholder="585" />}
          <input className="nx-input" value={t.const_area} onChange={(e) => update(i, 'const_area', e.target.value)} placeholder="167" />
          <button className="nx-btn nx-btn-sm nx-icon-btn nx-btn-ghost ut-remove" type="button" aria-label="Remove"
            onClick={() => set(rows.filter((_, idx) => idx !== i))}><Icon name="x" /></button>
        </div>
      ))}
      <div className="ut-actions">
        <button className="nx-btn nx-btn-sm nx-btn-secondary ut-add" type="button"
          onClick={() => set([...rows, noPlotArea ? { type: '', const_area: '' } : { type: '', plot_area: '', const_area: '' }])}>+ Add Unit Type</button>
        {canCopy && (
          <button className="nx-btn nx-btn-sm nx-btn-secondary ut-add" type="button"
            onClick={() => set((copyFrom || []).filter((t) => (t.type || '').trim())
              .map((t) => (noPlotArea ? { type: t.type, const_area: t.const_area } : { ...t })))}>
            {copyLabel || 'Copy from EOI'}
          </button>
        )}
      </div>
    </div>
  );
}

// The unit types worth saving (a row with no type name is a blank one left behind).
export const cleanUnitTypes = (rows) => (rows || []).filter((t) => (t.type || '').trim());
