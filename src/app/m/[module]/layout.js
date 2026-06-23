'use client';
import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { logout } from '../../../redux/actions/authActions';
import { fetchCompanies } from '../../../redux/actions/companiesActions';
import { restoreAdminFilter } from '../../../redux/reducers/adminFilterReducer';
import { MODULE_META } from './moduleMeta';

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
const IconBack  = () => <SvgIcon><polyline points="15 18 9 12 15 6"/></SvgIcon>;

export default function ModuleLayout({ children, params }) {
  const slug = params.module;
  const meta = MODULE_META[slug];
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();

  const isVRLAdmin = user?.company_code === 'VRL' && (user?.role === 'Admin' || user?.is_staff);
  useEffect(() => { dispatch(restoreAdminFilter()); if (isVRLAdmin) dispatch(fetchCompanies()); }, [isVRLAdmin]);
  useEffect(() => { if (user === null) return; if (!user) router.replace('/company'); }, [user]);

  const base = `/m/${slug}`;
  const NAV = [
    { label: 'Overview', href: base,            icon: <IconGrid /> },
    { label: 'My Team',  href: `${base}/team`,  icon: <IconUsers /> },
  ];
  const isActive = (href) => href === base ? pathname === base : pathname.startsWith(href);

  if (!meta) {
    return <div style={{ padding: 40 }}>Unknown module.</div>;
  }

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
          <div style={{ ...s.sectionLabel, marginTop: 22 }}>NAVIGATE</div>
          <Link href="/admin" style={s.navItem}>
            <span style={{ ...s.iconWrap, color: 'rgba(255,255,255,0.38)' }}><IconBack /></span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Back to Admin</span>
          </Link>
        </div>
        <div style={{ padding: '0 10px 18px' }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 14 }} />
          <div style={s.userRow}>
            <div style={s.avatar}>{(user?.name || 'A')[0].toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.userName}>{user?.name || 'User'}</div>
              <div style={s.userBadge}>{user?.designation || user?.role || 'Admin'}</div>
            </div>
          </div>
          <button onClick={() => { dispatch(logout()); router.replace('/company'); }} style={s.logoutBtn}>Sign Out</button>
        </div>
      </div>
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0, background: '#DFE4EE' }}>{children}</main>
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
