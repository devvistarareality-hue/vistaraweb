'use client';
import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { logout } from '../../../redux/actions/authActions';
import { fetchCompanies } from '../../../redux/actions/companiesActions';
import { restoreAdminFilter, setAdminCompany } from '../../../redux/reducers/adminFilterReducer';
import { MODULE_META } from './moduleMeta';
import { moduleAccess, SLUG_TO_MODULE } from '../../../lib/moduleAccess';
import { AUTH_ENDPOINTS } from '../../../constants/api';
import ChangePasswordModal from '../../../components/ChangePasswordModal';

const ORANGE = '#FF6B2B';
const NAVY = '#0C1E3C';

function SvgIcon({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );
}
const IconGrid  = () => <SvgIcon><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></SvgIcon>;
const IconUsers = () => <SvgIcon><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></SvgIcon>;
const IconBook  = () => <SvgIcon><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></SvgIcon>;
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
    if (blockedHere) router.replace(home);
  }, [user, slug]);

  const isAdmin = user?.role === 'Admin' || user?.is_staff;
  const isManager = user?.role === 'Manager';
  const base = `/m/${slug}`;
  const NAV = [
    { label: 'Overview', href: base, icon: <IconGrid /> },
    // My Team is a management view — only managers/admins see it.
    ...((isManager || isAdmin) ? [{ label: 'My Team', href: `${base}/team`, icon: <IconUsers /> }] : []),
    // Accounts & Finance: read-only view of all sales bookings (LOI / EOI details).
    ...(slug === 'accounts' ? [{ label: 'Bookings', href: `${base}/bookings`, icon: <IconBook /> }] : []),
  ];
  // "Back to Modules" only makes sense when the user actually has more than one module
  // to switch between (or is an admin). A single-module employee is boxed into it.
  const moduleCount = (user?.modules || []).length;
  const back = isAdmin ? { href: '/admin', label: 'Back to Admin' }
    : moduleCount > 1 ? { href: '/dashboard', label: 'Back to Modules' }
    : null;
  const isActive = (href) => href === base ? pathname === base : pathname.startsWith(href);

  if (!meta) {
    return <div style={{ padding: 40 }}>Unknown module.</div>;
  }
  if (blockedHere) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={s.sidebar}>
        <div style={s.logoRow}>
          <div style={s.logoCircle}><img src="/image-WBG.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          <div>
            <div style={s.logoName}>{meta.name}</div>
            <div style={s.logoSub}>Vistara ERP</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '16px 10px 0' }}>
          <div style={s.sectionLabel}>{meta.name.toUpperCase()} MENU</div>
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
                {active && <div style={s.activeBar} />}
                <span style={{ ...s.iconWrap, color: active ? ORANGE : 'rgba(255,255,255,0.38)' }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
              </Link>
            );
          })}
          {isVRLAdmin && companies.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ ...s.sectionLabel, marginBottom: 7 }}>VIEWING COMPANY</div>
              <div style={{ position: 'relative' }}>
                <select value={companyId ?? ''} onChange={handleCompanyChange}
                  style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9, padding: '8px 28px 8px 12px', color: companyId ? '#fff' : 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                  <option value="" style={{ backgroundColor: '#0C1E3C', color: 'rgba(255,255,255,0.5)' }}>All Companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id} style={{ backgroundColor: '#0C1E3C', color: '#fff' }}>{c.name}</option>
                  ))}
                </select>
                <svg style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {companyId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 10px', borderRadius: 6, backgroundColor: 'rgba(255,107,43,0.12)', border: '1px solid rgba(255,107,43,0.22)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: ORANGE, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: ORANGE }}>{companies.find((c) => c.id === companyId)?.name || 'Filtered'}</span>
                </div>
              )}
            </div>
          )}

          {back && <>
            <div style={{ ...s.sectionLabel, marginTop: 22 }}>NAVIGATE</div>
            <Link href={back.href} style={s.navItem}>
              <span style={{ ...s.iconWrap, color: 'rgba(255,255,255,0.38)' }}><IconBack /></span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{back.label}</span>
            </Link>
          </>}
        </div>
        <div style={{ padding: '0 10px 18px' }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 14 }} />
          <button onClick={openProfile} style={{ ...s.userRow, width: '100%', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', textAlign: 'left' }}>
            <div style={s.avatar}>{(user?.name || 'A')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.userName}>{user?.name || 'User'}</div>
              <div style={s.userBadge}>{user?.designation || user?.role || 'Admin'}</div>
            </div>
          </button>
          <button onClick={() => { dispatch(logout()); router.replace('/company'); }} style={s.logoutBtn}>Sign Out</button>
        </div>
      </div>
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0, background: '#DFE4EE' }}>{children}</main>

      {/* ── Profile Modal ── */}
      {profileOpen && (
        <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 300, marginLeft: 16, marginBottom: 20, backgroundColor: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F0F3FA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,107,43,0.12)', border: '1.5px solid rgba(255,107,43,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: ORANGE, flexShrink: 0 }}>{(user?.name || 'A')[0].toUpperCase()}</div>
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
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 20px', borderBottom: i < PROFILE_FIELDS.length - 1 ? '1px solid #F5F6FA' : 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', maxWidth: 160, textAlign: 'right', wordBreak: 'break-all' }}>{f.value || '—'}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => { setProfileOpen(false); setChangePwOpen(true); }} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px solid #E5E7EB', backgroundColor: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Change Password</button>
              <button onClick={() => { dispatch(logout()); router.replace('/company'); }} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: '1.5px solid #FECACA', backgroundColor: '#FEF2F2', color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} onSuccess={() => { dispatch(logout()); router.replace('/company'); }} />
    </div>
  );
}

const s = {
  sidebar: { width: 230, minWidth: 230, height: '100vh', backgroundColor: NAVY, display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  logoCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', padding: 5, overflow: 'hidden', flexShrink: 0 },
  logoName: { fontSize: 13, fontWeight: 800, color: '#fff' },
  logoSub: { fontSize: 10, color: 'rgba(255,255,255,0.36)', marginTop: 2 },
  sectionLabel: { fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.24)', letterSpacing: 1.8, padding: '0 8px', marginBottom: 5 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px 9px 14px', borderRadius: 9, color: 'rgba(255,255,255,0.52)', marginBottom: 1, textDecoration: 'none', position: 'relative', overflow: 'hidden' },
  navActive: { backgroundColor: 'rgba(255,255,255,0.09)', color: '#fff' },
  activeBar: { position: 'absolute', left: 0, top: '18%', bottom: '18%', width: 3, backgroundColor: ORANGE, borderRadius: '0 3px 3px 0' },
  iconWrap: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' },
  avatar: { width: 32, height: 32, borderRadius: 9, flexShrink: 0, backgroundColor: 'rgba(255,107,43,0.15)', border: '1px solid rgba(255,107,43,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: ORANGE },
  userName: { fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userBadge: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  logoutBtn: { marginTop: 10, width: '100%', padding: '9px 0', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.85)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};
