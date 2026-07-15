'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/actions/authActions';
import { fetchCompanies } from '../redux/actions/companiesActions';
import { setAdminCompany, restoreAdminFilter } from '../redux/reducers/adminFilterReducer';
import NotificationBell from '../app/sales/_NotificationBell';

const ORANGE = '#FF6B2B';

function SvgIcon({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function IconDashboard() {
  return <SvgIcon><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></SvgIcon>;
}
function IconUsers() {
  return <SvgIcon><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></SvgIcon>;
}
function IconBuilding() {
  return <SvgIcon><path d="M3 21h18M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/></SvgIcon>;
}
function IconClock() {
  return <SvgIcon><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></SvgIcon>;
}
function IconTrending() {
  return <SvgIcon><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></SvgIcon>;
}
function IconPeople() {
  return <SvgIcon><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></SvgIcon>;
}
function IconChecklist() {
  return <SvgIcon><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></SvgIcon>;
}
function IconCart() {
  return <SvgIcon><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></SvgIcon>;
}
function IconPin() {
  return <SvgIcon><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></SvgIcon>;
}
function IconLogout() {
  return <SvgIcon><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></SvgIcon>;
}
function IconWallet() {
  return <SvgIcon><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4z"/></SvgIcon>;
}

function IconDesignation() {
  return <SvgIcon><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></SvgIcon>;
}

const NAV_ITEMS = [
  { label: 'Dashboard',          href: '/admin',                icon: <IconDashboard /> },
  { label: 'User Management',    href: '/admin/users',          icon: <IconUsers /> },
  { label: 'Company Management', href: '/admin/companies',      icon: <IconBuilding /> },
  { label: 'Designation Master', href: '/admin/designations',   icon: <IconDesignation /> },
];

const PARKED_ITEMS = [
  { label: 'Sales',              href: '/sales',       icon: <IconTrending />,  live: true },
  { label: 'HR',                 href: '/m/hr',        icon: <IconPeople />,    live: true },
  { label: 'Accounts & Finance', href: '/m/accounts',  icon: <IconWallet />,    live: true },
  { label: 'Execution',          href: '/m/execution', icon: <IconChecklist />, live: true },
  { label: 'Purchase',           href: '/m/purchase',  icon: <IconCart />,      live: true },
  { label: 'Land',               href: '/m/land',      icon: <IconPin />,       live: true },
];

const CSS = `
  .nav-link { transition: background 0.14s, color 0.14s; }
  .nav-link:hover { background: rgba(255,255,255,0.07) !important; color: rgba(255,255,255,0.9) !important; }
  .logout-btn:hover { background: rgba(239,68,68,0.18) !important; border-color: rgba(239,68,68,0.4) !important; }
  .sidebar-scroll::-webkit-scrollbar { width: 0; }
  .sidebar-scroll { scrollbar-width: none; }
  .sidebar-close-x { display: none; }
  @media (max-width: 768px) { .sidebar-close-x { display: block !important; } }
`;

export default function Sidebar({ user, onClose, className }) {
  const pathname    = usePathname();
  const dispatch    = useDispatch();
  const router      = useRouter();
  const isVRLAdmin  = user?.company_code === 'VRL' && (user?.role === 'Admin' || user?.is_staff);
  const companies   = useSelector((s) => s.companies.companies || []);
  const companyId   = useSelector((s) => s.adminFilter?.companyId);

  useEffect(() => {
    dispatch(restoreAdminFilter());
    if (isVRLAdmin) dispatch(fetchCompanies());
  }, [isVRLAdmin]);

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.href === '/admin/companies') return isVRLAdmin;
    return true;
  });

  const isActive = (href) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  function handleCompanyChange(e) {
    const val = e.target.value;
    dispatch(setAdminCompany(val ? parseInt(val, 10) : null));
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).filter(k => k.startsWith('sc_')).forEach(k => localStorage.removeItem(k));
    }
  }

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/company');
  };

  return (
    <div style={s.sidebar} className={className || ''}>
      <style suppressHydrationWarning>{CSS}</style>

      {/* ── Logo + close button (mobile) ── */}
      <div style={{ ...s.logoRow, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={s.logoCircle}>
            <img src="/image-WBG.png" alt="Vistara" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={s.logoName}>Vistara ERP</div>
            <div style={s.logoSub}>{isVRLAdmin ? 'Super Admin' : 'Admin Portal'}</div>
          </div>
        </div>
        <button onClick={onClose} className="sidebar-close-x" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 20, padding: '2px 4px', lineHeight: 1 }}>✕</button>
      </div>

      {/* ── Navigation ── */}
      <div className="sidebar-scroll" style={s.scroll}>

        <div style={s.sectionLabel}>NAVIGATION</div>
        {visibleNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${active ? ' nav-link-active' : ''}`}
              style={{ ...s.navItem, ...(active ? s.navActive : {}) }}
            >
              {active && <div style={s.activeBar} />}
              <span style={{ ...s.iconWrap, color: active ? ORANGE : 'rgba(255,255,255,0.38)' }}>
                {item.icon}
              </span>
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, lineHeight: 1 }}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {isVRLAdmin && companies.length > 0 && (
          <div style={{ marginTop: 18, marginBottom: 4 }}>
            <div style={{ ...s.sectionLabel, marginBottom: 7 }}>VIEWING COMPANY</div>
            <div style={{ position: 'relative' }}>
              <select
                value={companyId ?? ''}
                onChange={handleCompanyChange}
                style={{
                  width: '100%', appearance: 'none', WebkitAppearance: 'none',
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 9, padding: '8px 28px 8px 12px',
                  color: companyId ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="" style={{ backgroundColor: '#0C1E3C', color: 'rgba(255,255,255,0.5)' }}>All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id} style={{ backgroundColor: '#0C1E3C', color: '#fff' }}>{c.name}</option>
                ))}
              </select>
              <svg style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            {companyId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 10px', borderRadius: 6, backgroundColor: 'rgba(255,107,43,0.12)', border: '1px solid rgba(255,107,43,0.22)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: ORANGE, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: ORANGE }}>
                  {companies.find(c => c.id === companyId)?.name || 'Filtered'}
                </span>
              </div>
            )}
          </div>
        )}

        <div style={{ ...s.sectionLabel, marginTop: 22 }}>MODULES</div>
        {PARKED_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link" style={s.navItem}>
            <span style={{ ...s.iconWrap, color: item.live ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.28)' }}>{item.icon}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: item.live ? 600 : 500 }}>{item.label}</span>
            {!item.live && <span style={s.soonChip}>SOON</span>}
            {item.live && <span style={s.liveChip}>LIVE</span>}
          </Link>
        ))}
      </div>

      {/* ── Notifications + User + Logout ── */}
      <div style={s.bottomArea}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Notifications</span>
          <NotificationBell up align="left" />
        </div>
        <div style={s.divider} />
        <div style={s.userRow}>
          <div style={s.avatar}>{(user?.name || 'A')[0].toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.userName}>{user?.name || 'Admin'}</div>
            <div style={s.userBadge}>Administrator</div>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-btn" style={s.logoutBtn}>
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <IconLogout />
          </span>
          Sign Out
        </button>
      </div>
    </div>
  );
}

const s = {
  sidebar: {
    width: 240, minWidth: 240, height: '100vh',
    backgroundColor: '#0C1E3C',
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
  logoSub:  { fontSize: 10, color: 'rgba(255,255,255,0.36)', marginTop: 2, letterSpacing: 0.3 },

  scroll: { flex: 1, overflowY: 'auto', padding: '16px 10px 0' },
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
  soonChip: {
    fontSize: 8, fontWeight: 800, letterSpacing: 0.8,
    color: 'rgba(255,107,43,0.6)', backgroundColor: 'rgba(255,107,43,0.1)',
    borderRadius: 4, padding: '2px 5px', flexShrink: 0,
  },
  liveChip: {
    fontSize: 8, fontWeight: 800, letterSpacing: 0.8,
    color: 'rgba(46,125,50,0.9)', backgroundColor: 'rgba(46,125,50,0.12)',
    borderRadius: 4, padding: '2px 5px', flexShrink: 0,
  },

  bottomArea: { padding: '0 10px 18px', flexShrink: 0 },
  divider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 14 },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 10px', marginBottom: 10, borderRadius: 10,
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
  userName: {
    fontSize: 12, fontWeight: 700, color: '#fff',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  userBadge: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '9px 14px',
    backgroundColor: 'rgba(239,68,68,0.07)',
    border: '1px solid rgba(239,68,68,0.18)',
    borderRadius: 9, color: '#FF7070',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    transition: 'background 0.15s',
  },
};
