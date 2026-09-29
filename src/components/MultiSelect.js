'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

/**
 * Multi-select filter — the Dropdown's look (pill button, floating list, search),
 * but ticks several. `value` is an array of option values; empty means "all".
 *
 *   <MultiSelect allLabel="All Projects" noun="projects" value={projects} onChange={setProjects}
 *     options={[{ value: '12', label: 'Kalrav' }, …]} />
 *
 * The button reads "All Projects", the one name picked, or "3 projects".
 */
export default function MultiSelect({ value = [], onChange, options, allLabel = 'All', noun = 'selected',
  searchable = true, align = 'left', className = '', ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const picked = useMemo(() => new Set((value || []).map(String)), [value]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => String(o.label).toLowerCase().includes(n)) : options;
  }, [options, q]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  useEffect(() => { if (open) setQ(''); }, [open]);

  const toggle = (v) => {
    const k = String(v);
    const next = picked.has(k) ? [...picked].filter((x) => x !== k) : [...picked, k];
    onChange(next);
  };
  const label = picked.size === 0 ? allLabel
    : picked.size === 1 ? (options.find((o) => picked.has(String(o.value)))?.label ?? `1 ${noun}`)
    : `${picked.size} ${noun}`;

  return (
    <div className={`nx-dd ${className}`} ref={ref}>
      <button type="button" className={`nx-dd-btn${picked.size ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel || allLabel} onClick={() => setOpen((o) => !o)}>
        <span className="nx-dd-label">{label}</span>
        <ChevronDown size={15} className="nx-dd-chev" />
      </button>
      {open && (
        <div className={`nx-dd-menu ${align === 'right' ? 'right' : ''}`} role="listbox" aria-multiselectable="true">
          {searchable && options.length > 6 && (
            <div className="nx-dd-search">
              <Search size={14} />
              <input autoFocus value={q} placeholder="Search…" onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          <div className="nx-dd-list">
            <button type="button" className={`nx-dd-opt${picked.size === 0 ? ' is-on' : ''}`} onClick={() => onChange([])}>
              <span className="nx-dd-opt-label">{allLabel}</span>
              {picked.size === 0 && <Check size={15} />}
            </button>
            {shown.length === 0 && <div className="nx-dd-empty">No matches</div>}
            {shown.map((o) => {
              const on = picked.has(String(o.value));
              return (
                <button type="button" key={String(o.value)} role="option" aria-selected={on}
                  className={`nx-dd-opt nx-ms-opt${on ? ' is-on' : ''}`} onClick={() => toggle(o.value)}>
                  <span className={`nx-ms-box${on ? ' is-on' : ''}`}>{on && <Check size={12} />}</span>
                  <span className="nx-dd-opt-label">{o.label}</span>
                  {o.hint != null && <span className="nx-dd-hint">{o.hint}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
