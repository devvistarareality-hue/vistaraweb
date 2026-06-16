'use client';
import { useEffect, useState } from 'react';

const BG = {
  success: '#2E7D32',
  error:   '#C62828',
  info:    '#1565C0',
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

  return (
    <div style={{
      position:        'fixed',
      top:             20,
      right:           20,
      zIndex:          9999,
      backgroundColor: BG[type] ?? BG.info,
      color:           '#fff',
      padding:         '12px 20px',
      borderRadius:    10,
      fontSize:        14,
      fontWeight:      600,
      boxShadow:       '0 4px 16px rgba(0,0,0,0.22)',
      animation:       'toastIn 0.2s ease',
      maxWidth:        360,
    }}>
      {message}
    </div>
  );
}
