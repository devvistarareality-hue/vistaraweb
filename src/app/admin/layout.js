'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import { useOneSignal } from '../../lib/useOneSignal';
import { moduleAccess } from '../../lib/moduleAccess';
export default function AdminLayout({ children }) {
  const user     = useSelector((s) => s.auth.user);
  const router   = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useOneSignal(user?.user_code);
  const { isModuleAdmin, home } = moduleAccess(user);
  // Module admins (e.g. Sales Admin) can't use platform-admin areas: a single-module
  // admin is bounced to their module; a multi-module admin may only see the launcher.
  const blockedHere = isModuleAdmin && (home !== '/admin' || pathname !== '/admin');

  useEffect(() => {
    if (user === null) return;
    if (!user) {
      router.replace('/company');
    } else if (user.role === 'Kiosk') {
      router.replace('/kiosk');
    } else if (user.role !== 'Admin' && !user.is_staff) {
      router.replace('/dashboard');
    } else if (blockedHere) {
      router.replace(home !== '/admin' ? home : '/admin');
    }
  }, [user, pathname]);

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(162,210,255,0.3)', borderTopColor: '#2F6DB5', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (user.role !== 'Admin' && !user.is_staff) return null;
  if (blockedHere) return null;

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open-active' : ''}`}>
      <style suppressHydrationWarning>{`
        .app-shell { display: flex; min-height: 100vh; background: transparent; }
        .mobile-header { display: none; align-items: center; gap: 12px; padding: 10px 16px; background: rgba(255,255,255,0.86); backdrop-filter: blur(14px); box-shadow: 0 1px 0 rgba(29,29,31,0.06); position: sticky; top: 0; z-index: 190; flex-shrink: 0; }
        .hamburger-btn { background: none; border: none; cursor: pointer; color: #1D1D1F; padding: 4px; display: flex; align-items: center; border-radius: 6px; }
        .hamburger-btn:hover { background: rgba(29,29,31,0.08); }
        .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(29,29,31,0.32); backdrop-filter: blur(3px); z-index: 199; }
        .sidebar-open-active .sidebar-overlay { display: block; }
        @media (max-width: 768px) {
          .app-sidebar { position: fixed !important; left: 0; top: 0; height: 100% !important; transform: translateX(-100%); transition: transform 0.25s ease; z-index: 200; }
          .app-sidebar.sidebar-open { transform: translateX(0) !important; }
          .mobile-header { display: flex !important; }
          .rg-2, .rg-3, .rg-4 { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {/* Mobile overlay */}
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />

      {/* Sidebar — className drives mobile drawer via globals.css */}
      <Sidebar
        user={user}
        onClose={() => setSidebarOpen(false)}
        className={`app-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}
      />

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Mobile header */}
        <div className="mobile-header">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F' }}>Nexora</span>
        </div>
        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
