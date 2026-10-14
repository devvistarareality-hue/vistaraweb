'use client';
// A list opened from a notification: `?<name>=<id>` narrows it to that one record
// (a booking, a project, an investor…). Returns [id, clear]; clear() drops the
// narrowing and the parameter, so Back / refresh show the whole list again.
import { useEffect, useState } from 'react';

export function useFocusId(name) {
  const [id, setId] = useState('');
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get(name);
    if (v && /^\d+$/.test(v)) setId(v);
  }, [name]);
  const clear = () => {
    setId('');
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete(name);
      window.history.replaceState(null, '', u.pathname + (u.search || ''));
    } catch { /* nothing to strip */ }
  };
  return [id, clear];
}
