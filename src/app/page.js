'use client';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { moduleAccess } from '../lib/moduleAccess';
import Loader from '../components/Loader';

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
      <Loader />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
