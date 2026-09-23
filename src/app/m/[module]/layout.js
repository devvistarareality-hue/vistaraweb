'use client';
import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { logout } from '../../../redux/actions/authActions';
import { fetchCompanies } from '../../../redux/actions/companiesActions';
import { restoreAdminFilter, setAdminCompany } from '../../../redux/reducers/adminFilterReducer';
import { MODULE_META } from './moduleMeta';
import {SLUG_TO_MODULE, isManagerRole, moduleAccess, canSee} from '../../../lib/moduleAccess';
import { AUTH_ENDPOINTS } from '../../../constants/api';
import ChangePasswordModal from '../../../components/ChangePasswordModal';
import Loader from '../../../components/Loader';
import ThemeToggle from '../../../components/ThemeToggle';
import NexoraLogo from '../../../components/NexoraLogo';

const ORANGE = 'var(--accent)';
const NAVY = 'var(--text)';

function SvgIcon({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );
}
const IconGrid  = () => <SvgIcon><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></SvgIcon>;
const IconUsers = () => <SvgIcon><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></SvgIcon>;
const IconBook  = () => <SvgIcon><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></SvgIcon>;
const IconCheck = () => <SvgIcon><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></SvgIcon>;
const IconLog = () => <SvgIcon><path d="M12 8v4l3 3"/><path d="M3.05 11a9 9 0 11.5 4"/><polyline points="3 16 3 11 8 11"/></SvgIcon>;
const IconBell = () => <SvgIcon><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></SvgIcon>;
const IconChart = () => <SvgIcon><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></SvgIcon>;
const IconBack  = () => <SvgIcon><polyline points="15 18 9 12 15 6"/></SvgIcon>;

export default function ModuleLayout({ children, params }) {
  const slug = params.module;
  const meta = MODULE_META[slug];
  const user = useSelector((s) => s.auth.user);
  const companies = useSelector((s) => s.companies?.companies || []);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);

  async function openProfile() {
    setProfileOpen(true); setProfileLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const res = await fetch(AUTH_ENDPOINTS.me, { headers: { Authorization: `Bearer ${token}` } });
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

  const isVRLAdmin = user?.company_code === 'VRL' && (user?.role === 'Admin' || user?.is_staff);
  useEffect(() => { dispatch(restoreAdminFilter()); if (isVRLAdmin) dispatch(fetchCompanies()); }, [isVRLAdmin]);

  function handleCompanyChange(e) {
    const val = e.target.value;
    dispatch(setAdminCompany(val ? parseInt(val, 10) : null));
  }
  // Box module-scoped admins out of modules they don't own.
  const { isModuleAdmin, home } = moduleAccess(user);
  const moduleName = SLUG_TO_MODULE[slug];
  const blockedHere = isModuleAdmin && !(user?.modules || []).includes(moduleName);
  useEffect(() => {
    if (user === null) return;
    if (!user) { router.replace('/company'); return; }
    if (user.role === 'Kiosk') { router.replace('/kiosk'); return; } // Kiosk users are locked to the kiosk
    if (blockedHere) router.replace(home);
  }, [user, slug]);

  const isAdmin = user?.role === 'Admin' || user?.is_staff;
  const isManager = isManagerRole(user);
  const base = `/m/${slug}`;
  // Every module has the same three: a Dashboard, My Team, and — for admins —
  // the Log. Anything else is what that module actually does.
  const NAV = [
    { label: 'Dashboard', href: `${base}/dashboard`, icon: <IconChart />, screen: `${slug}.screen.dashboard` },
    // Accounts & Finance: Approvals is the Pending/Approved/Rejected review queue
    // (approve, reject with remarks) — same split Sales uses (its own "Approvals"
    // nav item is the Drafts/Pending/Approved/Rejected list, separate from the
    // record-a-closure flow). Bookings is the resulting ledger once approved —
    // read-only besides Cancel, which lives there instead.
    ...(slug === 'accounts' ? [
      { label: 'Approvals', href: `${base}/approvals`, icon: <IconCheck />, screen: 'accounts.screen.approvals' },
      { label: 'Bookings',  href: `${base}/bookings`,  icon: <IconBook />, screen: 'accounts.screen.bookings' },
    ] : []),
    // Accounts Receivable: the register of approved bookings (each opening its
    // ledger) and the import of past receipts.
    ...(slug === 'ar' ? [
      { label: 'Collections', href: `${base}/collections`, icon: <IconBell />, screen: 'ar.screen.collections' },
      { label: 'Register', href: `${base}/register`, icon: <IconBook />, screen: 'ar.screen.register' },
      { label: 'Import receipts', href: `${base}/import`, icon: <IconCheck />, screen: 'ar.screen.import' },
    ] : []),
    // My Team is a management view — only managers and admins see it.
    ...(isManager || isAdmin ? [{ label: 'My Team', href: `${base}/team`, icon: <IconUsers />,
                                 screen: `${slug}.screen.myteam` }] : []),
    // Who changed what in this module, and when — real admins only.
    ...(isAdmin ? [{ label: 'Log', href: `${base}/log`, icon: <IconLog /> }] : []),
  ];
  // "Back to Modules" only makes sense when the user actually has more than one module
  // to switch between (or is an admin). A single-module employee is boxed into it.
  const moduleCount = (user?.modules || []).length;
  const back = isAdmin ? { href: '/admin', label: 'Back to Admin' }
    : moduleCount > 1 ? { href: '/dashboard', label: 'Back to Modules' }
    : null;
  // A company can hide menu items per designation (Designation Master → Permissions).
  const visibleNav = NAV.filter((item) => canSee(user, item.screen));
  const isActive = (href) => href === base ? pathname === base : pathname.startsWith(href);
  // Hiding a menu item has to hide the page too, or the address still lets them in.
  const currentItem = NAV.filter((i) => i.screen && isActive(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const blockedScreen = !!user && !!currentItem && !canSee(user, currentItem.screen);
  useEffect(() => {
    if (blockedScreen && visibleNav.length) router.replace(visibleNav[0].href);
  }, [blockedScreen, pathname]);

  if (!meta) {
    return <div style={{ padding: 40 }}>Unknown module.</div>;
  }
  if (blockedHere) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="nx-sidebar" style={s.sidebar}>
        <div style={s.logoRow}>
          <div style={s.logoCircle}><NexoraLogo alt="" /></div>
          <div>
            <div style={s.logoName}>{meta.name}</div>
            <div style={s.logoSub}>Nexora</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '16px 10px 0' }}>
          <div style={s.sectionLabel}>{meta.name.toUpperCase()} MENU</div>
          {visibleNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
                <span style={{ ...s.iconWrap, color: active ? 'var(--nav-active-fg)' : 'rgba(var(--ink-rgb),0.6)' }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
              </Link>
            );
          })}
          {isVRLAdmin && companies.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ ...s.sectionLabel, marginBottom: 7 }}>VIEWING COMPANY</div>
              <div style={{ position: 'relative' }}>
                <select className="nx-input" data-plain value={companyId ?? ''} onChange={handleCompanyChange}
                  style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', backgroundColor: 'rgba(var(--ink-rgb),0.056)', border: '1px solid rgba(var(--ink-rgb),0.112)', borderRadius: 9, padding: '8px 28px 8px 12px', color: companyId ? 'var(--text)' : 'rgba(var(--ink-rgb),0.67)', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                  <option value="" style={{ backgroundColor: 'var(--surface)', color: 'rgba(var(--ink-rgb),0.72)' }}>All Companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id} style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}>{c.name}</option>
                  ))}
                </select>
                <svg style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(var(--ink-rgb),0.62)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {companyId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 10px', borderRadius: 6, backgroundColor: 'rgba(162,210,255,0.12)', border: '1px solid rgba(162,210,255,0.22)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: ORANGE }}>{companies.find((c) => c.id === companyId)?.name || 'Filtered'}</span>
                </div>
              )}
            </div>
          )}

          {back && <>
            <div style={{ ...s.sectionLabel, marginTop: 22 }}>NAVIGATE</div>
            <Link href={back.href} style={s.navItem}>
              <span style={{ ...s.iconWrap, color: 'rgba(var(--ink-rgb),0.6)' }}><IconBack /></span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{back.label}</span>
            </Link>
          </>}
        </div>
        <div style={{ padding: '0 10px 18px' }}>
          <ThemeToggle style={{ marginBottom: 12 }} />
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />
          <button onClick={openProfile} style={{ ...s.userRow, width: '100%', border: '1px solid rgba(var(--ink-rgb),0.04)', cursor: 'pointer', textAlign: 'left' }}>
            <div style={s.avatar}>{(user?.name || 'A')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.userName}>{user?.name || 'User'}</div>
              <div style={s.userBadge}>{user?.designation || user?.role || 'Admin'}</div>
            </div>
          </button>
          <button onClick={() => { dispatch(logout()); router.replace('/company'); }} style={s.logoutBtn}>Sign Out</button>
        </div>
      </div>
      <main className="nx-main-scroll">
        {blockedScreen && !visibleNav.length ? (
          <div className="nx-note info">
            No screens have been switched on for your designation in this module. Ask your
            administrator to set them in Designation Master → Permissions.
          </div>
        ) : children}
      </main>

      {/* ── Profile Modal ── */}
      {profileOpen && (
        <div className="nx-modal-backdrop" onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
          <div className="nx-modal" onClick={(e) => e.stopPropagation()} style={{ width: 300, marginLeft: 16, marginBottom: 20, backgroundColor: 'var(--surface)', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--surface-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(162,210,255,0.12)', border: '1.5px solid rgba(162,210,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: ORANGE, flexShrink: 0 }}>{(user?.name || 'A')[0].toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{user?.designation || user?.role}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '6px 0' }}>
              {profileLoading ? (
                <Loader label="Loading…" style={{ padding: '28px 0' }} />
              ) : PROFILE_FIELDS.map((f, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 20px', borderBottom: i < PROFILE_FIELDS.length - 1 ? '1px solid var(--surface-2)' : 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', maxWidth: 160, textAlign: 'right', wordBreak: 'break-all' }}>{f.value || '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => { setProfileOpen(false); setChangePwOpen(true); }} style={{ width: '100%', padding: '10px 0', borderRadius: 14, border: '1.5px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Change Password</button>
              <button className="nx-btn nx-btn-md nx-btn-danger-soft" onClick={() => { dispatch(logout()); router.replace('/company'); }} style={{ width: '100%', padding: '10px 0', borderRadius: 14, border: '1.5px solid var(--danger-2)', backgroundColor: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} onSuccess={() => { dispatch(logout()); router.replace('/company'); }} />
    </div>
  );
}

const s = {
  sidebar: { width: 230, minWidth: 230, height: '100vh', backgroundColor: 'var(--sidebar)', borderRight: '1px solid var(--border)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 1px 2px rgba(var(--ink-rgb),0.04), 0 8px 24px rgba(60,90,130,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px 18px', borderBottom: '1px solid rgba(var(--ink-rgb),0.048)' },
  logoCircle: { width: 36, height: 36, borderRadius: 14, backgroundColor: 'var(--surface)', padding: 5, overflow: 'hidden', flexShrink: 0 },
  logoName: { fontSize: 13, fontWeight: 800, color: 'var(--text)' },
  logoSub: { fontSize: 10, color: 'rgba(var(--ink-rgb),0.58)', marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.6, padding: '0 8px', marginBottom: 5 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 999, color: 'rgba(var(--ink-rgb),0.74)', marginBottom: 1, textDecoration: 'none', position: 'relative', overflow: 'hidden' },
  navActive: { background: 'var(--nav-active-bg)', color: 'var(--nav-active-fg)', fontWeight: 700, boxShadow: 'var(--nav-active-shadow)' },
  navChildActive: { backgroundColor: 'var(--accent-soft)', color: 'var(--text)' },
  activeBar: { position: 'absolute', left: 0, top: '18%', bottom: '18%', width: 3, backgroundColor: 'var(--primary)', borderRadius: '0 3px 3px 0' },
  iconWrap: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px', borderRadius: 14, backgroundColor: 'rgba(var(--ink-rgb),0.032)', border: '1px solid rgba(var(--ink-rgb),0.04)' },
  avatar: { width: 32, height: 32, borderRadius: 9, flexShrink: 0, backgroundColor: 'rgba(162,210,255,0.15)', border: '1px solid rgba(162,210,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: ORANGE },
  userName: { fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userBadge: { fontSize: 10, color: 'rgba(var(--ink-rgb),0.57)', marginTop: 2 },
  logoutBtn: { marginTop: 10, width: '100%', padding: '9px 0', borderRadius: 9, border: '1px solid rgba(217,67,75,0.3)', background: 'rgba(217,67,75,0.08)', color: 'rgba(217,67,75,0.85)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};
