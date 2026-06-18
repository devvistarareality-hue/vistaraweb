'use client';
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { logout } from '../../redux/actions/authActions';

const ORANGE = '#FF6B2B';
const NAVY   = '#0C1E3C';

function SvgIcon({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function IconDashboard()    { return <SvgIcon><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></SvgIcon>; }
function IconLeads()        { return <SvgIcon><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></SvgIcon>; }
function IconBuilding()     { return <SvgIcon><path d="M3 21h18M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/></SvgIcon>; }
function IconSource()       { return <SvgIcon><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></SvgIcon>; }
function IconUsers()        { return <SvgIcon><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="21" x2="22" y2="19"/><line x1="19" y1="19" x2="25" y2="19"/><path d="M22 9a3 3 0 000 6"/></SvgIcon>; }
function IconDistribute()   { return <SvgIcon><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4"/></SvgIcon>; }
function IconImport()       { return <SvgIcon><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></SvgIcon>; }
function IconReports()      { return <SvgIcon><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></SvgIcon>; }
function IconBack()         { return <SvgIcon><polyline points="15 18 9 12 15 6"/></SvgIcon>; }

const NAV = [
  { label: 'Dashboard',    href: '/sales',               icon: <IconDashboard /> },
  { label: 'All Leads',    href: '/sales/leads',         icon: <IconLeads /> },
  { label: 'Projects',     href: '/sales/projects',      icon: <IconBuilding />,  adminOnly: true },
  { label: 'Lead Setup',   href: '/sales/sources',       icon: <IconSource />,    adminOnly: true },
  { label: 'Team Users',   href: '/sales/users',         icon: <IconUsers />,     adminOnly: true },
  { label: 'Distribution', href: '/sales/distribution',  icon: <IconDistribute />, adminOnly: true },
  { label: 'Import Leads', href: '/sales/import',        icon: <IconImport />,    adminOnly: true },
  { label: 'Reports',      href: '/sales/reports',       icon: <IconReports /> },
];

const CSS = `
  .s-nav-link { transition: background 0.14s, color 0.14s; }
  .s-nav-link:hover { background: rgba(255,255,255,0.07) !important; color: rgba(255,255,255,0.9) !important; }
  @keyframes s-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .s-skel { animation: s-pulse 1.4s ease infinite; background:#E8ECF4; border-radius:8px; }
  .s-logout:hover { background: rgba(239,68,68,0.18) !important; border-color: rgba(239,68,68,0.4) !important; }
  .s-scroll::-webkit-scrollbar { width: 0; }
  .s-scroll { scrollbar-width: none; }
`;

export default function SalesLayout({ children }) {
  const user     = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const router   = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    dispatch(logout());
    router.replace('/company');
  }

  useEffect(() => {
    if (user === null) return;
    if (!user) router.replace('/company');
  }, [user]);

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #050D1A, #0C1E3C)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,107,43,0.3)', borderTopColor: '#FF6B2B', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isAdmin  = user?.role === 'Admin' || user?.is_staff;
  const isActive = (href) => href === '/sales' ? pathname === '/sales' : pathname.startsWith(href);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#DFE4EE' }}>
      <style suppressHydrationWarning>{CSS}</style>

      {/* ── Sales Sidebar ── */}
      <div style={s.sidebar}>
        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.logoCircle}>
            <img src="/image-WBG.png" alt="Vistara" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={s.logoName}>Sales CRM</div>
            <div style={s.logoSub}>Vistara Realty</div>
          </div>
        </div>

        {/* Nav */}
        <div className="s-scroll" style={s.scroll}>
          <div style={s.sectionLabel}>SALES MENU</div>
          {NAV.filter(item => !item.adminOnly || isAdmin).map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} className="s-nav-link"
                style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
                {active && <div style={s.activeBar} />}
                <span style={{ ...s.iconWrap, color: active ? ORANGE : 'rgba(255,255,255,0.38)' }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div style={{ ...s.sectionLabel, marginTop: 22 }}>NAVIGATE</div>
              <Link href="/admin" className="s-nav-link" style={s.navItem}>
                <span style={{ ...s.iconWrap, color: 'rgba(255,255,255,0.38)' }}><IconBack /></span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Back to Admin</span>
              </Link>
            </>
          )}
        </div>

        {/* User */}
        <div style={s.bottomArea}>
          <div style={s.divider} />
          <div style={s.userRow}>
            <div style={s.avatar}>{(user?.name || 'A')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.userName}>{user?.name || 'User'}</div>
              <div style={s.userBadge}>{user?.role || 'Admin'}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="s-logout" style={s.logoutBtn}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}

const s = {
  sidebar: {
    width: 230, minWidth: 230, height: '100vh',
    backgroundColor: NAVY,
    display: 'flex', flexDirection: 'column',
    flexShrink: 0, position: 'sticky', top: 0,
    borderRight: '1px solid rgba(255,255,255,0.05)',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '20px 18px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  logoCircle: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fff', padding: 5,
    overflow: 'hidden', flexShrink: 0,
    boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
  },
  logoName: { fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: 0.2 },
  logoSub:  { fontSize: 10, color: 'rgba(255,255,255,0.36)', marginTop: 2 },
  scroll:   { flex: 1, overflowY: 'auto', padding: '16px 10px 0' },
  sectionLabel: {
    fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.24)',
    letterSpacing: 1.8, padding: '0 8px', marginBottom: 5,
    textTransform: 'uppercase',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 10px 9px 14px', borderRadius: 9,
    color: 'rgba(255,255,255,0.52)', marginBottom: 1,
    cursor: 'pointer', textDecoration: 'none', position: 'relative',
    overflow: 'hidden',
  },
  navActive: { backgroundColor: 'rgba(255,255,255,0.09)', color: '#fff' },
  activeBar: {
    position: 'absolute', left: 0, top: '18%', bottom: '18%',
    width: 3, backgroundColor: ORANGE, borderRadius: '0 3px 3px 0',
  },
  iconWrap: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  bottomArea: { padding: '0 10px 18px', flexShrink: 0 },
  divider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 14 },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 10px', borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
    backgroundColor: 'rgba(255,107,43,0.15)',
    border: '1px solid rgba(255,107,43,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 800, color: ORANGE,
  },
  userName:  { fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userBadge: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  logoutBtn: {
    marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '9px 0', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.85)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
};
