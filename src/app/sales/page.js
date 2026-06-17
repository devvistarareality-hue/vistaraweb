'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { SALES_ENDPOINTS } from '../../constants/api';

function SvgIcon({ children, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function IconPhone()    { return <SvgIcon><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.11 8.81 19.79 19.79 0 011.11 2.2 2 2 0 013.11 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></SvgIcon>; }
function IconTrend()    { return <SvgIcon><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></SvgIcon>; }
function IconPin()      { return <SvgIcon><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></SvgIcon>; }
function IconBuilding() { return <SvgIcon><path d="M3 21h18M9 8h.01M9 12h.01M9 16h.01M15 8h.01M15 12h.01M15 16h.01M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/></SvgIcon>; }
function IconActivity() { return <SvgIcon><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></SvgIcon>; }

const STATUS_COLOR = {
  new:              '#3D5AFE',
  assigned:         '#7B1FA2',
  contacted:        '#0097A7',
  not_reachable:    '#9E9E9E',
  warm_transferred: '#FF6B2B',
  sv_scheduled:     '#F9A825',
  sv_done:          '#2E7D32',
  closed:           '#1B5E20',
  lost:             '#B71C1C',
};

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || '#9E9E9E';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
      backgroundColor: color + '18', color,
    }}>
      {status?.replace(/_/g, ' ').toUpperCase()}
    </span>
  );
}

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export default function SalesDashboard() {
  const user = useSelector((s) => s.auth.user);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(SALES_ENDPOINTS.stats, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statCards = stats ? [
    { label: 'Total Leads',    value: stats.total_leads,     icon: <IconPhone />,    color: '#daeaf9', textColor: '#182350', href: '/sales/leads' },
    { label: 'New Today',      value: stats.leads_today,     icon: <IconTrend />,    color: '#daeaf9', textColor: '#182350', href: '/sales/leads?date_from=today' },
    { label: 'Unassigned',     value: stats.new_leads,       icon: <IconActivity />, color: '#fdf3e6', textColor: '#B9915E', href: '/sales/leads?status=new' },
    { label: 'Site Visits',    value: stats.sv_done,         icon: <IconPin />,      color: '#fdf3e6', textColor: '#B9915E', href: '/sales/leads?status=sv_done' },
    { label: 'Closures',       value: stats.closures,        icon: <IconTrend />,    color: '#daeaf9', textColor: '#182350', href: '/sales/leads?status=closed' },
    { label: 'Active Projects', value: stats.active_projects, icon: <IconBuilding />, color: '#fdf3e6', textColor: '#B9915E', href: '/sales/projects' },
  ] : [];

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Sales Dashboard</h1>
        <p style={{ fontSize: 13, color: '#8492A6' }}>Overview of all CRM activity</p>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 90, borderRadius: 14, backgroundColor: '#E8ECF4', animation: 'pulse 1.4s ease infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
          {statCards.map((c) => (
            <Link key={c.label} href={c.href} style={{ ...card, textDecoration: 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textColor, marginBottom: 12 }}>
                {c.icon}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1A1A2E', lineHeight: 1 }}>{(c.value ?? 0).toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#8492A6', marginTop: 4 }}>{c.label}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Recent leads */}
      <div style={cardWrap}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Recent Leads</h2>
          <Link href="/sales/leads" style={{ fontSize: 13, color: '#B9915E', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#8492A6', padding: '24px 0' }}>Loading…</p>
        ) : !stats?.recent_leads?.length ? (
          <p style={{ textAlign: 'center', color: '#8492A6', padding: '40px 0' }}>No leads yet. Add your first lead.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>
                  {['Name', 'Phone', 'Project', 'Source', 'Status', 'Received'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recent_leads.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={td}><span style={{ fontWeight: 600, color: '#1A1A2E' }}>{l.name}</span></td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#8492A6' }}>{l.phone}</td>
                    <td style={{ ...td, color: '#8492A6' }}>{l.project_name || '—'}</td>
                    <td style={{ ...td, color: '#8492A6', textTransform: 'capitalize' }}>{l.source_name || '—'}</td>
                    <td style={td}><StatusBadge status={l.status} /></td>
                    <td style={{ ...td, color: '#8492A6', fontSize: 12 }}>
                      {new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

const card = {
  backgroundColor: '#fff', borderRadius: 14, padding: '18px 20px',
  boxShadow: '0 2px 8px rgba(184,196,214,0.18)', display: 'block',
  transition: 'transform 0.15s, box-shadow 0.15s',
};
const cardWrap = {
  backgroundColor: '#fff', borderRadius: 14, padding: '20px 24px',
  boxShadow: '0 2px 8px rgba(184,196,214,0.18)',
};
const tbl = { width: '100%', borderCollapse: 'collapse' };
const th  = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '0 12px 10px', textTransform: 'uppercase', letterSpacing: 0.6 };
const td  = { padding: '10px 12px', fontSize: 13 };
