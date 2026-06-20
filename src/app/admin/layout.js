'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';

export default function AdminLayout({ children }) {
  const user   = useSelector((s) => s.auth.user);
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (user === null) return;
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

  if (user.role !== 'Admin' && !user.is_staff) return null;

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open-active' : ''}`}>
      {/* Mobile overlay */}
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <div className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar user={user} onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="app-main" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Mobile header */}
        <div className="mobile-header">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Vistara ERP</span>
        </div>
        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
