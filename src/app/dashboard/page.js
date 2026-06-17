'use client';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { MODULE_ACCENT } from '../../constants/theme';

const MODULE_CONFIG = {
  'Sales':     { accent: MODULE_ACCENT.Sales,     href: '/placeholder?title=Sales',     sub: 'Leads & Pipeline' },
  'HR':        { accent: MODULE_ACCENT.HR,        href: '/placeholder?title=HR',        sub: 'People & Attendance' },
  'Execution': { accent: MODULE_ACCENT.Execution, href: '/placeholder?title=Execution', sub: 'Tasks & Progress' },
  'Purchase':  { accent: MODULE_ACCENT.Purchase,  href: '/placeholder?title=Purchase',  sub: 'Vendors & Orders' },
  'Land':      { accent: MODULE_ACCENT.Land,      href: '/placeholder?title=Land',      sub: 'Properties & Sites' },
};

export default function DashboardPage() {
  const user = useSelector((s) => s.auth.user);
  const userModules = (user?.modules || []).filter((m) => MODULE_CONFIG[m]);

  return (
    <div>
      {/* Welcome header */}
      <div style={s.header}>
        <div>
          <p style={s.welcomeLabel}>Welcome back</p>
          <h1 style={s.userName}>{user?.name}</h1>
        </div>
        <div style={s.statBlock}>
          <span style={s.statNum}>{userModules.length}</span>
          <span style={s.statLabel}>Assigned Modules</span>
        </div>
      </div>

      {/* Modules */}
      <p style={s.sectionTitle}>MY MODULES</p>

      {userModules.length === 0 ? (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#B0BAC9" strokeWidth="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
          </div>
          <p style={s.emptyTitle}>No modules assigned yet</p>
          <p style={s.emptyDesc}>Contact your administrator to get access to modules.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {userModules.map((modName) => {
            const mod = MODULE_CONFIG[modName];
            return (
              <Link key={modName} href={mod.href} style={s.card}>
                <div style={{ ...s.iconBg, backgroundColor: mod.accent.bg }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: mod.accent.icon, opacity: 0.85 }} />
                </div>
                <p style={s.cardName}>{modName}</p>
                <p style={s.cardSub}>{mod.sub}</p>
                <span style={{ ...s.openArrow, color: mod.accent.icon }}>Open →</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  header: {
    display:         'flex',
    justifyContent:  'space-between',
    alignItems:      'center',
    backgroundColor: '#182350',
    borderRadius:    18,
    padding:         '28px 32px',
    marginBottom:    32,
  },
  welcomeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  userName:     { fontSize: 26, fontWeight: 800, color: '#fff' },
  statBlock: {
    textAlign:       'right',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius:    14,
    padding:         '14px 22px',
  },
  statNum:   { display: 'block', fontSize: 30, fontWeight: 800, color: '#B9915E' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: '#8492A6',
    letterSpacing: 0.8, marginBottom: 16,
  },
  grid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap:                 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius:    16,
    padding:         '22px',
    boxShadow:       '0 4px 12px rgba(184,196,214,0.18)',
    display:         'flex',
    flexDirection:   'column',
    cursor:          'pointer',
    textDecoration:  'none',
  },
  iconBg: {
    width: 52, height: 52, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  cardName:  { fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 },
  cardSub:   { fontSize: 12, color: '#8492A6', marginBottom: 14, flex: 1 },
  openArrow: { fontSize: 12, fontWeight: 700 },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '80px 20px', textAlign: 'center',
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: '50%',
    backgroundColor: '#EEF1F7',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 },
  emptyDesc:  { fontSize: 14, color: '#8492A6', maxWidth: 300 },
};
