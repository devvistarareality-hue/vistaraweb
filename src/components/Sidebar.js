'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { logout } from '../redux/actions/authActions';

const ORANGE = '#FF6B2B';
const GREEN  = '#2E7D32';
const EXEC_ORANGE = '#E65100';

function SvgIcon({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function IconDashboard()   { return <SvgIcon><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></SvgIcon>; }
function IconUsers()       { return <SvgIcon><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></SvgIcon>; }
function IconBuilding()    { return <SvgIcon><path d="M3 21h18M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/></SvgIcon>; }
function IconClock()       { return <SvgIcon><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></SvgIcon>; }
function IconTrending()    { return <SvgIcon><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></SvgIcon>; }
function IconPeople()      { return <SvgIcon><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></SvgIcon>; }
function IconChecklist()   { return <SvgIcon><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></SvgIcon>; }
function IconCart()        { return <SvgIcon><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></SvgIcon>; }
function IconPin()         { return <SvgIcon><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></SvgIcon>; }
function IconLogout()      { return <SvgIcon><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></SvgIcon>; }
function IconDesignation() { return <SvgIcon><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></SvgIcon>; }
function IconWrench()      { return <SvgIcon><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></SvgIcon>; }
function IconBack()        { return <SvgIcon><polyline points="15 18 9 12 15 6"/></SvgIcon>; }
function IconPlus()        { return <SvgIcon><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></SvgIcon>; }
function IconRuler()       { return <SvgIcon><path d="M21 3H3v18h18V3z"/><path d="M9 3v4M15 3v4M3 9h4M3 15h4M21 9h-4M21 15h-4M9 21v-4M15 21v-4"/></SvgIcon>; }
function IconTruck()       { return <SvgIcon><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></SvgIcon>; }
function IconDoc()         { return <SvgIcon><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></SvgIcon>; }
function IconWBS()         { return <SvgIcon><rect x="3" y="3" width="6" height="4" rx="1"/><rect x="9" y="10" width="6" height="4" rx="1"/><rect x="9" y="17" width="6" height="4" rx="1"/><line x1="6" y1="7" x2="6" y2="12"/><line x1="6" y1="12" x2="9" y2="12"/><line x1="6" y1="12" x2="9" y2="19"/></SvgIcon>; }
function IconChart()       { return <SvgIcon><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></SvgIcon>; }

// ── Nav definitions ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard',          href: '/admin',                icon: <IconDashboard /> },
  { label: 'User Management',    href: '/admin/users',          icon: <IconUsers /> },
  { label: 'Company Management', href: '/admin/companies',      icon: <IconBuilding /> },
  { label: 'Designation Master', href: '/admin/designations',   icon: <IconDesignation /> },
];

const PARKED_ITEMS = [
  { label: 'Sales',     href: '/sales',                  icon: <IconTrending />, live: true },
  { label: 'Execution', href: '/erp/execution',          icon: <IconWrench />,   live: true },
  { label: 'Purchase',  href: '/erp/purchase',           icon: <IconCart />,     live: true },
  { label: 'HR',        href: '/placeholder?title=HR',   icon: <IconPeople /> },
  { label: 'Land',      href: '/placeholder?title=Land', icon: <IconPin /> },
];

const EXECUTION_NAV = [
  { label: 'Execution Home', href: '/erp/execution',     icon: <IconDashboard /> },
  { label: 'WBS / BOQ',      href: '/erp/wbs',           icon: <IconWBS /> },
  { label: 'New WBS Entry',  href: '/erp/wbs/create',    icon: <IconPlus /> },
  { label: 'PR List',        href: '/erp/pr',             icon: <IconChecklist /> },
  { label: 'New PR',         href: '/erp/pr/create',      icon: <IconPlus /> },
  { label: 'MB / RA Bill',   href: '/erp/mb',             icon: <IconRuler /> },
];

const PURCHASE_NAV = [
  { label: 'Purchase Home',  href: '/erp/purchase',         icon: <IconDashboard /> },
  { label: 'PO List',        href: '/erp/po',               icon: <IconCart /> },
  { label: 'New PO',         href: '/erp/po/create',        icon: <IconPlus /> },
  { label: 'GRN',            href: '/erp/grn',              icon: <IconTruck /> },
  { label: 'Stock Balance',  href: '/erp/stock',            icon: <IconBuilding /> },
  { label: 'Invoices',       href: '/erp/invoices',         icon: <IconDoc /> },
  { label: 'Vendors',        href: '/erp/vendors',          icon: <IconPeople /> },
];

// ── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  .nav-link { transition: background 0.14s, color 0.14s; }
  .nav-link:hover { background: rgba(255,255,255,0.07) !important; color: rgba(255,255,255,0.9) !important; }
  .logout-btn:hover { background: rgba(239,68,68,0.18) !important; border-color: rgba(239,68,68,0.4) !important; }
  .sidebar-scroll::-webkit-scrollbar { width: 0; }
  .sidebar-scroll { scrollbar-width: none; }
`;

// ── Shared sub-components ────────────────────────────────────────────────────

function NavLink({ href, active, children, accentColor }) {
  return (
    <Link
      href={href}
      className="nav-link"
      style={{ ...s.navItem, ...(active ? s.navActive : {}) }}
    >
      {active && <div style={{ ...s.activeBar, backgroundColor: accentColor || ORANGE }} />}
      {children}
    </Link>
  );
}

function LogoRow({ title, sub }) {
  return (
    <div style={s.logoRow}>
      <div style={s.logoCircle}>
        <img src="/image-WBG.png" alt="Vistara" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div>
        <div style={s.logoName}>{title}</div>
        <div style={s.logoSub}>{sub}</div>
      </div>
    </div>
  );
}

function BottomUser({ user, onLogout }) {
  return (
    <div style={s.bottomArea}>
      <div style={s.divider} />
      <div style={s.userRow}>
        <div style={s.avatar}>{(user?.name || 'A')[0].toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.userName}>{user?.name || 'Admin'}</div>
          <div style={s.userBadge}>Administrator</div>
        </div>
      </div>
      <button onClick={onLogout} className="logout-btn" style={s.logoutBtn}>
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}><IconLogout /></span>
        Sign Out
      </button>
    </div>
  );
}

// ── Execution Sidebar ────────────────────────────────────────────────────────

function ExecutionSidebar({ user, pathname, onLogout }) {
  const isActive = (href) => href === '/erp/execution' ? pathname === '/erp/execution' : pathname.startsWith(href);

  return (
    <div style={{ ...s.sidebar, borderRight: '1px solid rgba(46,125,50,0.2)' }}>
      {/* Green top accent bar */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #1B5E20, #4CAF50)', flexShrink: 0 }} />

      <LogoRow title="Execution" sub="Site & Work Management" />

      <div className="sidebar-scroll" style={s.scroll}>
        <div style={{ ...s.sectionLabel, color: 'rgba(76,175,80,0.7)' }}>EXECUTION MENU</div>
        {EXECUTION_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <NavLink key={item.href} href={item.href} active={active} accentColor="#4CAF50">
              <span style={{ ...s.iconWrap, color: active ? '#4CAF50' : 'rgba(255,255,255,0.38)' }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
            </NavLink>
          );
        })}

        <div style={{ ...s.sectionLabel, marginTop: 22 }}>NAVIGATE</div>
        <Link href="/admin" className="nav-link" style={s.navItem}>
          <span style={{ ...s.iconWrap, color: 'rgba(255,255,255,0.38)' }}><IconBack /></span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.52)' }}>Back to Admin</span>
        </Link>
      </div>

      <BottomUser user={user} onLogout={onLogout} />
    </div>
  );
}

// ── Purchase Sidebar ─────────────────────────────────────────────────────────

function PurchaseSidebar({ user, pathname, onLogout }) {
  const isActive = (href) => href === '/erp/purchase' ? pathname === '/erp/purchase' : pathname.startsWith(href);

  return (
    <div style={{ ...s.sidebar, borderRight: '1px solid rgba(230,81,0,0.2)' }}>
      {/* Orange top accent bar */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #BF360C, #FF7043)', flexShrink: 0 }} />

      <LogoRow title="Purchase" sub="Procurement & Inventory" />

      <div className="sidebar-scroll" style={s.scroll}>
        <div style={{ ...s.sectionLabel, color: 'rgba(230,81,0,0.7)' }}>PURCHASE MENU</div>
        {PURCHASE_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <NavLink key={item.href} href={item.href} active={active} accentColor="#FF7043">
              <span style={{ ...s.iconWrap, color: active ? '#FF7043' : 'rgba(255,255,255,0.38)' }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
            </NavLink>
          );
        })}

        <div style={{ ...s.sectionLabel, marginTop: 22 }}>NAVIGATE</div>
        <Link href="/admin" className="nav-link" style={s.navItem}>
          <span style={{ ...s.iconWrap, color: 'rgba(255,255,255,0.38)' }}><IconBack /></span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.52)' }}>Back to Admin</span>
        </Link>
      </div>

      <BottomUser user={user} onLogout={onLogout} />
    </div>
  );
}

// ── Admin (default) Sidebar ──────────────────────────────────────────────────

function AdminSidebar({ user, pathname, isVRLAdmin, onLogout }) {
  const isActive = (href) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.href === '/admin/companies') return isVRLAdmin;
    return true;
  });

  return (
    <div style={s.sidebar}>
      <LogoRow title="Vistara ERP" sub={isVRLAdmin ? 'Super Admin' : 'Admin Portal'} />

      <div className="sidebar-scroll" style={s.scroll}>
        <div style={s.sectionLabel}>NAVIGATION</div>
        {visibleNav.map((item) => {
          const active = isActive(item.href);
          return (
            <NavLink key={item.href} href={item.href} active={active}>
              <span style={{ ...s.iconWrap, color: active ? ORANGE : 'rgba(255,255,255,0.38)' }}>{item.icon}</span>
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, lineHeight: 1 }}>{item.label}</span>
            </NavLink>
          );
        })}

        <div style={{ ...s.sectionLabel, marginTop: 22 }}>MODULES</div>
        {PARKED_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link" style={s.navItem}>
            <span style={{ ...s.iconWrap, color: item.live ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.28)' }}>{item.icon}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: item.live ? 600 : 500 }}>{item.label}</span>
            {!item.live && <span style={s.soonChip}>SOON</span>}
            {item.live  && <span style={s.liveChip}>LIVE</span>}
          </Link>
        ))}
      </div>

      <BottomUser user={user} onLogout={onLogout} />
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function Sidebar({ user }) {
  const pathname   = usePathname();
  const dispatch   = useDispatch();
  const router     = useRouter();
  const isVRLAdmin = user?.company_code === 'VRL' && (user?.role === 'Admin' || user?.is_staff);

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/company');
  };

  const isExecution = pathname.startsWith('/erp/execution') || pathname.startsWith('/erp/pr') || pathname.startsWith('/erp/mb') || pathname.startsWith('/erp/wbs');
  const isPurchase  = pathname.startsWith('/erp/purchase')  || pathname.startsWith('/erp/po') || pathname.startsWith('/erp/grn') || pathname.startsWith('/erp/stock') || pathname.startsWith('/erp/invoices') || pathname.startsWith('/erp/vendors');

  return (
    <>
      <style suppressHydrationWarning>{CSS}</style>
      {isExecution
        ? <ExecutionSidebar user={user} pathname={pathname} onLogout={handleLogout} />
        : isPurchase
        ? <PurchaseSidebar  user={user} pathname={pathname} onLogout={handleLogout} />
        : <AdminSidebar user={user} pathname={pathname} isVRLAdmin={isVRLAdmin} onLogout={handleLogout} />
      }
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

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
