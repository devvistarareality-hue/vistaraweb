'use client';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { useState, useEffect } from 'react';
import { moduleAccess } from '../../lib/moduleAccess';

const NAVY   = '#0C1E3C';
const ORANGE = '#FF6B2B';

const CSS = `
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  .mod-card-open  { transition: transform 0.2s ease, box-shadow 0.2s ease; animation: fadeUp 0.4s ease both; }
  .mod-card-open:hover  { transform: translateY(-4px); box-shadow: 0 20px 48px rgba(0,0,0,0.13) !important; }
  .mod-card-soon  { transition: transform 0.18s ease, box-shadow 0.18s ease; animation: fadeUp 0.4s ease both; }
  .mod-card-soon:hover  { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(0,0,0,0.09) !important; }
  .open-arrow { display:inline-block; transition: transform 0.15s; }
  .mod-card-open:hover .open-arrow { transform: translateX(4px); }
`;

function ModuleIcon({ type, size = 20 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const icons = {
    users:     <svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    building:  <svg {...p}><path d="M3 21h18M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/></svg>,
    clock:     <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    trending:  <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    people:    <svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
    checklist: <svg {...p}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
    cart:      <svg {...p}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>,
    map:       <svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    wallet:    <svg {...p}><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg>,
    coins:     <svg {...p}><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1110.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/></svg>,
  };
  return icons[type] || null;
}

const MODULES = [
  { name: 'User Management',    desc: 'Manage employees, roles and access',          icon: 'users',     accent: { bg: '#9FABF8', icon: '#3D5AFE', gradient: 'rgba(61,90,254,0.22)'  }, href: '/admin/users',                    soon: false },
  { name: 'Company Management', desc: 'Workspaces, settings and company data',        icon: 'building',  accent: { bg: '#7DD4DE', icon: '#0097A7', gradient: 'rgba(0,151,167,0.22)'  }, href: '/admin/companies',                soon: false },
  { name: 'Sales',              desc: 'Revenue tracking and deal management',         icon: 'trending',  accent: { bg: '#FFC837', icon: '#F9A825', gradient: 'rgba(249,168,37,0.22)' }, href: '/sales',                          soon: false },
  { name: 'HR',                 desc: 'People, org chart and team structure',         icon: 'people',    accent: { bg: '#9FABF8', icon: '#3D5AFE', gradient: 'rgba(61,90,254,0.22)'  }, href: '/m/hr',                           soon: false },
  { name: 'Accounts & Finance', desc: 'Accounting, payments and financials',          icon: 'wallet',    accent: { bg: '#7DD4C8', icon: '#0D9488', gradient: 'rgba(13,148,136,0.22)' }, href: '/m/accounts',                     soon: false },
  { name: 'Execution',          desc: 'Tasks, milestones and project delivery',       icon: 'checklist', accent: { bg: '#81C784', icon: '#2E7D32', gradient: 'rgba(46,125,50,0.22)'  }, href: '/m/execution',                    soon: false },
  { name: 'Purchase',           desc: 'Vendor management and order tracking',         icon: 'cart',      accent: { bg: '#FFB74D', icon: '#E65100', gradient: 'rgba(230,81,0,0.22)'   }, href: '/m/purchase',                     soon: false },
  { name: 'Land',               desc: 'Property portfolio and site management',       icon: 'map',       accent: { bg: '#BA68C8', icon: '#7B1FA2', gradient: 'rgba(123,31,162,0.22)' }, href: '/m/land',                         soon: false },
  { name: 'Club 1000',          desc: 'Investment portfolio and returns tracking',    icon: 'coins',     accent: { bg: '#80DEEA', icon: '#00838F', gradient: 'rgba(0,131,143,0.22)'  }, href: '/club1000',                       soon: false },
];

const openMods = MODULES.filter((m) => !m.soon);
const soonMods = MODULES.filter((m) => m.soon);

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDateStr() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function AdminDashboardPage() {
  const { user, company } = useSelector((s) => s.auth);
  const [greeting, setGreeting] = useState('');
  const [dateStr,  setDateStr]  = useState('');
  // Module-scoped admins only see their own module tiles (User/Company Mgmt are hidden).
  const { superAdmin, isModuleAdmin, allowed } = moduleAccess(user);
  const visibleOpen = (superAdmin || !isModuleAdmin) ? openMods : openMods.filter((m) => allowed.includes(m.name));

  useEffect(() => {
    setGreeting(getGreeting());
    setDateStr(getDateStr());
  }, []);

  return (
    <div style={s.page}>
      <style suppressHydrationWarning>{CSS}</style>

      {/* ═══ HERO ═══ */}
      <div style={s.hero} className="admin-hero">
        <div style={s.heroDots} />
        <div style={s.heroGlowTR} />
        <div style={s.heroGlowBL} />

        <div style={s.heroInner} className="admin-hero-inner">
          {/* Left: greeting */}
          <div>
            <div style={s.heroGreet}>{greeting || 'Welcome back'}</div>
            <div style={s.heroName}>{user?.name?.toUpperCase() || 'ADMIN'}</div>
            <div style={s.heroMeta}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>{dateStr || '—'}</span>
              {company?.name && <><span style={{ opacity: 0.3 }}>·</span><span>{company.name}</span></>}
            </div>
          </div>

          {/* Right: stat chips */}
          <div style={s.heroChips}>
            <div style={s.chip}>
              <div style={{ ...s.chipDot, backgroundColor: ORANGE, boxShadow: `0 0 0 4px rgba(255,107,43,0.18)` }} />
              <div>
                <div style={s.chipNum}>{visibleOpen.length}</div>
                <div style={s.chipLabel}>Active Modules</div>
              </div>
            </div>
            <div style={s.chip}>
              <div style={{ ...s.chipDot, backgroundColor: '#4ADE80', boxShadow: '0 0 0 4px rgba(74,222,128,0.15)' }} />
              <div>
                <div style={{ ...s.chipLabel, color: '#4ADE80', fontWeight: 700, fontSize: 12 }}>System Online</div>
                <div style={{ ...s.chipLabel, fontSize: 10, marginTop: 1 }}>All services operational</div>
              </div>
            </div>
          </div>
        </div>

        {/* Breadcrumb strip */}
        <div style={s.heroStrip}>
          <span style={s.stripItem}>Admin</span>
          <span style={s.stripSep}>›</span>
          <span style={{ ...s.stripItem, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Dashboard</span>
        </div>
      </div>

      {/* ═══ QUICK ACCESS ═══ */}
      <div style={s.section} className="admin-section">
        <div style={s.sectionHead}>
          <div style={s.sectionLabel}>QUICK ACCESS</div>
          <div style={s.sectionSub}>Your enabled modules</div>
        </div>
        <div style={s.openGrid}>
          {visibleOpen.map((mod, i) => (
            <Link
              key={mod.name}
              href={mod.href}
              className="mod-card-open"
              style={{ ...s.openCard, textDecoration: 'none', animationDelay: `${i * 80}ms` }}
            >
              {/* Gradient header band */}
              <div style={{ ...s.openBand, background: `linear-gradient(to bottom, ${mod.accent.gradient} 0%, rgba(255,255,255,0) 100%)` }}>
                <div style={{ ...s.openIcon, backgroundColor: mod.accent.bg, color: mod.accent.icon }}>
                  <ModuleIcon type={mod.icon} size={26} />
                </div>
              </div>
              <div style={s.openBody}>
                <div style={s.openName}>{mod.name}</div>
                <div style={s.openDesc}>{mod.desc}</div>
                <div style={{ ...s.openLink, color: mod.accent.icon }}>
                  Open module <span className="open-arrow" style={{ marginLeft: 4 }}>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ═══ ALL MODULES ═══ */}
      {soonMods.length > 0 && (
      <div style={{ ...s.section, paddingBottom: 48 }}>
        <div style={s.sectionHead}>
          <div style={s.sectionLabel}>ALL MODULES</div>
          <div style={s.sectionSub}>Launching soon</div>
        </div>
        <div style={s.soonGrid}>
          {soonMods.map((mod, i) => (
            <Link
              key={mod.name}
              href={mod.href}
              className="mod-card-soon"
              style={{ ...s.soonCard, textDecoration: 'none', animationDelay: `${i * 60 + 160}ms` }}
            >
              <div style={{ ...s.soonIcon, backgroundColor: mod.accent.bg, color: mod.accent.icon }}>
                <ModuleIcon type={mod.icon} size={20} />
              </div>
              <div style={s.soonName}>{mod.name}</div>
              <div style={s.soonDesc}>{mod.desc}</div>
              <div style={s.soonBadge}>COMING SOON</div>
            </Link>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', backgroundColor: '#DFE4EE' },

  /* ── Hero ── */
  hero: {
    background: `linear-gradient(145deg, #070F20 0%, ${NAVY} 50%, #162040 100%)`,
    margin: '24px 24px 0',
    borderRadius: 20,
    position: 'relative', overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
  },
  heroDots: {
    position: 'absolute', inset: 0,
    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
    backgroundSize: '22px 22px', pointerEvents: 'none',
  },
  heroGlowTR: {
    position: 'absolute', right: -80, top: -80,
    width: 320, height: 320, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,107,43,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  heroGlowBL: {
    position: 'absolute', left: -60, bottom: -60,
    width: 220, height: 220, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(61,90,254,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  heroInner: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '36px 40px 28px', position: 'relative', zIndex: 1,
    flexWrap: 'wrap', gap: 20,
  },
  heroGreet: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 8, fontWeight: 500, letterSpacing: 0.3 },
  heroName:  { fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: -0.5, marginBottom: 10 },
  heroMeta:  { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.38)', fontWeight: 400 },
  heroChips: { display: 'flex', flexDirection: 'column', gap: 10 },
  chip: {
    display: 'flex', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 12, padding: '12px 18px', minWidth: 180,
  },
  chipDot:   { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  chipNum:   { fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 },
  chipLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontWeight: 500 },
  heroStrip: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 40px 12px', position: 'relative', zIndex: 1,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  stripItem: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 },
  stripSep:  { color: 'rgba(255,255,255,0.2)', fontSize: 13 },

  /* ── Sections ── */
  section: { padding: '28px 24px 0' },
  sectionHead:  { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: 800, color: '#8492A6', letterSpacing: 1.6 },
  sectionSub:   { fontSize: 12, color: '#B0BAC9', fontWeight: 400 },

  /* ── Open cards ── */
  openGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  openCard: {
    backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
    cursor: 'pointer', border: '1px solid rgba(0,0,0,0.04)',
  },
  openBand: { padding: '24px 26px 16px', minHeight: 76 },
  openIcon: {
    width: 52, height: 52, borderRadius: 15,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
  },
  openBody: { padding: '0 26px 26px' },
  openName: { fontSize: 17, fontWeight: 800, color: '#1A1A2E', marginBottom: 6 },
  openDesc: { fontSize: 13, color: '#8A97AB', lineHeight: 1.6, marginBottom: 18 },
  openLink: { fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center' },

  /* ── Soon cards ── */
  soonGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 },
  soonCard: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: '22px 20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    cursor: 'pointer', border: '1px solid rgba(0,0,0,0.04)',
  },
  soonIcon: {
    width: 44, height: 44, borderRadius: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  soonName:  { fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 6 },
  soonDesc:  { fontSize: 12, color: '#A0AABB', lineHeight: 1.55, marginBottom: 14 },
  soonBadge: {
    fontSize: 9, fontWeight: 800, letterSpacing: 0.9,
    color: '#B9915E', backgroundColor: '#FFF3E0',
    borderRadius: 5, padding: '3px 8px', display: 'inline-block',
  },
};
