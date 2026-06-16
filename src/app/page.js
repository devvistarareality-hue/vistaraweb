'use client';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const user   = useSelector((s) => s.auth.user);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      if (!user) {
        router.replace('/company');
      } else if (user.role === 'Admin' || user.is_staff) {
        router.replace('/admin');
      } else {
        router.replace('/dashboard');
      }
    }, 60);
    return () => clearTimeout(t);
  }, [user]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #050D1A 0%, #0C1E3C 55%, #112240 100%)' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,107,43,0.3)', borderTopColor: '#FF6B2B', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
