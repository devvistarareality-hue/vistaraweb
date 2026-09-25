'use client';
/**
 * A bar across the top of every page while a platform admin is viewing the app
 * as someone else. It exists so the admin cannot forget: every action taken from
 * here is recorded against the user they are viewing, and a mistake made in
 * someone else's account is a real mistake in real data.
 */
import { useEffect, useState } from 'react';
import { impersonating, stopImpersonation } from '../lib/impersonate';

export default function ImpersonationBanner() {
  const [admin, setAdmin] = useState(null);
  const [me, setMe] = useState('');

  useEffect(() => {
    const read = () => {
      setAdmin(impersonating());
      try { setMe(JSON.parse(localStorage.getItem('user') || '{}').name || ''); }
      catch { setMe(''); }
    };
    read();
    // Another tab exiting the impersonation should clear this one's banner too.
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  if (!admin) return null;

  const exit = () => {
    stopImpersonation();
    window.location.replace(`${window.location.origin}/admin/users`);
  };

  return (
    <div className="imp-bar">
      <span className="imp-dot" />
      <span className="imp-text">
        Viewing as <b>{me || 'this user'}</b> — signed in as {admin.name || admin.user_code}.
        Anything you do here is recorded against them.
      </span>
      <button type="button" className="imp-exit" onClick={exit}>Exit</button>
    </div>
  );
}
