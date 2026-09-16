'use client';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { moduleAccess } from '../lib/moduleAccess';

export default function RootPage() {
  const user   = useSelector((s) => s.auth.user);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      if (!user) {
        router.replace('/company');
      } else if (user.role === 'Admin' || user.is_staff) {
        // Module-scoped admins land straight on their module; full/super admins → launcher.
        router.replace(moduleAccess(user).home);
      } else {
        router.replace('/dashboard');
      }
    }, 60);
    return () => clearTimeout(t);
  }, [user]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(162,210,255,0.3)', borderTopColor: '#2F6DB5', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
