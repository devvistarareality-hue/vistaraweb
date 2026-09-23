'use client';
import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, X, Check, LayoutDashboard, ListChecks, Menu as MenuIcon, Eye } from 'lucide-react';
import { DESIGNATION_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';

// What a designation may do, per company. The vocabulary comes from the server; the
// ticks are this company's own answer, so the same title can mean different things
// elsewhere. Three tabs rather than one long scroll: what they do, what they see,
// and where they land.
const TABS = [
  { key: 'actions', label: 'Actions', icon: ListChecks },
  { key: 'menu', label: 'Menu', icon: MenuIcon },
  { key: 'view', label: 'Dashboard & records', icon: LayoutDashboard },
];

export default function PermissionsModal({ designation, onClose, onSaved }) {
  const [catalogue, setCatalogue] = useState(null);
  const [tab, setTab] = useState('actions');
  // An unconfigured designation starts ticked with what it already does today.
  const [caps, setCaps] = useState(new Set(designation.effective_capabilities || designation.capabilities || []));
  const [screens, setScreens] = useState(new Set(designation.effective_screens || designation.screens || []));
  const [scope, setScope] = useState(designation.data_scope || '');
  const [dash, setDash] = useState(designation.dashboard || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiFetch(DESIGNATION_ENDPOINTS.capabilities)
      .then((r) => r.json()).then(setCatalogue)
      .catch(() => setErr('Could not load the permission list.'));
  }, []);

  const flip = (setter) => (key) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggle = flip(setCaps);
  const toggleScreen = flip(setScreens);

  async function save() {
    setSaving(true); setErr('');
    try {
      const r = await apiFetch(DESIGNATION_ENDPOINTS.detail(designation.id), {
        method: 'PATCH',
        body: JSON.stringify({ capabilities: [...caps], screens: [...screens], data_scope: scope, dashboard: dash }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.detail || d.capabilities || d.screens || 'Could not save.'); return; }
      onSaved?.(d);
      onClose();
    } catch {
      setErr('Could not save. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  const group = (rows) => {
    const mods = [...new Set((rows || []).map((c) => c.module))];
    return mods.map((m) => ({ module: m, items: rows.filter((c) => c.module === m) }));
  };
  const byModule = useMemo(() => group(catalogue?.capabilities), [catalogue]);
  const screensByModule = useMemo(() => group(catalogue?.screens), [catalogue]);

  const scopeLabel = (catalogue?.scopes || []).find((s) => s.value === scope)?.label || '';
  const dashLabel = (catalogue?.dashboards || []).find((d) => d.value === dash)?.label || '';

  return (
    <div className="ar-backdrop" onClick={() => !saving && onClose()}>
      <div className="nx-card nx-modal perm-modal" onClick={(e) => e.stopPropagation()}>
        <header className="perm-head">
          <span className="perm-head-icon"><ShieldCheck size={18} /></span>
          <div className="perm-head-text">
            <h2>{designation.name}</h2>
            <p>{designation.module} · {designation.company_name || 'this company'}</p>
          </div>
          <button type="button" className="perm-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        {!designation.capabilities_set && (
          <p className="perm-hint">Ticked with what this title already allows today. Saving makes it explicit for this company.</p>
        )}
        {err && <div className="nx-note bad">{String(err)}</div>}

        <nav className="perm-tabs">
          {TABS.map((t) => (
            <button type="button" key={t.key} onClick={() => setTab(t.key)}
              className={`perm-tab${tab === t.key ? ' is-on' : ''}`}>
              <t.icon size={15} /> {t.label}
              {t.key !== 'view' && <span className="perm-tab-n">{t.key === 'actions' ? caps.size : screens.size}</span>}
            </button>
          ))}
        </nav>

        <div className="perm-body">
          {!catalogue ? <div className="act-empty">Loading…</div> : tab === 'actions' ? (
            <>
              <div className="perm-presets">
                <span>Start from</span>
                {catalogue.presets.map((p) => (
                  <button type="button" key={p.key} className="perm-preset"
                    onClick={() => { setCaps(new Set(p.capabilities)); setScreens(new Set(p.screens || [])); }}>
                    {p.label}
                  </button>
                ))}
              </div>
              {byModule.map(({ module, items }) => {
                const on = items.filter((c) => caps.has(c.key)).length;
                const allOn = on === items.length;
                return (
                  <section className="perm-card" key={module}>
                    <div className="perm-card-head">
                      <h3>{module}</h3>
                      <span className="perm-count">{on} of {items.length}</span>
                      <button type="button" className="perm-all" onClick={() => setCaps((prev) => {
                        const next = new Set(prev);
                        items.forEach((c) => (allOn ? next.delete(c.key) : next.add(c.key)));
                        return next;
                      })}>{allOn ? 'Clear' : 'All'}</button>
                    </div>
                    {items.map((c) => (
                      <label className={`perm-row${caps.has(c.key) ? ' is-on' : ''}`} key={c.key}>
                        <span className="perm-text">
                          <b>{c.label}</b>
                          <small>{c.help}</small>
                        </span>
                        <input type="checkbox" checked={caps.has(c.key)} onChange={() => toggle(c.key)} />
                        <span className="perm-switch" aria-hidden="true" />
                      </label>
                    ))}
                  </section>
                );
              })}
            </>
          ) : tab === 'menu' ? (
            <>
              <p className="perm-lead">Tap a screen to show or hide it for this designation.</p>
              {screensByModule.map(({ module, items }) => (
                <section className="perm-card" key={module}>
                  <div className="perm-card-head">
                    <h3>{module}</h3>
                    <span className="perm-count">{items.filter((c) => screens.has(c.key)).length} of {items.length}</span>
                  </div>
                  <div className="perm-chips">
                    {items.map((c) => (
                      <button type="button" key={c.key} onClick={() => toggleScreen(c.key)}
                        className={`perm-chip${screens.has(c.key) ? ' is-on' : ''}`}>
                        {screens.has(c.key) && <Check size={13} />} {c.label}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </>
          ) : (
            <>
              <section className="perm-card">
                <div className="perm-card-head"><h3><LayoutDashboard size={15} /> Which dashboard opens</h3></div>
                <div className="perm-radios">
                  {(catalogue.dashboards || []).map((d) => (
                    <label className={`perm-radio${dash === d.value ? ' is-on' : ''}`} key={d.value || 'auto'}>
                      <input type="radio" name="dash" checked={dash === d.value} onChange={() => setDash(d.value)} />
                      <span><b>{d.label}</b>{d.module ? <small>{d.module}</small> : null}</span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="perm-card">
                <div className="perm-card-head"><h3><Eye size={15} /> Whose records they see</h3></div>
                <div className="perm-radios">
                  {(catalogue.scopes || []).map((sc) => (
                    <label className={`perm-radio${scope === sc.value ? ' is-on' : ''}`} key={sc.value || 'default'}>
                      <input type="radio" name="scope" checked={scope === sc.value} onChange={() => setScope(sc.value)} />
                      <span><b>{sc.label}</b></span>
                    </label>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="perm-foot">
          <p className="perm-summary">
            {caps.size} action{caps.size === 1 ? '' : 's'} · {screens.size} screen{screens.size === 1 ? '' : 's'}
            {dash ? ` · ${dashLabel.split(' —')[0]}` : ''}{scope ? ` · ${scopeLabel}` : ''}
          </p>
          <div className="perm-foot-btns">
            <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="nx-btn nx-btn-md nx-btn-primary" onClick={save} disabled={saving || !catalogue}>
              {saving ? 'Saving…' : 'Save permissions'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
