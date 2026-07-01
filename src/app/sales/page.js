'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { SALES_ENDPOINTS, authHeaders } from '../../constants/api';
import { getCache, getCacheWithStatus, setCache } from './_cache';

const TrendCharts = dynamic(() => import('./_TrendCharts').then(m => m.TrendCharts), { ssr: false });


// ─────────────────────────────────────────────
// AVAILABILITY TOGGLE (Telecaller / STM self sign-in)
// Marking available auto-resets after the server's TTL (12h).
// Reflected in the admin Lead Distribution module.
// ─────────────────────────────────────────────
function AvailabilityToggle() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(SALES_ENDPOINTS.availabilityMe, { headers: authHeaders() })
      .then((r) => r.json()).then(setState).catch(() => {});
  }, []);

  async function toggle(makeAvailable) {
    setBusy(true);
    try {
      const res = await fetch(SALES_ENDPOINTS.availabilityMe, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ is_available: makeAvailable }),
      });
      if (res.ok) setState(await res.json());
    } finally { setBusy(false); }
  }

  const resetsLabel = () => {
    if (!state?.expires_at) return '';
    const ms = new Date(state.expires_at) - new Date();
    if (ms <= 0) return '';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `resets in ${h}h ${m}m` : `resets in ${m}m`;
  };

  if (state?.is_available) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#15803D', background: '#DCFCE7', padding: '7px 12px', borderRadius: 20 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
          Available today{resetsLabel() ? ` · ${resetsLabel()}` : ''}
        </span>
        <button onClick={() => toggle(false)} disabled={busy}
          style={{ padding: '7px 14px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
          {busy ? '…' : 'Mark Unavailable'}
        </button>
      </div>
    );
  }
  return (
    <button onClick={() => toggle(true)} disabled={busy}
      style={{ marginLeft: 'auto', padding: '9px 18px', background: 'linear-gradient(135deg,#16A34A,#22C55E)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
      {busy ? 'Saving…' : '✓ Mark Available Today'}
    </button>
  );
}

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
function IconFire()     { return <SvgIcon><path d="M12 2c0 0-3 4-3 7a3 3 0 006 0c0-3-3-7-3-7z"/><path d="M12 12c0 0-5 3-5 7a5 5 0 0010 0c0-4-5-7-5-7z"/></SvgIcon>; }
function IconCheck()    { return <SvgIcon><polyline points="20 6 9 17 4 12"/></SvgIcon>; }
function IconClock()    { return <SvgIcon><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></SvgIcon>; }
function IconEye()        { return <SvgIcon><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></SvgIcon>; }
function IconSalesPerson(){ return <SvgIcon><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></SvgIcon>; }

const STATUS_COLOR = {
  new: '#3D5AFE', assigned: '#7B1FA2', contacted: '#0097A7',
  not_reachable: '#9E9E9E', warm_transferred: '#FF6B2B',
  sv_scheduled: '#F9A825', sv_done: '#2E7D32',
  closed: '#1B5E20', lost: '#B71C1C',
  hot: '#EF4444', warm: '#F97316', cold: '#3B82F6',
  not_interested: '#9E9E9E', callback: '#8B5CF6',
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

function StatCard({ label, value, icon, color, textColor, href, loading }) {
  const inner = (
    <div style={{ ...card, textDecoration: 'none', display: 'block' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor, marginBottom: 12 }}>
        {icon}
      </div>
      {loading
        ? <div style={{ height: 28, width: 48, borderRadius: 6, background: '#E8ECF4', animation: 'pulse 1.4s ease infinite' }} />
        : <div style={{ fontSize: 26, fontWeight: 800, color: '#1A1A2E', lineHeight: 1 }}>{(value ?? 0).toLocaleString()}</div>
      }
      <div style={{ fontSize: 12, color: '#8492A6', marginTop: 4 }}>{label}</div>
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

function SkeletonGrid({ count = 6 }) {
  return (
    <div style={statsGrid}>
      {[...Array(count)].map((_, i) => (
        <div key={i} style={{ ...card, height: 90, background: '#E8ECF4', animation: 'pulse 1.4s ease infinite' }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────
function AdminDashboard({ user }) {
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  // CP portal (e.g. CP Cluster Head): CP leads are always self-assigned, so
  // "Unassigned" isn't meaningful.
  const _des = (user?.designation || '').toLowerCase();
  const isCp = _des.includes('cp executive') || _des.includes('channel partner') || _des.includes('cp cluster head');

  useEffect(() => {
    const cacheKey = `stats_${companyId || 'all'}`;
    const { data: cached, fresh } = getCacheWithStatus(cacheKey);
    if (cached) { setStats(cached); setLoading(false); if (fresh) return; }
    const url = companyId ? `${SALES_ENDPOINTS.stats}?company_id=${companyId}` : SALES_ENDPOINTS.stats;
    fetch(url, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setCache(cacheKey, d); setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [companyId]);

  const cards = stats ? [
    { label: 'Total Leads',     value: stats.total_leads,     icon: <IconPhone />,    color: '#daeaf9', textColor: '#182350', href: '/sales/leads' },
    { label: 'New Today',       value: stats.leads_today,     icon: <IconTrend />,    color: '#daeaf9', textColor: '#182350', href: '/sales/leads?date_from=today' },
    ...(isCp ? [] : [{ label: 'Unassigned', value: stats.new_leads, icon: <IconActivity />, color: '#fdf3e6', textColor: '#B9915E', href: '/sales/leads?status=new' }]),
    { label: 'Site Visits',     value: stats.sv_done,         icon: <IconPin />,      color: '#fdf3e6', textColor: '#B9915E', href: '/sales/my-conversions?tab=sv' },
    { label: 'Closures',        value: stats.closures,        icon: <IconTrend />,    color: '#daeaf9', textColor: '#182350', href: '/sales/my-conversions?tab=closures' },
    { label: 'Active Projects', value: stats.active_projects, icon: <IconBuilding />, color: '#fdf3e6', textColor: '#B9915E', href: '/sales/closure' },
  ] : [];

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Sales Dashboard</h1>
        <p style={{ fontSize: 13, color: '#8492A6' }}>Overview of all CRM activity</p>
      </div>

      {loading ? <SkeletonGrid count={6} /> : (
        <div style={statsGrid}>
          {cards.map((c) => <StatCard key={c.label} {...c} loading={loading} />)}
        </div>
      )}

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
                <tr>{['Name','Phone','Project','Source','Status','Received'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
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
    </div>
  );
}

// ─────────────────────────────────────────────
// TELECALLER DASHBOARD
// ─────────────────────────────────────────────
function TelecallerDashboard({ user }) {
  // Always compute dates in IST (matches backend TIME_ZONE = 'Asia/Kolkata')
  const toIST = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // → 'YYYY-MM-DD'
  const today = toIST(new Date());
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toIST(d); };

  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [trend,        setTrend]        = useState(null);
  const [trendLoading, setTrendLoading] = useState(true);

  const fSel = { height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E8ECF4', fontSize: 12, background: '#F8FAFD', cursor: 'pointer', outline: 'none', color: '#1A1A2E', fontWeight: 500 };
  const qBtn = (active) => ({ height: 36, padding: '0 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: active ? '#182350' : '#F0F2F8', color: active ? '#fff' : '#8492A6' });
  const divider = { width: 1, height: 24, background: '#E8ECF4', flexShrink: 0 };

  // Stats re-fetch whenever date filter changes
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setStats(null);
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo)   params.set('date_to',   dateTo);
        const qs = params.toString() ? `?${params}` : '';
        console.log('[TelecallerDashboard] fetching stats:', SALES_ENDPOINTS.stats + qs);
        const res = await fetch(`${SALES_ENDPOINTS.stats}${qs}`, { headers: authHeaders(), cache: 'no-store' });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setStats(data);
        }
      } catch (_) {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, dateFrom, dateTo]);

  // Trend charts — re-fetch with same date range
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setTrendLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams();
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo)   params.set('date_to',   dateTo);
        const qs  = params.toString() ? `?${params}` : '';
        const res = await fetch(`${SALES_ENDPOINTS.statsTrend}${qs}`, { headers: authHeaders(), cache: 'no-store' });
        if (cancelled) return;
        if (res.ok) { const data = await res.json(); if (!cancelled) setTrend(data); }
      } catch (_) {}
      if (!cancelled) setTrendLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, dateFrom, dateTo]);

  const total    = stats?.total_leads    ?? 0;
  const newToday = stats?.leads_today    ?? 0;
  const called   = stats?.called_count   ?? 0;
  const warm     = stats?.warm_count     ?? 0;
  const callback = stats?.callback_count ?? 0;
  const svDone   = stats?.sv_done        ?? 0;
  const closed   = stats?.closures       ?? 0;
  const mqlToSv  = called > 0 ? (svDone / called * 100).toFixed(1) + '%' : '—';

  const cards = [
    { label: 'My Leads',       value: total,    icon: <IconPhone />,    color: '#daeaf9', textColor: '#182350', href: '/sales/leads' },
    { label: 'New Today',      value: newToday, icon: <IconTrend />,    color: '#DCFCE7', textColor: '#15803D', href: '/sales/leads' },
    { label: 'Called/MQL',     value: called,   icon: <IconCheck />,    color: '#E0F2F1', textColor: '#0F766E', href: '/sales/leads?tab=called' },
    { label: 'Warm/SQL',       value: warm,     icon: <IconTrend />,    color: '#FFF7ED', textColor: '#EA580C', href: '/sales/leads?tab=called&telecaller_status=warm' },
    { label: 'SV Done',        value: svDone,   icon: <IconEye />,      color: '#DCFCE7', textColor: '#15803D', href: '/sales/my-conversions' },
    { label: 'MQL→SV Ratio',   value: mqlToSv,  icon: <IconTrend />,   color: '#EFF6FF', textColor: '#1D4ED8', href: '/sales/my-conversions' },
    { label: 'Callback Due',   value: callback, icon: <IconClock />,    color: '#F5F3FF', textColor: '#7C3AED', href: '/sales/leads?tab=called&telecaller_status=callback' },
    { label: 'Closures',       value: closed,   icon: <IconCheck />,    color: '#E0F2F1', textColor: '#0F766E', href: '/sales/my-conversions?tab=closures' },
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#3D5AFE,#7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <IconPhone />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 2 }}>
            Welcome, {user?.name?.split(' ')[0] || 'Telecaller'}
          </h1>
          <p style={{ fontSize: 13, color: '#8492A6' }}>Telecaller · Your call queue & lead pipeline</p>
        </div>
        <AvailabilityToggle />
      </div>

      {/* Date Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 20, padding: '10px 16px', background: '#fff', borderRadius: 12, border: '1px solid #F0F3FA' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#B0BAD0', letterSpacing: 0.5, textTransform: 'uppercase', marginRight: 2 }}>Date</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...fSel, width: 136 }} />
        <span style={{ fontSize: 12, color: '#C0C8D8' }}>→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...fSel, width: 136 }} />
        <div style={divider} />
        <button onClick={() => { setDateFrom(today); setDateTo(today); }} style={qBtn(dateFrom === today && dateTo === today)}>Today</button>
        <button onClick={() => { setDateFrom(daysAgo(6)); setDateTo(today); }} style={qBtn(dateFrom === daysAgo(6) && dateTo === today)}>Week</button>
        <button onClick={() => { setDateFrom(daysAgo(29)); setDateTo(today); }} style={qBtn(dateFrom === daysAgo(29) && dateTo === today)}>Month</button>
        <div style={divider} />
        <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={qBtn(!dateFrom && !dateTo)}>All</button>
      </div>

      {/* Stats */}
      {loading ? <SkeletonGrid count={8} /> : (
        <div style={statsGrid}>
          {cards.map((c) => <StatCard key={c.label} {...c} />)}
        </div>
      )}

      {/* Trend Charts */}
      <TrendCharts trend={trend} dateFrom={dateFrom} dateTo={dateTo} loading={trendLoading} />

    </div>
  );
}

// ─────────────────────────────────────────────
// STM DASHBOARD
// ─────────────────────────────────────────────
function STMDashboard({ user }) {
  const [stats,   setStats]   = useState(null);
  const [leads,   setLeads]   = useState([]);
  const [loading, setLoading] = useState(true);
  // CP Executives reuse this dashboard but aren't in the availability/distribution
  // pool, so the "Mark Available" toggle doesn't apply to them.
  const _des = (user?.designation || '').toLowerCase();
  const isCp = _des.includes('cp executive') || _des.includes('channel partner');

  useEffect(() => {
    if (!user?.id) return;
    const cacheKey = `stm_dash_${user.id}`;
    const cached = getCache(cacheKey);
    if (cached) { setStats(cached.stats); setLeads(cached.leads); setLoading(false); return; }
    Promise.all([
      fetch(SALES_ENDPOINTS.stats, { headers: authHeaders() }).then(r => r.json()).catch(() => null),
      fetch(`${SALES_ENDPOINTS.leads}?stm=${user.id}&page_size=100`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({ results: [] })),
    ]).then(([s, d]) => {
      s && setStats(s);
      const list = Array.isArray(d) ? d : (d.results ?? []);
      setLeads(list);
      setCache(cacheKey, { stats: s, leads: list });
      setLoading(false);
    });
  }, [user?.id]);

  const count = (key, val) => leads.filter((l) => l[key] === val).length;
  // Backend's true count (scoped to this STM's leads) — the leads endpoint
  // caps results at PAGE_SIZE (25), so leads.length under-counts past 25.
  const total      = stats?.total_leads ?? leads.length;
  const hot        = count('stm_status', 'hot');
  const warm       = count('stm_status', 'warm');
  const svSched    = count('stm_status', 'sv_scheduled');
  const svDone     = stats?.sv_done ?? count('stm_status', 'sv_done');
  const closed     = stats?.closures ?? count('stm_status', 'closed');

  const svUpcoming = leads.filter(l => l.stm_status === 'sv_scheduled');
  const recent     = [...leads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#2E7D32,#0097A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <IconSalesPerson />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 2 }}>
            Welcome, {user?.name?.split(' ')[0] || 'STM'}
          </h1>
          <p style={{ fontSize: 13, color: '#8492A6' }}>{isCp ? 'Channel Partner' : 'Sales Executive'} · Your pipeline & site visits</p>
        </div>
        {!isCp && <AvailabilityToggle />}
      </div>

      {loading ? <SkeletonGrid count={6} /> : (
        <div style={statsGrid}>
          {[
            { label: 'My Pipeline',    value: total,   icon: <IconActivity />, color: '#daeaf9', textColor: '#182350', href: '/sales/leads' },
            { label: 'Hot Leads',      value: hot,     icon: <IconFire />,     color: '#FEE2E2', textColor: '#DC2626', href: '/sales/leads?stm_status=hot' },
            { label: 'Warm Leads',     value: warm,    icon: <IconTrend />,    color: '#FFF7ED', textColor: '#EA580C', href: '/sales/leads?stm_status=warm' },
            { label: 'SV Scheduled',   value: svSched, icon: <IconClock />,    color: '#FEF9C3', textColor: '#B45309', href: '/sales/leads?stm_status=sv_scheduled' },
            { label: 'SV Done',        value: svDone,  icon: <IconEye />,      color: '#DCFCE7', textColor: '#15803D', href: '/sales/my-conversions?tab=sv' },
            { label: 'Closures',       value: closed,  icon: <IconCheck />,    color: '#E0F2F1', textColor: '#0F766E', href: '/sales/my-conversions?tab=closures' },
          ].map((c) => <StatCard key={c.label} {...c} />)}
        </div>
      )}

      {!loading && svUpcoming.length > 0 && (
        <div style={{ ...cardWrap, marginBottom: 20, borderLeft: '4px solid #F9A825' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>Site Visits Scheduled</h2>
              <span style={{ fontSize: 11, fontWeight: 700, backgroundColor: '#FEF9C3', color: '#B45309', padding: '2px 8px', borderRadius: 20 }}>
                {svUpcoming.length} pending
              </span>
            </div>
            <Link href="/sales/leads" style={{ fontSize: 13, color: '#3D5AFE', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>{['Name','Phone','Project','STM Status','Remarks'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {svUpcoming.slice(0, 8).map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={td}><span style={{ fontWeight: 600, color: '#1A1A2E' }}>{l.name}</span></td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#8492A6' }}>{l.phone}</td>
                    <td style={{ ...td, color: '#8492A6' }}>{l.project_name || '—'}</td>
                    <td style={td}><StatusBadge status={l.stm_status} /></td>
                    <td style={{ ...td, color: '#8492A6', fontSize: 12 }}>{l.stm_remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={cardWrap}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>My Pipeline</h2>
          <Link href="/sales/leads" style={{ fontSize: 13, color: '#B9915E', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
        </div>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#8492A6', padding: '24px 0' }}>Loading…</p>
        ) : !recent.length ? (
          <p style={{ textAlign: 'center', color: '#8492A6', padding: '40px 0' }}>No leads assigned to you yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr>{['Name','Phone','Project','STM Status','Remarks','Received'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={td}><span style={{ fontWeight: 600, color: '#1A1A2E' }}>{l.name}</span></td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#8492A6' }}>{l.phone}</td>
                    <td style={{ ...td, color: '#8492A6' }}>{l.project_name || '—'}</td>
                    <td style={td}>
                      {l.stm_status ? <StatusBadge status={l.stm_status} /> : <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ ...td, color: '#8492A6', fontSize: 12, maxWidth: 180 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.stm_remarks || '—'}
                      </span>
                    </td>
                    <td style={{ ...td, color: '#8492A6', fontSize: 12 }}>
                      {new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ROUTER — picks dashboard by designation
// ─────────────────────────────────────────────
export default function SalesDashboard() {
  const user = useSelector((s) => s.auth.user);
  const des  = (user?.designation || '').toLowerCase();

  if (des.includes('telecaller') || des.includes('tele caller')) {
    return <TelecallerDashboard user={user} />;
  }
  // CP Executive works like an STM (own pipeline). CP Cluster Heads are Managers
  // and fall through to the admin/overview dashboard (all CP data).
  if (des.includes('stm') || des.includes('sales team') || des.includes('sales executive')
      || des.includes('cp executive') || des.includes('channel partner')) {
    return <STMDashboard user={user} />;
  }
  return <AdminDashboard user={user} />;
}

// ─────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 10, marginBottom: 28 };
const card      = { backgroundColor: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)', display: 'block', transition: 'transform 0.15s, box-shadow 0.15s' };
const cardWrap  = { backgroundColor: '#fff', borderRadius: 14, padding: '20px 24px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)', marginBottom: 20 };
const tbl       = { width: '100%', borderCollapse: 'collapse' };
const th        = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '0 12px 10px', textTransform: 'uppercase', letterSpacing: 0.6 };
const td        = { padding: '10px 12px', fontSize: 13 };
