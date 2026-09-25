'use client';
import { useEffect, useState } from 'react';
import { impersonating } from './impersonate';

/**
 * True while a platform admin is viewing the app as someone else.
 *
 * The sidebars hide Sign Out then: signing out would throw away the viewed user's
 * session with the admin's own set aside underneath it, stranding them — the
 * banner's Exit is the way back. Follows other tabs too, like the banner does.
 */
export function useImpersonating() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(!!impersonating());
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);
  return on;
}
