'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

/**
 * Modern dropdown: a pill button that opens a floating list, with optional search.
 * Keyboard: Enter/Space/↓ opens, ↑/↓ move, Enter picks, Esc closes.
 *
 *   <Dropdown value={project} onChange={setProject} icon={<Building2 size={15} />}
 *     options={[{ value: '', label: 'All projects' }, …]} searchable />
 */
export default function Dropdown({ value, onChange, options, icon, placeholder = 'Select', searchable, align = 'left', className = '', ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const selected = options.find((o) => String(o.value) === String(value));
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => String(o.label).toLowerCase().includes(n)) : options;
  }, [options, q]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  useEffect(() => { if (open) { setQ(''); setHi(Math.max(0, options.findIndex((o) => String(o.value) === String(value)))); } }, [open]);

  const pick = (o) => { onChange(o.value); setOpen(false); };
  const onKey = (e) => {
    if (!open && ['Enter', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(shown.length - 1, h + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    if (e.key === 'Enter' && shown[hi]) { e.preventDefault(); pick(shown[hi]); }
  };

  const active = value !== '' && value != null;
  return (
    <div className={`nx-dd ${className}`} ref={ref} onKeyDown={onKey}>
      <button type="button" className={`nx-dd-btn${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={() => setOpen((o) => !o)}>
        {icon ? <span className="nx-dd-icon">{icon}</span> : null}
        <span className="nx-dd-label">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={15} className="nx-dd-chev" />
      </button>
      {open && (
        <div className={`nx-dd-menu ${align === 'right' ? 'right' : ''}`} role="listbox">
          {searchable && (
            <div className="nx-dd-search">
              <Search size={14} />
              <input autoFocus value={q} placeholder="Search…" onChange={(e) => { setQ(e.target.value); setHi(0); }} />
            </div>
          )}
          <div className="nx-dd-list">
            {shown.length === 0 && <div className="nx-dd-empty">No matches</div>}
            {shown.map((o, i) => {
              const on = String(o.value) === String(value);
              return (
                <button type="button" key={String(o.value)} role="option" aria-selected={on}
                  className={`nx-dd-opt${on ? ' is-on' : ''}${i === hi ? ' is-hi' : ''}`}
                  onMouseEnter={() => setHi(i)} onClick={() => pick(o)}>
                  <span className="nx-dd-opt-label">{o.label}</span>
                  {o.hint != null && <span className="nx-dd-hint">{o.hint}</span>}
                  {on && <Check size={15} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
