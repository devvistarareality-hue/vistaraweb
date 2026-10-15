'use client';
// Which notifications a designation (or one person) gets — the Notifications tab of
// Designation Master's permissions, and the per-person override in User Management.
// The list of kinds comes from the server (accounts/notification_prefs.py), so web,
// app and the sender agree. Per kind: Push (bell + phone) / In-app (bell only) / Off;
// team alerts also choose how many levels up they go and whether they come as one
// morning summary instead. Nothing set = as before (Push, all levels).
//
// `inherit` (person mode): the designation's settings. Each row then also offers
// "Default", which follows the designation — the person's value is only kept when it
// differs on purpose.
import { useMemo } from 'react';
import { GROUPS } from '../lib/moduleGroups';

const MODES = [['push', 'Push'], ['inapp', 'In-app'], ['off', 'Off']];
// Each module's display name, as on the home screen (AR → "Accounts Receivable").
const MODULE_TITLE = Object.fromEntries(GROUPS.flatMap((g) => g.parts.filter((p) => p.module).map((p) => [p.module, p.title])));
const LEVELS = [1, 2, 3, 4, 5];

// `modules`: the modules this designation's menu answers for (or the person's modules);
// only their notifications are listed, a section per module. Channel Partner shares
// the Sales notifications. Left out → every module.
export default function NotificationPrefsEditor({ kinds = [], presets = [], fallback, value, onChange, inherit = null, inheritLabel = 'the designation', modules = null }) {
  const base = fallback || { mode: 'push', levels: 5, digest: false };
  const groups = useMemo(() => {
    const has = (m) => !modules || modules.includes(m) || (m === 'Sales' && modules.includes('Channel Partner'));
    const out = [];
    kinds.filter((k) => has(k.module || 'Sales')).forEach((k) => {
      const m = k.module || 'Sales';
      let g = out.find((x) => x.module === m);
      if (!g) { g = { module: m, name: MODULE_TITLE[m] || m, items: [] }; out.push(g); }
      g.items.push(k);
    });
    return out;
  }, [kinds, modules]);

  const personMode = inherit !== null;
  const own = (k) => (value || {})[k];
  const fromDesig = (k) => ({ ...base, ...((inherit || {})[k] || {}) });
  const effective = (k) => ({ ...(personMode ? fromDesig(k) : base), ...(own(k) || {}) });

  const set = (k, patch) => onChange({ ...(value || {}), [k]: { ...effective(k), ...patch } });
  const clearOne = (k) => { const next = { ...(value || {}) }; delete next[k]; onChange(next); };
  const modeLabel = (m) => (MODES.find(([v]) => v === m) || [m, m])[1];

  return (
    <div className="np">
      {!personMode && presets.length > 0 && groups.some((g) => g.items.some((k) => k.team)) && (
        <div className="np-presets">
          <span>Start from</span>
          {presets.map((p) => (
            <button type="button" key={p.key} className="np-preset" onClick={() => onChange({ ...p.prefs })}>{p.label}</button>
          ))}
        </div>
      )}
      {!groups.length && <div className="nx-note info">No notifications belong to the modules in this menu.</div>}
      {groups.map((g) => (
        <section className="np-group" key={g.module}>
          <h3>{g.name}</h3>
          {g.items.map((k, idx) => {
            // Sub-headings only where a module has more than one kind of alert (Sales).
            const newSub = new Set(g.items.map((x) => x.group)).size > 1 && (idx === 0 || g.items[idx - 1].group !== k.group);
            const e = effective(k.key);
            const isDefault = personMode && !own(k.key);
            return (
              <div key={k.key} className="np-wrap">
              {newSub && <div className="np-sub">{k.group}</div>}
              <div className={`np-row${e.mode === 'off' ? ' is-off' : ''}${k.team ? ' has-team' : ''}`}>
                <div className="np-text">
                  <b>{k.label}{k.team && <em className="np-team">team</em>}</b>
                  <small>{k.help}</small>
                  {personMode && (
                    <small className="np-inherit">
                      {isDefault ? `Following ${inheritLabel}: ${modeLabel(fromDesig(k.key).mode)}` : 'Set for this person'}
                    </small>
                  )}
                </div>
                <div className="np-ctrls">
                  <div className="np-seg" role="group" aria-label={k.label}>
                    {personMode && (
                      <button type="button" className={isDefault ? 'is-on' : ''} onClick={() => clearOne(k.key)}>Default</button>
                    )}
                    {MODES.map(([m, label]) => (
                      <button type="button" key={m} className={!isDefault && e.mode === m ? 'is-on' : ''}
                        onClick={() => set(k.key, { mode: m })}>{label}</button>
                    ))}
                  </div>
                </div>
                  {k.team && e.mode !== 'off' && (
                    <div className="np-team-ctrls np-team-line">
                      <label className="np-levels">
                        <span>Levels up</span>
                        <select className="nx-input" value={e.levels || 5} disabled={isDefault}
                          onChange={(ev) => set(k.key, { levels: Number(ev.target.value) })}>
                          {LEVELS.map((n) => <option key={n} value={n}>{n === 1 ? '1 — direct manager' : n}</option>)}
                        </select>
                      </label>
                      <label className={`np-digest${e.digest ? ' is-on' : ''}`}>
                        <input type="checkbox" checked={!!e.digest} disabled={isDefault}
                          onChange={(ev) => set(k.key, { digest: ev.target.checked })} />
                        <span>Morning summary instead</span>
                      </label>
                    </div>
                  )}
              </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
