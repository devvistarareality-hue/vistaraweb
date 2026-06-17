'use client';
import { useState, useEffect } from 'react';
import { SALES_ENDPOINTS } from '../../../constants/api';
import { getCache, setCache } from '../../sales/_cache';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function fmt(n) {
  if (!n) return '₹0';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function pct(num, denom) {
  if (!denom) return '0%';
  return `${(num / denom * 100).toFixed(1)}%`;
}

export default function ReportsPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getCache('reports');
    if (cached) { setData(cached); setLoading(false); return; }
    fetch(SALES_ENDPOINTS.reports, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => { setCache('reports', d); setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="s-skel" style={{ height: 28, width: 200 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[...Array(4)].map((_, i) => <div key={i} className="s-skel" style={{ height: 88 }} />)}
      </div>
      {[...Array(3)].map((_, i) => <div key={i} className="s-skel" style={{ height: 180 }} />)}
    </div>
  );
  if (!data) return <div style={{ padding: 40, color: '#EF4444', textAlign: 'center' }}>Failed to load reports.</div>;

  const { summary, campaigns, telecallers, stms, closures } = data;

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Reports & Analytics</h1>
        <p style={{ fontSize: 13, color: '#8492A6' }}>Lead funnel, campaign performance, team metrics</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 14 }}>
        {[
          { label: 'Total Site Visits',    value: summary.total_sv,       sub: `${summary.completed_sv} completed` },
          { label: 'Closures',             value: summary.total_closures,  sub: 'all time' },
          { label: 'Revenue (Bookings)',   value: fmt(summary.total_revenue), sub: 'booking amounts' },
          { label: 'Meta / Campaign Leads', value: summary.meta_leads,    sub: 'from ads' },
        ].map((s) => (
          <div key={s.label} style={card}>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1A2E' }}>{s.value}</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginTop: 2 }}>{s.label}</p>
            <p style={{ fontSize: 11, color: '#8492A6', marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Campaign Performance */}
      <div style={card}>
        <h2 style={sectionTitle}>Meta / Campaign Performance</h2>
        {campaigns.length === 0 ? (
          <p style={empty}>No campaign data yet. Import Meta leads with campaign names.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead style={{ backgroundColor: '#F8FAFD' }}>
                <tr>{['Campaign', 'Total Leads', 'Warm/Hot', 'Site Visits', 'Closed', 'Conversion %'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.meta_campaign_name} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{c.meta_campaign_name}</td>
                    <td style={td}>{c.total}</td>
                    <td style={td}>{c.warm} <span style={{ fontSize: 11, color: '#8492A6' }}>({pct(c.warm, c.total)})</span></td>
                    <td style={td}>{c.sv}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#2E7D32' }}>{c.closed}</td>
                    <td style={{ ...td, fontWeight: 600, color: c.closed / c.total > 0.05 ? '#2E7D32' : '#8492A6' }}>
                      {pct(c.closed, c.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Telecaller Performance */}
      <div style={card}>
        <h2 style={sectionTitle}>Telecaller Performance <span style={{ fontSize: 12, fontWeight: 400, color: '#8492A6' }}>incentive tracking</span></h2>
        {telecallers.length === 0 ? (
          <p style={empty}>No telecaller data yet. Assign leads to telecallers.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead style={{ backgroundColor: '#F8FAFD' }}>
                <tr>{['Telecaller', 'Total Leads', 'Warm Leads', 'Transferred to STM', 'SV Done', 'Conversion %'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {telecallers.map((tc) => (
                  <tr key={tc.telecaller__id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{tc.telecaller__name || '—'}</td>
                    <td style={td}>{tc.total}</td>
                    <td style={td}>{tc.warm}</td>
                    <td style={td}>{tc.transferred}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#7B1FA2' }}>{tc.sv}</td>
                    <td style={td}>{pct(tc.sv, tc.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* STM Performance */}
      <div style={card}>
        <h2 style={sectionTitle}>STM Performance <span style={{ fontSize: 12, fontWeight: 400, color: '#8492A6' }}>site visit & closure tracking</span></h2>
        {stms.length === 0 ? (
          <p style={empty}>No STM data yet. Assign warm leads to STMs.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead style={{ backgroundColor: '#F8FAFD' }}>
                <tr>{['STM', 'Total Leads', 'Hot Leads', 'SV Scheduled', 'SV Done', 'Closed', 'Conversion %'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {stms.map((s) => (
                  <tr key={s.stm__id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{s.stm__name || '—'}</td>
                    <td style={td}>{s.total}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#EF4444' }}>{s.hot}</td>
                    <td style={td}>{s.sv_scheduled}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#7B1FA2' }}>{s.sv_done}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#2E7D32' }}>{s.closed}</td>
                    <td style={td}>{pct(s.closed, s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Closures */}
      <div style={card}>
        <h2 style={sectionTitle}>Recent Closures</h2>
        {closures.length === 0 ? (
          <p style={empty}>No closures recorded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead style={{ backgroundColor: '#F8FAFD' }}>
                <tr>{['Date', 'Lead', 'Project', 'STM', 'Telecaller', 'Booking Amt', 'Total Amt'].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {closures.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={td}>{c.closure_date ? new Date(c.closure_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{c.lead_name || '—'}</td>
                    <td style={td}>{c.project_name || '—'}</td>
                    <td style={td}>{c.stm_name || '—'}</td>
                    <td style={td}>{c.referred_by_telecaller || '—'}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{fmt(c.booking_amount)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{fmt(c.total_amount)}</td>
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

const card        = { backgroundColor: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' };
const sectionTitle = { fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 14 };
const tbl         = { width: '100%', borderCollapse: 'collapse' };
const th          = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '8px 14px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td          = { padding: '10px 14px', fontSize: 13, color: '#1A1A2E' };
const empty       = { color: '#8492A6', fontSize: 13, textAlign: 'center', padding: '28px 0' };
