'use client';
/**
 * Pick one channel partner out of the directory.
 *
 * A plain <select> is the wrong control here: the directory runs to 588 partners
 * on VRL alone, and only 19 of them have any leads. So this types-to-filter over
 * the whole list, and offers the ones that HAVE leads first — filtering by a
 * partner with none can only ever produce an empty dashboard.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import Icon from '../../components/Icon';

export default function PartnerPicker({ partners, value, onChange, placeholder = 'All channel partners' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const boxRef = useRef(null);

  // Clicking away closes it; without this the list stays over the tiles.
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const selected = partners.find((p) => String(p.id) === String(value));

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (p) => !needle || [p.name, p.firm_name, p.contact_no]
      .some((f) => String(f || '').toLowerCase().includes(needle));
    const hits = partners.filter(match);
    // Partners with leads first — the rest can only ever return nothing.
    return [...hits].sort((a, b) => (b.lead_count || 0) - (a.lead_count || 0));
  }, [partners, q]);

  const pick = (id) => { onChange(id); setOpen(false); setQ(''); };

  return (
    <div className="cpp" ref={boxRef}>
      <button type="button" className="cpp-btn" onClick={() => setOpen((o) => !o)}>
        <span className={selected ? 'cpp-val' : 'cpp-ph'}>
          {selected ? (selected.name || selected.firm_name) : placeholder}
        </span>
        <span className="cpp-caret">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="cpp-menu">
          <input className="nx-input cpp-search" value={q} autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, firm or number…" />
          <button type="button" className="cpp-opt cpp-opt-all" onClick={() => pick('')}>
            {placeholder}
          </button>
          {shown.length === 0 ? (
            <div className="cpp-empty">No partner matches “{q}”.</div>
          ) : shown.slice(0, 80).map((p) => (
            <button type="button" key={p.id} className="cpp-opt" onClick={() => pick(String(p.id))}>
              <span className="cpp-opt-name">{p.name || '—'}</span>
              {p.firm_name ? <span className="cpp-opt-firm">{p.firm_name}</span> : null}
              {p.lead_count ? <span className="cpp-opt-count">{p.lead_count}</span> : null}
            </button>
          ))}
          {shown.length > 80 && (
            <div className="cpp-empty">{shown.length - 80} more — keep typing to narrow.</div>
          )}
        </div>
      )}

      {selected && (
        <button type="button" className="cpp-clear" onClick={() => pick('')} aria-label="Clear partner">
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}
