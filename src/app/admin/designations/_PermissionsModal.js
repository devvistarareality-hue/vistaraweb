'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { DESIGNATION_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';

// What a designation may do, per company. The list of capabilities comes from the
// server (a fixed vocabulary); the ticks are this company's own answer, so the same
// title can mean different things in two companies.
export default function PermissionsModal({ designation, onClose, onSaved }) {
  const [catalogue, setCatalogue] = useState(null);
  // An unconfigured designation starts ticked with what it already does today.
  const [caps, setCaps] = useState(new Set(designation.effective_capabilities || designation.capabilities || []));
  const [scope, setScope] = useState(designation.data_scope || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiFetch(DESIGNATION_ENDPOINTS.capabilities)
      .then((r) => r.json()).then(setCatalogue)
      .catch(() => setErr('Could not load the permission list.'));
  }, []);

  const toggle = (key) => setCaps((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  async function save() {
    setSaving(true); setErr('');
    try {
      const r = await apiFetch(DESIGNATION_ENDPOINTS.detail(designation.id), {
        method: 'PATCH',
        body: JSON.stringify({ capabilities: [...caps], data_scope: scope }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.detail || d.capabilities || 'Could not save.'); return; }
      onSaved?.(d);
      onClose();
    } catch {
      setErr('Could not save. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  const modules = catalogue
    ? [...new Set(catalogue.capabilities.map((c) => c.module))]
    : [];

  return (
    <div className="ar-backdrop" onClick={() => !saving && onClose()}>
      <div className="nx-card nx-modal perm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="perm-head">
          <div>
            <div className="ar-modal-title"><ShieldCheck size={17} /> {designation.name}</div>
            <div className="ar-modal-sub">What this designation may do in {designation.company_name || 'this company'}</div>
          </div>
          <button type="button" className="fu-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {err && <div className="nx-note bad">{String(err)}</div>}
        {!catalogue ? <div className="act-empty">Loading…</div> : (
          <>
            {!designation.capabilities_set && (
              <div className="nx-note info">Nobody has set this designation up yet, so it is ticked with what the title already allows today. Saving makes it explicit.</div>
            )}
            <div className="perm-presets">
              <span>Start from</span>
              {catalogue.presets.map((p) => (
                <button type="button" key={p.key} className="nx-btn nx-btn-sm nx-toggle"
                  onClick={() => setCaps(new Set(p.capabilities))}>{p.label}</button>
              ))}
            </div>

            {modules.map((mod) => (
              <div className="perm-group" key={mod}>
                <div className="perm-group-title">{mod}</div>
                {catalogue.capabilities.filter((c) => c.module === mod).map((c) => (
                  <label className={`perm-row${caps.has(c.key) ? ' is-on' : ''}`} key={c.key}>
                    <input type="checkbox" checked={caps.has(c.key)} onChange={() => toggle(c.key)} />
                    <span className="perm-label">{c.label}<small>{c.help}</small></span>
                  </label>
                ))}
              </div>
            ))}

            <div className="perm-group">
              <div className="perm-group-title">Whose records they see</div>
              <select className="nx-input" value={scope} onChange={(e) => setScope(e.target.value)}>
                {catalogue.scopes.map((sc) => <option key={sc.value} value={sc.value}>{sc.label}</option>)}
              </select>
            </div>

            <div className="ar-modal-foot">
              <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="button" className="nx-btn nx-btn-md nx-btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save permissions'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
