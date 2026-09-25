'use client';
import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { logout } from '../../redux/actions/authActions';
import { fetchCompanies } from '../../redux/actions/companiesActions';
import { setAdminCompany, restoreAdminFilter } from '../../redux/reducers/adminFilterReducer';
import { AUTH_ENDPOINTS } from '../../constants/api';
import { refreshUser } from '../../lib/refreshUser';
import { apiFetch } from '../../utils/apiFetch';
import { useOneSignal } from '../../lib/useOneSignal';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import {isManagerRole, isSuperAdmin, moduleAccess, isCp as isCpDesignation, can, canSee} from '../../lib/moduleAccess';
import NotificationBell from './_NotificationBell';
import Icon from '../../components/Icon';
import Loader from '../../components/Loader';
import ThemeToggle from '../../components/ThemeToggle';
import NexoraLogo from '../../components/NexoraLogo';
import { useImpersonating } from '../../lib/useImpersonating';
const ORANGE = 'var(--accent)';
const NAVY   = 'var(--text)';

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
function IconBack()         { return <SvgIcon><polyline points="15 18 9 12 15 6"/></SvgIcon>; }
function IconCalendar()     { return <SvgIcon><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></SvgIcon>; }
function IconMapPin()       { return <SvgIcon><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></SvgIcon>; }
function IconConversion()   { return <SvgIcon><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></SvgIcon>; }
function IconTrash()        { return <SvgIcon><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></SvgIcon>; }
function IconAdmin()        { return <SvgIcon><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></SvgIcon>; }
function IconLog()          { return <SvgIcon><path d="M12 8v4l3 3"/><path d="M3.05 11a9 9 0 11.5 4"/><polyline points="3 16 3 11 8 11"/></SvgIcon>; }
function IconPartner()      { return <SvgIcon><path d="M8.5 8.5L3 14l3 3 5.5-5.5M15.5 15.5L21 10l-3-3-5.5 5.5"/><path d="M9 15l1.5 1.5M13.5 9L15 10.5"/></SvgIcon>; }

const NAV = [
  { label: 'Dashboard',    href: '/sales',               icon: <IconDashboard /> , screen: 'sales.screen.dashboard' },
  { label: 'All Leads',    href: '/sales/leads',         icon: <IconLeads /> , screen: 'sales.screen.leads' },
  { label: 'Follow-Ups',   href: '/sales/follow-ups',    icon: <IconCalendar /> , screen: 'sales.screen.followups' },
  { label: 'Site Visits',  href: '/sales/site-visits',   icon: <IconMapPin />,    stmPortal: true , screen: 'sales.screen.sitevisits' },
  { label: 'Booking',      href: '/sales/closure',       icon: <IconBuilding />,  stmPortal: true , screen: 'sales.screen.booking' },
  // Not for an STM: their site visits and closures are reached from Site Visits
  // and Booking → My Bookings, which the dashboard tiles now link to directly.
  { label: 'My Conversions', href: '/sales/my-conversions', icon: <IconConversion />, tcStmPortal: true, hideForStm: true , screen: 'sales.screen.conversions' },
  { label: 'My Team',      href: '/sales/my-team',       icon: <IconUsers />,     managerOnly: true , screen: 'sales.screen.myteam' },
  { label: 'Approvals',    href: '/sales/bookings',      icon: <IconBuilding />,  managerOnly: true , screen: 'sales.screen.approvals' },
  { label: 'Projects',     href: '/sales/projects',      icon: <IconBuilding />,  adminOnly: true , screen: 'sales.screen.projects' },
  { label: 'Lead Setup',   href: '/sales/sources',       icon: <IconSource />,    adminOnly: true , screen: 'sales.screen.leadsetup' },
  { label: 'Team Users',   href: '/sales/users',         icon: <IconUsers />,     adminOnly: true , screen: 'sales.screen.teamusers' },
  { label: 'Distribution', href: '/sales/distribution',  icon: <IconDistribute />, adminOnly: true , screen: 'sales.screen.distribution' },
  { label: 'Import Leads', href: '/sales/import',        icon: <IconImport /> , screen: 'sales.screen.import' },
  { label: 'Data Reset',   href: '/sales/data-reset',    icon: <IconTrash />,     adminOnly: true , screen: 'sales.screen.datareset' },
  // Who changed what, and when — real admins only (not Sales admin-modules users).
  { label: 'Log',          href: '/sales/log',           icon: <IconLog />,       adminOnly: true, trueAdminOnly: true },
];

// Full Admin-section menu for a Sales Admin-Modules user — mirrors every item a
// real Admin sees (same order as NAV above), but the first 8 point at dedicated
// /sales/admin/* routes that request full company data via ?admin_view=1 (see
// backend/sales/views.py::_sees_all_company). The last 6 (Projects..Data Reset)
// reuse their existing routes as-is — those were already company-wide for anyone
// let in the door, hierarchy never applied to them.
const ADMIN_SECTION_NAV = [
  { label: 'Dashboard',      href: '/sales/admin',                 icon: <IconDashboard /> },
  { label: 'All Leads',      href: '/sales/admin/leads',           icon: <IconLeads /> },
  { label: 'Follow-Ups',     href: '/sales/admin/follow-ups',      icon: <IconCalendar /> },
  { label: 'Site Visits',    href: '/sales/admin/site-visits',     icon: <IconMapPin /> },
  { label: 'Booking',        href: '/sales/admin/closure',         icon: <IconBuilding /> },
  { label: 'My Conversions', href: '/sales/admin/my-conversions',  icon: <IconConversion /> },
  { label: 'My Team',        href: '/sales/admin/my-team',         icon: <IconUsers /> },
  { label: 'Approvals',      href: '/sales/admin/bookings',        icon: <IconBuilding /> },
  { label: 'Projects',       href: '/sales/projects',              icon: <IconBuilding /> },
  { label: 'Lead Setup',     href: '/sales/sources',               icon: <IconSource /> },
  { label: 'Team Users',     href: '/sales/users',                 icon: <IconUsers /> },
  { label: 'Distribution',   href: '/sales/distribution',          icon: <IconDistribute /> },
  { label: 'Import Leads',   href: '/sales/import',                icon: <IconImport /> },
  { label: 'Data Reset',     href: '/sales/data-reset',            icon: <IconTrash /> },
];

const CSS = `
  .s-nav-link { transition: background 0.14s, color 0.14s; }
  .s-nav-link:hover { background: rgba(var(--ink-rgb),0.05); color: var(--text); }
  @keyframes s-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .s-skel { animation: s-pulse 1.4s ease infinite; background:var(--surface-3); border-radius:8px; }
  .s-logout:hover { background: rgba(217,67,75,0.18) !important; border-color: rgba(217,67,75,0.4) !important; }
  .s-profile-btn { background: none; border: none; cursor: pointer; width: 100%; }
  .s-profile-btn:hover { background: rgba(var(--ink-rgb),0.05) !important; }
  .s-scroll::-webkit-scrollbar { width: 0; }
  .s-scroll { scrollbar-width: none; }
  @media (max-width: 768px) {
    .sidebar-close-btn { display: block !important; }
    .app-sidebar { position: fixed !important; left: 0; top: 0; height: 100% !important; transform: translateX(-100%); z-index: 200; }
    .app-sidebar.sidebar-open { transform: translateX(0) !important; }
    .mobile-header { display: flex !important; }
    .sidebar-open-active .sidebar-overlay { display: block; }
  }
`;

export default function SalesLayout({ children }) {
  const viewingAs = useImpersonating();   // hide Sign Out while viewing as someone
  const user      = useSelector((s) => s.auth.user);
  const companies = useSelector((s) => s.companies.companies || []);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const dispatch  = useDispatch();
  const router    = useRouter();
  const pathname  = usePathname();

  useOneSignal(user?.user_code);

  // Only platform super-admins get the company switcher + "Back to Admin". A Sales
  // (module) admin is scoped to their own company and stays inside Sales.
  const superAdmin = isSuperAdmin(user);
  const isVRLAdmin = superAdmin && user?.company_code === 'VRL';
  // Anyone holding more than one module needs a way back to the module picker;
  // a single-module employee is boxed into Sales (same rule as /m/[module]).
  const back = superAdmin ? { href: '/admin', label: 'Back to Admin' }
    : (user?.modules || []).length > 1 ? { href: '/dashboard', label: 'Back to Modules' }
    : null;

  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [profileOpen,    setProfileOpen]    = useState(false);
  const [profileData,    setProfileData]    = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [changePwOpen,   setChangePwOpen]   = useState(false);

  useEffect(() => {
    dispatch(restoreAdminFilter());
    if (isVRLAdmin) dispatch(fetchCompanies());
  }, [isVRLAdmin]);

  // Session guard: validate token on mount, on tab focus, and every 30 seconds.
  // If another device has logged in since, the refresh will fail → auto-logout.
  useEffect(() => {
    async function checkSession() {
      if (typeof window === 'undefined') return;
      if (!localStorage.getItem('access_token')) return;
      const res = await apiFetch(AUTH_ENDPOINTS.me);
      // apiFetch handles 401 internally: tries refresh, then dispatches LOGOUT + redirect
      // The answer also carries their current permissions, so a designation
      // change an admin makes now reaches them without signing out.
      refreshUser(dispatch, res);
    }
    checkSession();
    window.addEventListener('focus', checkSession);
    const interval = setInterval(checkSession, 30_000);
    return () => {
      window.removeEventListener('focus', checkSession);
      clearInterval(interval);
    };
  }, []);

  function handleLogout() {
    dispatch(logout());
    router.replace('/company');
  }

  function handleCompanyChange(e) {
    const val = e.target.value;
    dispatch(setAdminCompany(val ? parseInt(val, 10) : null));
    // Bust sales cache so pages reload with new company data
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).filter(k => k.startsWith('sc_')).forEach(k => localStorage.removeItem(k));
    }
  }

  async function openProfile() {
    setProfileOpen(true);
    setProfileLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const res = await fetch(AUTH_ENDPOINTS.me, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setProfileData(await res.json());
    } catch (_) {}
    setProfileLoading(false);
  }

  const PROFILE_FIELDS = [
    { label: 'Full Name',         value: profileData?.name },
    { label: 'Employee Code',     value: profileData?.user_code },
    { label: 'Phone',             value: profileData?.phone },
    { label: 'Email',             value: profileData?.email },
    { label: 'Organisation',      value: profileData?.company_name },
    { label: 'Department',        value: profileData?.department },
    { label: 'Designation',       value: profileData?.designation },
    { label: 'Role',              value: profileData?.role },
    { label: 'Reporting Manager', value: profileData?.reporting_manager?.name },
  ];

  // Box out module-scoped admins who don't own the Sales module (e.g. an HR Admin).
  const { isModuleAdmin: _isModAdmin, home: _modHome } = moduleAccess(user);
  const _blockedFromSales = _isModAdmin && !(user?.modules || []).includes('Sales');
  // A CP-designation user (Manager or Executive; designation starts with/
  // contains "cp", no Sales module/admin access) has no business anywhere in
  // Sales outside the Channel Partner module — every other listing/data page
  // (dashboard, leads, bookings, site visits, ...) is full-company (or at
  // least non-CP) Sales data they were never granted, and the backend only
  // backstops the data itself, not navigation. Send them to their own dashboard
  // the moment they land anywhere else, not just on the exact '/sales' root (a
  // direct link or back-button into e.g. /sales/leads used to sail straight
  // through with no guard at all).
  // Exception: /sales/closure* and /sales/booking* are the actual booking-
  // creation flow (project → unit map → booking form) and are DELIBERATELY
  // shared, unprefixed routes — see m/[module]/closure/page.js's own
  // comment ("not filtered to channel partner leads, since choosing a
  // project/unit isn't a CP-specific concept"). The CP module's own "Booking"
  // nav item lands here, and picking a unit/marking a CP lead Closed both
  // navigate into these same routes — gating them out would trap a CP manager
  // one click into their own module's Booking flow.
  const _isTrueAdminEarly = user?.role === 'Admin' || user?.is_staff;
  const _isSalesModuleAdminEarly = !_isTrueAdminEarly && (user?.admin_modules || []).includes('Sales');
  // Hiding a menu item has to mean hiding the page: otherwise anyone who
  // remembers the address walks straight back in. A designation with no menu
  // configured passes everything, as before.
  const _screenRoutes = NAV.filter((i) => i.screen && i.href);
  const _currentRoute = _screenRoutes
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const _blockedScreen = !!user && !!_currentRoute && !canSee(user, _currentRoute.screen);
  // Where to send them instead: the first screen they may see AND may use. The
  // role rules that hide an item from the sidebar apply here too, or we would
  // land a telecaller on a page their own menu never offers.
  const _mayAdminItem = _isTrueAdminEarly || _isSalesModuleAdminEarly;
  const _mayManagerItem = _mayAdminItem || isManagerRole(user);
  const _mayStmItem = _mayManagerItem || can(user, 'sales.pipeline.stm') || can(user, 'sales.pipeline.cp');
  const _mayTcItem = _mayAdminItem || can(user, 'sales.pipeline.telecalling');
  const _firstAllowed = _screenRoutes.find((i) => canSee(user, i.screen)
    && i.href !== _currentRoute?.href
    && (!i.adminOnly || _mayAdminItem) && (!i.trueAdminOnly || _isTrueAdminEarly)
    && (!i.managerOnly || _mayManagerItem)
    && (!i.stmPortal || _mayStmItem)
    && (!i.tcPortal || _mayTcItem)
    && (!i.tcStmPortal || _mayStmItem || _mayTcItem));
  useEffect(() => {
    if (user === null) return;
    if (!user) { router.replace('/company'); return; }
    if (user.role === 'Kiosk') { router.replace('/kiosk'); return; } // Kiosk users are locked to the kiosk
    if (_blockedFromSales) { router.replace(_modHome); return; }
    if (_blockedScreen && _firstAllowed) router.replace(_firstAllowed.href);
  }, [user, pathname]);

  if (user?.role === 'Kiosk') return null;
  if (_blockedFromSales) return null;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <Loader />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // True/hardcoded admins (Chinmay, Prince, etc. — role='Admin' or platform staff)
  // keep the flat menu exactly as before. Module-scoped admins (e.g. a Manager
  // granted Sales in Admin Modules) instead get a separate "Admin" section — tapping
  // it swaps the whole sidebar to the admin-only pages, mirroring how tapping into
  // Sales itself replaces the launcher's tiles with the Sales menu. It never changes
  // behavior for real admins.
  const isTrueAdmin = user?.role === 'Admin' || user?.is_staff;
  const isSalesModuleAdmin = !isTrueAdmin && (user?.admin_modules || []).includes('Sales');
  const isAdmin  = isTrueAdmin || isSalesModuleAdmin;
  // '/sales' and '/sales/admin' are both "Dashboard" hrefs whose sub-routes share
  // their prefix (e.g. '/sales/leads', '/sales/admin/leads') — exact-match those two
  // so the Dashboard link doesn't light up while looking at a different page.
  // A path only counts as "inside" a nav item when it matches it exactly or
  // continues with a slash: /closures must not light up /closure as well.
  const isActive = (href) => ((href === '/sales' || href === '/sales/admin')
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`));
  // Real admins get these 6 appended flat, inline, in NAV's own order — unchanged.
  const trueAdminExtraItems = NAV.filter((item) => item.adminOnly && canSee(user, item.screen));
  // A module-scoped admin's full Admin section mirrors a real admin's menu.
  const adminSectionNavItems = ADMIN_SECTION_NAV;
  // Whether the module-scoped admin is currently inside their Admin section — derived
  // from the URL, so a direct link or refresh lands on the right sidebar automatically.
  const inAdminSection = isSalesModuleAdmin && adminSectionNavItems.some((item) => isActive(item.href));

  // Shared renderer for both the true-admin flat list and the module-scoped admin's
  // Admin section — a nav item with `children` renders as an expand/collapse header
  // with its sub-pages indented below, instead of navigating away directly.
  function renderNavItem(item) {
    const active = isActive(item.href);
    return (
      <Link key={item.href} href={item.href} className="s-nav-link"
        style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
        <span style={{ ...s.iconWrap, color: active ? 'var(--nav-active-fg)' : 'rgba(var(--ink-rgb),0.6)' }}>
          {item.icon}
        </span>
        <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
      </Link>
    );
  }

  const des = (user?.designation || '').toLowerCase();
  const isStm = can(user, 'sales.pipeline.stm');
  const isTelecaller = can(user, 'sales.pipeline.telecalling');
  // CP Executive — a channel partner who works their own leads (no Meta).
  // (CP Cluster Heads are Managers, covered by isManager.)
  const isCp = isCpDesignation(user);
  // Managers oversee the sales floor, so they also get the STM-portal modules
  // (Site Visits, Booking, My Conversions) — without changing their portal title.
  const isManager = isManagerRole(user);
  // Channel Partner is its own module now, so nobody lands in Sales as a partner
  // person: this is the Sales floor's own title.
  const portalTitle = isTelecaller ? 'Telecaller Portal' : isStm ? 'Sales Executive' : 'Sales CRM';

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open-active' : ''}`}>
      <style suppressHydrationWarning>{CSS}</style>

      {/* Mobile overlay */}
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />

      {/* ── Sales Sidebar ── */}
      <div style={s.sidebar} className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Logo */}
        <div style={{ ...s.logoRow, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={s.logoCircle}>
              <NexoraLogo />
            </div>
            <div>
              <div style={s.logoName}>{portalTitle}</div>
              <div style={s.logoSub}>Nexora</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(var(--ink-rgb),0.72)', cursor: 'pointer', fontSize: 20, padding: '2px 6px', lineHeight: 1, display: 'none' }} className="sidebar-close-btn"><Icon name="x" /></button>
        </div>

        {/* Nav */}
        <div className="s-scroll" style={s.scroll}>
          {inAdminSection ? (
            <>
              {/* Module-scoped admin, inside their Admin section — this REPLACES the
                  Sales menu entirely, the same way tapping into Sales itself replaces
                  the launcher's tiles. Real admins never see this branch. */}
              <div style={s.sectionLabel}>ADMIN MENU</div>
              <Link href="/sales" className="s-nav-link" style={s.navItem}>
                <span style={{ ...s.iconWrap, color: 'rgba(var(--ink-rgb),0.6)' }}><IconBack /></span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Back to Sales</span>
              </Link>
              <div style={{ ...s.divider, marginTop: 10 }} />
              {adminSectionNavItems.map((item) => renderNavItem(item))}
            </>
          ) : (
            <>
              <div style={s.sectionLabel}>SALES MENU</div>
              {NAV.filter(item => canSee(user, item.screen) && !item.adminOnly && (!item.managerOnly || isAdmin || isManager) && (!item.stmPortal || isAdmin || isStm || isManager || isCp) && (!item.tcPortal || isAdmin || isTelecaller) && (!item.tcStmPortal || isAdmin || isTelecaller || isStm || isManager || isCp) && !(item.hideForStm && isStm && !isAdmin && !isManager)).map((item) => renderNavItem(item))}

              {isTrueAdmin && trueAdminExtraItems.map((item) => renderNavItem(item))}
              {/* Real admins (Chinmay, Prince, platform staff) get the flat,
                  always-visible list exactly as before — no separate section for them. */}

              {isSalesModuleAdmin && (
                <Link href="/sales/admin" className="s-nav-link" style={s.navItem}>
                  <span style={{ ...s.iconWrap, color: 'rgba(var(--ink-rgb),0.6)' }}>
                    <IconAdmin />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Admin</span>
                </Link>
              )}
            </>
          )}

          {isVRLAdmin && companies.length > 0 && (
            <div style={{ marginTop: 18, marginBottom: 4 }}>
              <div style={{ ...s.sectionLabel, marginBottom: 7 }}>VIEWING COMPANY</div>
              <div style={{ position: 'relative' }}>
                <select className="nx-input" data-plain
                  value={companyId ?? ''}
                  onChange={handleCompanyChange}
                  style={{
                    width: '100%', appearance: 'none', WebkitAppearance: 'none',
                    backgroundColor: 'rgba(var(--ink-rgb),0.056)',
                    border: '1px solid rgba(var(--ink-rgb),0.112)',
                    borderRadius: 9, padding: '8px 28px 8px 12px',
                    color: companyId ? 'var(--text)' : 'rgba(var(--ink-rgb),0.67)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="" style={{ backgroundColor: 'var(--surface)', color: 'rgba(var(--ink-rgb),0.72)' }}>All Companies</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id} style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <svg style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(var(--ink-rgb),0.62)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              {companyId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 10px', borderRadius: 6, backgroundColor: 'rgba(162,210,255,0.12)', border: '1px solid rgba(162,210,255,0.22)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: ORANGE }}>
                    {companies.find(c => c.id === companyId)?.name || 'Filtered'}
                  </span>
                </div>
              )}
            </div>
          )}

          {back && (
            <>
              <div className="s-nav-gap" style={s.sectionLabel}>NAVIGATE</div>
              <Link href={back.href} className="s-nav-link" style={s.navItem}>
                <span className="s-nav-back-icon" style={s.iconWrap}><IconBack /></span>
                <span className="s-nav-back-label">{back.label}</span>
              </Link>
            </>
          )}
        </div>

        {/* User */}
        <div style={s.bottomArea}>
          {/* Super admins get notifications in the admin dashboard sidebar instead. */}
          {!superAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(var(--ink-rgb),0.62)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Notifications</span>
              <NotificationBell up align="left" />
            </div>
          )}
          <ThemeToggle style={{ marginBottom: 12 }} />
          <div style={s.divider} />
          <button onClick={openProfile} className="s-profile-btn" style={s.userRow}>
            <div style={s.avatar}>{(user?.name || 'A')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={s.userName}>{user?.name || 'User'}</div>
              <div style={s.userBadge}>{user?.designation || user?.role || 'Admin'}</div>
            </div>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="rgba(var(--ink-rgb),0.52)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
          {!viewingAs && (
          <button onClick={handleLogout} className="s-logout" style={s.logoutBtn}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
          )}
        </div>
      </div>

      {/* ── Profile Modal ── */}
      {profileOpen && (
        <div className="nx-modal-backdrop" onClick={() => setProfileOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(var(--ink-rgb),0.38)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
        }}>
          <div className="nx-modal" onClick={e => e.stopPropagation()} style={{
            width: 300, marginLeft: 16, marginBottom: 20,
            backgroundColor: 'var(--surface)', borderRadius: 18,
            boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--surface-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 13,
                  backgroundColor: 'rgba(162,210,255,0.12)',
                  border: '1.5px solid rgba(162,210,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: ORANGE, flexShrink: 0,
                }}>
                  {(user?.name || 'A')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{user?.designation || user?.role}</div>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div style={{ padding: '6px 0' }}>
              {profileLoading ? (
                <Loader label="Loading…" style={{ padding: '28px 0' }} />
              ) : PROFILE_FIELDS.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 20px',
                  borderBottom: i < PROFILE_FIELDS.length - 1 ? '1px solid var(--surface-2)' : 'none',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', maxWidth: 160, textAlign: 'right', wordBreak: 'break-all' }}>{f.value || '—'}</span>
                </div>
              ))}
            </div>

            {/* Change Password + Sign Out */}
            <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => { setProfileOpen(false); setChangePwOpen(true); }} style={{
                width: '100%', padding: '10px 0', borderRadius: 14,
                border: '1.5px solid var(--border)', backgroundColor: 'var(--surface)',
                color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Change Password
              </button>
              {!viewingAs && (
              <button className="nx-btn nx-btn-md nx-btn-danger-soft" onClick={handleLogout} style={{
                width: '100%', padding: '10px 0', borderRadius: 14,
                border: '1.5px solid var(--danger-2)', backgroundColor: 'var(--danger-soft)',
                color: 'var(--danger)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} onSuccess={handleLogout} />

      {/* ── Main content ── */}
      <div className="app-main" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Mobile header */}
        <div className="mobile-header">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{portalTitle}</span>
        </div>
        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          {/* Nothing at all is ticked for them: say so, and leave them the sidebar
              so they can still sign out. */}
          {_blockedScreen && !_firstAllowed ? (
            <div className="nx-note info">
              No screens have been switched on for your designation yet. Ask your administrator
              to set them in Designation Master → Permissions.
            </div>
          ) : children}
        </main>
      </div>
    </div>
  );
}

const s = {
  sidebar: {
    width: 230, minWidth: 230, height: '100vh',
    backgroundColor: 'var(--sidebar)', borderRight: '1px solid var(--border)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 1px 2px rgba(var(--ink-rgb),0.04), 0 8px 24px rgba(60,90,130,0.08)',
    display: 'flex', flexDirection: 'column',
    flexShrink: 0, position: 'sticky', top: 0,
    borderRight: '1px solid rgba(var(--ink-rgb),0.04)',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '20px 18px 18px',
    borderBottom: '1px solid rgba(var(--ink-rgb),0.048)',
    flexShrink: 0,
  },
  logoCircle: {
    width: 36, height: 36, borderRadius: 14,
    backgroundColor: 'var(--surface)', padding: 5,
    overflow: 'hidden', flexShrink: 0,
    boxShadow: '0 2px 8px rgba(var(--ink-rgb),0.10)',
  },
  logoName: { fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: 0.2 },
  logoSub:  { fontSize: 10, color: 'rgba(var(--ink-rgb),0.58)', marginTop: 2 },
  scroll:   { flex: 1, overflowY: 'auto', padding: '16px 10px 0' },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.6, padding: '0 8px', marginBottom: 5,
    textTransform: 'uppercase',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', borderRadius: 999,
    color: 'rgba(var(--ink-rgb),0.74)', marginBottom: 1,
    cursor: 'pointer', textDecoration: 'none', position: 'relative',
    overflow: 'hidden',
  },
  navActive: { background: 'var(--nav-active-bg)', color: 'var(--nav-active-fg)', fontWeight: 700, boxShadow: 'var(--nav-active-shadow)' },
  navChildActive: { backgroundColor: 'var(--accent-soft)', color: 'var(--text)' },
  activeBar: {
    position: 'absolute', left: 0, top: '18%', bottom: '18%',
    width: 3, backgroundColor: 'var(--primary)', borderRadius: '0 3px 3px 0',
  },
  iconWrap: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  bottomArea: { padding: '0 10px 18px', flexShrink: 0 },
  divider:   { height: 1, backgroundColor: 'rgba(var(--ink-rgb),0.056)', marginBottom: 14 },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 10px', borderRadius: 14,
    backgroundColor: 'rgba(var(--ink-rgb),0.032)',
    border: '1px solid rgba(var(--ink-rgb),0.04)',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
    backgroundColor: 'rgba(162,210,255,0.15)',
    border: '1px solid rgba(162,210,255,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 800, color: ORANGE,
  },
  userName:  { fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userBadge: { fontSize: 10, color: 'rgba(var(--ink-rgb),0.57)', marginTop: 2 },
  logoutBtn: {
    marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '9px 0', borderRadius: 9, border: '1px solid rgba(217,67,75,0.3)',
    background: 'rgba(217,67,75,0.08)', color: 'rgba(217,67,75,0.85)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
};
