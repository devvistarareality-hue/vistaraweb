'use client';
import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { logout } from '../../redux/actions/authActions';
import { fetchCompanies } from '../../redux/actions/companiesActions';
import { setAdminCompany, restoreAdminFilter } from '../../redux/reducers/adminFilterReducer';
import { AUTH_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import { moduleAccess, isSuperAdmin, canAccessModule, isClub1000Manager } from '../../lib/moduleAccess';

const ORANGE = '#FF6B2B';
const NAVY   = '#0C1E3C';
const TEAL   = '#00838F';

function SvgIcon({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function IconDashboard() { return <SvgIcon><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></SvgIcon>; }
function IconLayers()    { return <SvgIcon><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></SvgIcon>; }
function IconUsers()     { return <SvgIcon><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></SvgIcon>; }
function IconWallet()    { return <SvgIcon><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4z"/></SvgIcon>; }
function IconTeam()      { return <SvgIcon><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="21" x2="22" y2="19"/><line x1="19" y1="19" x2="25" y2="19"/><path d="M22 9a3 3 0 000 6"/></SvgIcon>; }
function IconBack()      { return <SvgIcon><polyline points="15 18 9 12 15 6"/></SvgIcon>; }
function IconGift()      { return <SvgIcon><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></SvgIcon>; }

const NAV = [
  { label: 'Dashboard',  href: '/club1000',            icon: <IconDashboard /> },
  { label: 'Schemes',    href: '/club1000/schemes',     icon: <IconLayers />, managerOnly: true },
  { label: 'Investors',  href: '/club1000/investors',   icon: <IconUsers /> },
  { label: 'Payouts',    href: '/club1000/payouts',     icon: <IconWallet />, managerOnly: true },
  { label: 'Referral Rewards', href: '/club1000/referral-rewards', icon: <IconGift />, managerOnly: true },
  { label: 'My Team',    href: '/club1000/my-team',     icon: <IconTeam />,   managerOnly: true },
];

const CSS = `
  .c1k-nav-link { transition: background 0.14s, color 0.14s; }
  .c1k-nav-link:hover { background: rgba(255,255,255,0.07) !important; color: rgba(255,255,255,0.9) !important; }
  .c1k-logout:hover { background: rgba(239,68,68,0.18) !important; border-color: rgba(239,68,68,0.4) !important; }
  .c1k-profile-btn { background: none; border: none; cursor: pointer; width: 100%; }
  .c1k-profile-btn:hover { background: rgba(255,255,255,0.07) !important; }
  .c1k-scroll::-webkit-scrollbar { width: 0; }
  .c1k-scroll { scrollbar-width: none; }
  @media (max-width: 768px) {
    .sidebar-close-btn { display: block !important; }
    .app-sidebar { position: fixed !important; left: 0; top: 0; height: 100% !important; transform: translateX(-100%); z-index: 200; }
    .app-sidebar.sidebar-open { transform: translateX(0) !important; }
    .mobile-header { display: flex !important; }
    .sidebar-open-active .sidebar-overlay { display: block; }
  }
`;

export default function Club1000Layout({ children }) {
  const user      = useSelector((s) => s.auth.user);
  const companies = useSelector((s) => s.companies.companies || []);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const dispatch  = useDispatch();
  const router    = useRouter();
  const pathname  = usePathname();

  const superAdmin = isSuperAdmin(user);
  const isVRLAdmin = superAdmin && user?.company_code === 'VRL';
  const manager = isClub1000Manager(user);

  // "Back to Modules" for anyone with more than one module to switch between
  // (matches the generic m/[module] shell's behaviour); admins go to /admin instead.
  const isAdmin = user?.role === 'Admin' || user?.is_staff;
  const moduleCount = (user?.modules || []).length;
  const back = superAdmin ? { href: '/admin', label: 'Back to Admin' }
    : isAdmin ? { href: '/admin', label: 'Back to Admin' }
    : moduleCount > 1 ? { href: '/dashboard', label: 'Back to Modules' }
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
  useEffect(() => {
    async function checkSession() {
      if (typeof window === 'undefined') return;
      if (!localStorage.getItem('access_token')) return;
      await apiFetch(AUTH_ENDPOINTS.me);
    }
    checkSession();
    window.addEventListener('focus', checkSession);
    const interval = setInterval(checkSession, 30_000);
    return () => {
      window.removeEventListener('focus', checkSession);
      clearInterval(interval);
    };
  }, []);

  // Box out users without Club 1000 access, and module-scoped admins who own a
  // different module (e.g. an HR Admin trying to reach /club1000).
  const { isModuleAdmin: _isModAdmin, home: _modHome } = moduleAccess(user);
  const _blocked = user && !canAccessModule(user, 'Club 1000') && _isModAdmin;
  const _noAccess = user && !_isModAdmin && !canAccessModule(user, 'Club 1000');
  useEffect(() => {
    if (user === null) return;
    if (!user) { router.replace('/company'); return; }
    if (_blocked) router.replace(_modHome);
    else if (_noAccess) router.replace('/admin');
  }, [user]);

  if (_blocked || _noAccess) return null;

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #050D1A, #0C1E3C)' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(0,131,143,0.3)', borderTopColor: TEAL, animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isActive = (href) => href === '/club1000' ? pathname === '/club1000' : pathname.startsWith(href);

  function handleLogout() {
    dispatch(logout());
    router.replace('/company');
  }

  function handleCompanyChange(e) {
    const val = e.target.value;
    dispatch(setAdminCompany(val ? parseInt(val, 10) : null));
  }

  async function openProfile() {
    setProfileOpen(true);
    setProfileLoading(true);
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
    { label: 'Designation',       value: profileData?.designation },
    { label: 'Reporting Manager', value: profileData?.reporting_manager?.name },
  ];

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open-active' : ''}`}>
      <style suppressHydrationWarning>{CSS}</style>

      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />

      <div style={s.sidebar} className={`app-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div style={{ ...s.logoRow, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={s.logoCircle}>
              <img src="/image-WBG.png" alt="Vistara" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={s.logoName}>Club 1000</div>
              <div style={s.logoSub}>{manager ? 'Manager' : 'Investment Desk'}</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 20, padding: '2px 6px', lineHeight: 1, display: 'none' }} className="sidebar-close-btn">✕</button>
        </div>

        <div className="c1k-scroll" style={s.scroll}>
          <div style={s.sectionLabel}>CLUB 1000</div>
          {NAV.filter(item => !item.managerOnly || manager).map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} className="c1k-nav-link"
                style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
                {active && <div style={s.activeBar} />}
                <span style={{ ...s.iconWrap, color: active ? TEAL : 'rgba(255,255,255,0.38)' }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 10px', borderRadius: 6, backgroundColor: 'rgba(0,131,143,0.12)', border: '1px solid rgba(0,131,143,0.25)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: TEAL, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: TEAL }}>
                    {companies.find(c => c.id === companyId)?.name || 'Filtered'}
                  </span>
                </div>
              )}
            </div>
          )}

          {back && (
            <>
              <div style={{ ...s.sectionLabel, marginTop: 22 }}>NAVIGATE</div>
              <Link href={back.href} className="c1k-nav-link" style={s.navItem}>
                <span style={{ ...s.iconWrap, color: 'rgba(255,255,255,0.38)' }}><IconBack /></span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{back.label}</span>
              </Link>
            </>
          )}
        </div>

        <div style={s.bottomArea}>
          <div style={s.divider} />
          <button onClick={openProfile} className="c1k-profile-btn" style={s.userRow}>
            <div style={s.avatar}>{(user?.name || 'A')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={s.userName}>{user?.name || 'User'}</div>
              <div style={s.userBadge}>{user?.designation || user?.role || 'User'}</div>
            </div>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
          <button onClick={handleLogout} className="c1k-logout" style={s.logoutBtn}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {profileOpen && (
        <div onClick={() => setProfileOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 300, marginLeft: 16, marginBottom: 20,
            backgroundColor: '#fff', borderRadius: 18,
            boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F0F3FA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 13,
                  backgroundColor: 'rgba(0,131,143,0.12)',
                  border: '1.5px solid rgba(0,131,143,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: TEAL, flexShrink: 0,
                }}>
                  {(user?.name || 'A')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1A2E' }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: '#8492A6', marginTop: 2 }}>{user?.designation || user?.role}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '6px 0' }}>
              {profileLoading ? (
                <div style={{ padding: '28px 0', textAlign: 'center', color: '#8492A6', fontSize: 13 }}>Loading…</div>
              ) : PROFILE_FIELDS.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 20px',
                  borderBottom: i < PROFILE_FIELDS.length - 1 ? '1px solid #F5F6FA' : 'none',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', maxWidth: 160, textAlign: 'right', wordBreak: 'break-all' }}>{f.value || '—'}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => { setProfileOpen(false); setChangePwOpen(true); }} style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                border: '1.5px solid #E5E7EB', backgroundColor: '#fff',
                color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                Change Password
              </button>
              <button onClick={handleLogout} style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                border: '1.5px solid #FECACA', backgroundColor: '#FEF2F2',
                color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} onSuccess={handleLogout} />

      <div className="app-main" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="mobile-header">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Club 1000</span>
        </div>
        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          {children}
        </main>
      </div>
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
    width: 3, backgroundColor: TEAL, borderRadius: '0 3px 3px 0',
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
    backgroundColor: 'rgba(0,131,143,0.15)',
    border: '1px solid rgba(0,131,143,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 800, color: TEAL,
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
