'use client';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';

export default function AdminLayout({ children }) {
  const user   = useSelector((s) => s.auth.user);
  const router = useRouter();

  useEffect(() => {
    if (user === null) return; // still hydrating
    if (!user) {
      router.replace('/company');
    } else if (user.role !== 'Admin' && !user.is_staff) {
      router.replace('/dashboard');
    }
  }, [user]);

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #050D1A, #0C1E3C)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,107,43,0.3)', borderTopColor: '#FF6B2B', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (user.role !== 'Admin' && !user.is_staff) {
    return null; // redirect in progress
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F5F6FA' }}>
      <Sidebar user={user} />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
