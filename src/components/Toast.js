'use client';
import { useEffect, useState } from 'react';
import Icon from './Icon';

// White card with a tinted icon badge — same toast design as the app.
const KIND = {
  success: { icon: 'check-circle', color: 'var(--success)', bg: 'var(--success-soft)' },
  error:   { icon: 'alert',        color: 'var(--danger)', bg: 'var(--danger-soft)' },
  info:    { icon: 'info',         color: 'var(--accent)', bg: 'var(--accent-soft)' },
};

export default function Toast({ visible, message, type = 'success', duration = 2500, onHide }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShow(true);
    const t = setTimeout(() => {
      setShow(false);
      onHide?.();
    }, duration);
    return () => clearTimeout(t);
  }, [visible, message]);

  if (!show) return null;
  const kind = KIND[type] ?? KIND.info;

  return (
    <div role="status" style={{
      position:        'fixed',
      top:             20,
      right:           20,
      zIndex:          9999,
      display:         'flex',
      alignItems:      'center',
      gap:             12,
      backgroundColor: 'var(--surface)',
      color:           'var(--text)',
      padding:         '10px 18px 10px 10px',
      borderRadius:    20,
      fontSize:        14,
      fontWeight:      600,
      boxShadow:       '0 1px 2px rgba(var(--ink-rgb),0.06), 0 16px 40px rgba(60,90,130,0.18)',
      animation:       'toastIn 0.2s ease',
      maxWidth:        380,
    }}>
      <span style={{ width: 34, height: 34, borderRadius: 12, background: kind.bg, color: kind.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name={kind.icon} size={18} />
      </span>
      {message}
    </div>
  );
}
