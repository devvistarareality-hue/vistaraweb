'use client';
import { useEffect, useState } from 'react';
import { SALES_ENDPOINTS, authHeaders } from '../constants/api';
import Loader from './Loader';

// Add Lead, step 1: the number first. Every lead already on that number is listed
// project by project, with who holds it on each side (telecaller / STM) and where
// each stands. Picking one works on THAT lead (the form opens on its project, and
// saving updates it — see LeadListView.post's merge path); "Add in another project",
// or a number nobody has, opens the empty form. Mirrored in the app.
const pretty = (s) => (s ? s.replace(/_/g, ' ') : '');

export default function LeadNumberCheck({ initialPhone = '', onPick, onNew }) {
  const [phone, setPhone] = useState(initialPhone);
  const [rows, setRows] = useState(null);     // null = not looked up yet
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, '');

  useEffect(() => {
    setRows(null);
    if (digits.length < 10) return undefined;
    let alive = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`${SALES_ENDPOINTS.leadSearch}?search=${digits.slice(-10)}`, { headers: authHeaders() });
        const list = res.ok ? await res.json() : [];
        if (!alive) return;
        const sorted = (Array.isArray(list) ? list : [])
          .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || ''));
        setRows(sorted);
      } catch { if (alive) setRows([]); }
      if (alive) setBusy(false);
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [digits]);

  return (
    <div className="lnc">
      <label className="lnc-label" htmlFor="lnc-phone">Phone number</label>
      <input id="lnc-phone" className="nx-input lnc-input" autoFocus inputMode="tel" value={phone}
        onChange={(e) => setPhone(e.target.value)} placeholder="+91 99999 99999" />
      <p className="lnc-hint">We check this number first, so the same client is not added twice.</p>

      {busy && <Loader variant="inline" size="sm" label="Checking…" />}

      {!busy && rows && rows.length === 0 && (
        <div className="lnc-none">
          <p>No lead has this number yet.</p>
          <button type="button" className="nx-btn nx-btn-md nx-btn-primary" onClick={() => onNew(phone)}>Continue</button>
        </div>
      )}

      {!busy && rows && rows.length > 0 && (
        <>
          <p className="lnc-found">This number already has {rows.length} lead{rows.length === 1 ? '' : 's'}. Pick one to work on it, or add it to another project.</p>
          <div className="lnc-list">
            {rows.map((r) => {
              const closed = ['closed', 'lost'].includes(r.status);
              return (
                <button type="button" key={r.id} className={`lnc-row${closed ? ' is-closed' : ''}`} onClick={() => onPick(r)}>
                  <span className="lnc-proj">{r.project_name || 'No project'}{r.is_cp ? ' · CP' : ''}</span>
                  <span className="lnc-name">{r.name}</span>
                  <span className="lnc-side">
                    <b>Telecaller:</b> {r.telecaller_name ? `${r.telecaller_name}${r.telecaller_status ? ` · ${pretty(r.telecaller_status)}` : ''}` : 'None assigned'}
                  </span>
                  <span className="lnc-side">
                    <b>{r.is_cp ? 'CP' : 'STM'}:</b> {r.stm_name ? `${r.stm_name}${r.stm_status ? ` · ${pretty(r.stm_status)}` : ''}` : 'None assigned'}
                  </span>
                  <span className="lnc-status">{closed ? `${pretty(r.status)} — picking it starts a new lead` : pretty(r.status)}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="nx-btn nx-btn-md nx-btn-secondary lnc-new" onClick={() => onNew(phone)}>
            Add in another project
          </button>
        </>
      )}
    </div>
  );
}
