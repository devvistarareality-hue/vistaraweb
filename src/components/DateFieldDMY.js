'use client';
import { useRef, useState } from 'react';
import { formatDMY } from '../lib/dateFormat';

// Dates are typed, not fought with. A native <input type="date"> shows digits in
// the browser's own locale (MM/DD/YYYY on a US-locale machine) and that is browser
// chrome, so it cannot be restyled — the previous version hid it and painted a
// DD/MM/YYYY label on top, which read correctly but left nothing on screen while
// someone typed, so the field could only be filled from the picker.
//
// So: a plain text box that takes DD/MM/YYYY (slashes inserted as you go), plus a
// button opening the native picker for anyone who prefers to click. `value` in and
// out is still ISO yyyy-mm-dd, so every caller is unchanged.
const DateFieldDMY = ({ value, onChange, style, wrapperStyle, ...p }) => {
  const pickerRef = useRef(null);
  // While typing, what is on screen is the draft — a half-finished "02/09" is not a
  // date and must not be committed. `null` means "show whatever the value holds".
  const [draft, setDraft] = useState(null);
  const shown = draft !== null ? draft : (value ? formatDMY(value) : '');
  const emit = (iso) => onChange({ target: { value: iso } });

  const type = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean);
    setDraft(parts.join('/'));
    if (!digits) { emit(''); return; }
    if (digits.length < 8) return;
    const [d, m, y] = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)];
    // Reject 31/02 and friends: Date rolls them into the next month, so compare the
    // parsed parts back against what was typed rather than trusting it parsed.
    const dt = new Date(`${y}-${m}-${d}T00:00:00`);
    const real = !Number.isNaN(dt.getTime())
      && dt.getDate() === +d && dt.getMonth() + 1 === +m && dt.getFullYear() === +y;
    if (real) emit(`${y}-${m}-${d}`);
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    // showPicker() needs a user gesture, which this click is; older engines fall
    // back to clicking the input itself.
    if (typeof el.showPicker === 'function') { try { el.showPicker(); return; } catch (_) {} }
    el.click();
  };

  return (
    <div style={{ position: 'relative', flex: 1, ...wrapperStyle }}>
      <input {...p} type="text" inputMode="numeric" placeholder="dd/mm/yyyy"
        value={shown} onChange={type}
        // Drop the draft on the way out so a half-typed date reverts to the
        // committed one rather than sitting there looking saved.
        onBlur={() => setDraft(null)}
        style={{ width: '100%', padding: '9px 32px 9px 11px', fontSize: 13, borderRadius: 8,
          border: '1.5px solid #E0E6F0', outline: 'none', boxSizing: 'border-box',
          background: p.disabled ? '#F3F4F6' : '#fff', ...style }} />
      <input ref={pickerRef} type="date" value={value || ''} tabIndex={-1} aria-hidden="true"
        onChange={(e) => { setDraft(null); emit(e.target.value); }}
        style={{ position: 'absolute', right: 8, top: '50%', width: 1, height: 1,
          opacity: 0, border: 'none', padding: 0, pointerEvents: 'none' }} />
      {!p.disabled && (
        <button type="button" onClick={openPicker} tabIndex={-1} aria-label="Open date picker"
          style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>
          {'\u{1F4C5}'}
        </button>
      )}
    </div>
  );
};

export default DateFieldDMY;
