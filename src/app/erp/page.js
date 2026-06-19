'use client';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { useState, useEffect } from 'react';
import { ERP_EXECUTION, ERP_PURCHASE, ERP_INVENTORY } from '../../constants/api';

const NAVY   = '#0C1E3C';
const ORANGE = '#FF6B2B';
const GREEN  = '#2E7D32';

const CSS = `
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  .erp-card { transition: transform 0.2s ease, box-shadow 0.2s ease; animation: fadeUp 0.4s ease both; }
  .erp-card:hover { transform: translateY(-4px); box-shadow: 0 20px 48px rgba(0,0,0,0.13) !important; }
  .open-arrow { display:inline-block; transition: transform 0.15s; }
  .erp-card:hover .open-arrow { transform: translateX(4px); }
`;

function SvgIcon({ d, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );
}

const ERP_MODULES = [
  {
    name: 'Purchase Requisitions', desc: 'Raise and track material requests from site',
    icon: <SvgIcon d={<><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>} size={26}/>,
    accent: { bg: '#C8E6C9', icon: GREEN, gradient: 'rgba(46,125,50,0.14)' }, href: '/erp/pr',
  },
  {
    name: 'Purchase Orders', desc: 'Create POs from approved requisitions',
    icon: <SvgIcon d={<><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></>} size={26}/>,
    accent: { bg: '#FFCCBC', icon: '#E65100', gradient: 'rgba(230,81,0,0.14)' }, href: '/erp/po',
  },
  {
    name: 'Goods Receipt (GRN)', desc: 'Record material receipts and run QC',
    icon: <SvgIcon d={<><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>} size={26}/>,
    accent: { bg: '#B2EBF2', icon: '#0097A7', gradient: 'rgba(0,151,167,0.14)' }, href: '/erp/grn',
  },
  {
    name: 'Stock Balance', desc: 'Real-time material stock per project',
    icon: <SvgIcon d={<><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>} size={26}/>,
    accent: { bg: '#FFF9C4', icon: '#F9A825', gradient: 'rgba(249,168,37,0.14)' }, href: '/erp/stock',
  },
  {
    name: 'Measurement Book', desc: 'Record work progress and certify MBs',
    icon: <SvgIcon d={<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>} size={26}/>,
    accent: { bg: '#E1BEE7', icon: '#6A1B9A', gradient: 'rgba(106,27,154,0.14)' }, href: '/erp/mb',
  },
  {
    name: 'Vendor Invoices', desc: '3-way match, approve and track payments',
    icon: <SvgIcon d={<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>} size={26}/>,
    accent: { bg: '#BBDEFB', icon: '#182350', gradient: 'rgba(24,35,80,0.10)' }, href: '/erp/invoices',
  },
  {
    name: 'Vendors', desc: 'Vendor master — contacts, GSTIN, terms',
    icon: <SvgIcon d={<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></>} size={26}/>,
    accent: { bg: '#D1C4E9', icon: '#3D5AFE', gradient: 'rgba(61,90,254,0.12)' }, href: '/erp/vendors',
  },
];

async function fetchCount(url, token) {
  try {
    const res = await fetch(`${url}?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return '—';
    const d = await res.json();
    return d?.count ?? (Array.isArray(d) ? d.length : '—');
  } catch { return '—'; }
}

export default function ERPOverviewPage() {
  const { user } = useSelector((s) => s.auth);
  const [stats, setStats] = useState({ prs: '—', pos: '—', grns: '—' });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) return;
    Promise.all([
      fetchCount(ERP_EXECUTION.prs, token),
      fetchCount(ERP_PURCHASE.pos, token),
      fetchCount(ERP_INVENTORY.grns, token),
    ]).then(([prs, pos, grns]) => setStats({ prs, pos, grns }));
  }, []);

  return (
    <div style={s.page}>
      <style suppressHydrationWarning>{CSS}</style>

      {/* Hero */}
      <div style={s.hero}>
        <div style={s.heroDots} />
        <div style={s.heroGlow} />
        <div style={s.heroInner}>
          <div>
            <div style={s.heroSub}>Construction ERP</div>
            <div style={s.heroTitle}>Execution Module</div>
            <div style={s.heroMeta}>PR → PO → GRN → Issue → Invoice → Payment</div>
          </div>
          <div style={s.chips}>
            {[['PRs', stats.prs, '#4ADE80'], ['POs', stats.pos, ORANGE], ['GRNs', stats.grns, '#38BDF8']].map(([label, val, color]) => (
              <div key={label} style={s.chip}>
                <div style={{ ...s.chipNum, color }}>{val}</div>
                <div style={s.chipLabel}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={s.heroStrip}>
          <span style={s.stripItem}>ERP</span>
          <span style={s.stripSep}>›</span>
          <span style={{ ...s.stripItem, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>Overview</span>
        </div>
      </div>

      {/* Module grid */}
      <div style={s.section}>
        <div style={s.sectionHead}>
          <div style={s.sectionLabel}>ALL ERP MODULES</div>
          <div style={s.sectionSub}>Select a module to get started</div>
        </div>
        <div style={s.grid}>
          {ERP_MODULES.map((mod, i) => (
            <Link
              key={mod.name}
              href={mod.href}
              className="erp-card"
              style={{ ...s.card, textDecoration: 'none', animationDelay: `${i * 70}ms` }}
            >
              <div style={{ ...s.cardBand, background: `linear-gradient(to bottom, ${mod.accent.gradient}, rgba(255,255,255,0))` }}>
                <div style={{ ...s.cardIcon, backgroundColor: mod.accent.bg, color: mod.accent.icon }}>
                  {mod.icon}
                </div>
              </div>
              <div style={s.cardBody}>
                <div style={s.cardName}>{mod.name}</div>
                <div style={s.cardDesc}>{mod.desc}</div>
                <div style={{ ...s.cardLink, color: mod.accent.icon }}>
                  Open <span className="open-arrow" style={{ marginLeft: 4 }}>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', backgroundColor: '#DFE4EE' },
  hero: {
    background: `linear-gradient(145deg, #070F20 0%, ${NAVY} 50%, #162040 100%)`,
    margin: '24px 24px 0', borderRadius: 20,
    position: 'relative', overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
  },
  heroDots: {
    position: 'absolute', inset: 0,
    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
    backgroundSize: '22px 22px', pointerEvents: 'none',
  },
  heroGlow: {
    position: 'absolute', right: -80, top: -80,
    width: 320, height: 320, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(46,125,50,0.14) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  heroInner: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '36px 40px 28px', position: 'relative', zIndex: 1,
    flexWrap: 'wrap', gap: 20,
  },
  heroSub:   { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 500, letterSpacing: 0.5 },
  heroTitle: { fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: -0.5, marginBottom: 10 },
  heroMeta:  { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 400 },
  chips:     { display: 'flex', gap: 12 },
  chip:      { backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 20px', textAlign: 'center', minWidth: 80 },
  chipNum:   { fontSize: 26, fontWeight: 800, lineHeight: 1 },
  chipLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: 500 },
  heroStrip: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 40px 12px', position: 'relative', zIndex: 1,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  stripItem: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 },
  stripSep:  { color: 'rgba(255,255,255,0.2)', fontSize: 13 },
  section:   { padding: '28px 24px 48px' },
  sectionHead:  { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: 800, color: '#8492A6', letterSpacing: 1.6 },
  sectionSub:   { fontSize: 12, color: '#B0BAC9', fontWeight: 400 },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card:    { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.04)' },
  cardBand:{ padding: '22px 24px 14px', minHeight: 72 },
  cardIcon:{ width: 50, height: 50, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  cardBody:{ padding: '0 24px 24px' },
  cardName:{ fontSize: 16, fontWeight: 800, color: '#1A1A2E', marginBottom: 6 },
  cardDesc:{ fontSize: 13, color: '#8A97AB', lineHeight: 1.6, marginBottom: 16 },
  cardLink:{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center' },
};
