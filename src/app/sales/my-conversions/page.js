'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS } from '../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SV_COLOR = {
  scheduled: { bg: '#FFF3E0', text: '#E65100' },
  completed: { bg: '#E8F5E9', text: '#2E7D32' },
  no_show: { bg: '#FFEBEE', text: '#C62828' },
  cancelled: { bg: '#F5F5F5', text: '#757575' },
};

const CLOSURE_STATUS_COLOR = {
  booked: { bg: '#E8F5E9', text: '#2E7D32' },
  cancelled: { bg: '#FFEBEE', text: '#C62828' },
  refunded: { bg: '#FFF3E0', text: '#E65100' },
};

function StatusBadge({ status, colors }) {
  const c = colors[status] || { bg: '#F5F5F5', text: '#757575' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.text }}>
      {(status || '').replace(/_/g, ' ').toUpperCase()}
    </span>
  );
}

export default function MyConversionsPage() {
  const user = useSelector((s) => s.auth.user);
  const [tab, setTab] = useState('sv');
  const [visits, setVisits] = useState([]);
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [svRes, clRes] = await Promise.all([
        fetch(SALES_ENDPOINTS.siteVisits, { headers: authHeaders() }),
        fetch(SALES_ENDPOINTS.closures, { headers: authHeaders() }),
      ]);
      if (svRes.ok) setVisits(await svRes.json());
      if (clRes.ok) setClosures(await clRes.json());
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const svCompleted = visits.filter(v => v.status === 'completed');
  const allClosures = closures;

  const card = { backgroundColor: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden' };
  const th = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'left', borderBottom: '1px solid #F3F4F6', whiteSpace: 'nowrap' };
  const td = { padding: '10px 14px', fontSize: 13, color: '#1F2937', borderBottom: '1px solid #F9FAFB' };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0C1E3C', margin: 0 }}>My Conversions</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
          Track site visits and closures from leads you referred to the sales team
        </p>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, backgroundColor: '#E8F5E9', borderRadius: 14, padding: '18px 20px', border: '1px solid #C8E6C9' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#2E7D32' }}>{svCompleted.length}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1B5E20', marginTop: 4 }}>Site Visits Done</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#E8EAF6', borderRadius: 14, padding: '18px 20px', border: '1px solid #C5CAE9' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#283593' }}>{allClosures.length}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1A237E', marginTop: 4 }}>Total Closures</div>
        </div>
        <div style={{ flex: 1, backgroundColor: '#FFF3E0', borderRadius: 14, padding: '18px 20px', border: '1px solid #FFE0B2' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#E65100' }}>{visits.filter(v => v.status === 'scheduled').length}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BF360C', marginTop: 4 }}>Upcoming Visits</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #F3F4F6' }}>
        {[
          { key: 'sv', label: 'Site Visits' },
          { key: 'closures', label: 'Closures' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: 'none', background: 'none', color: tab === t.key ? '#FF6B2B' : '#9CA3AF',
              borderBottom: tab === t.key ? '2px solid #FF6B2B' : '2px solid transparent',
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>Loading...</div>
      ) : tab === 'sv' ? (
        <div style={card}>
          {svCompleted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>
              No site visits completed for your referred leads yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Lead Name</th>
                  <th style={th}>Phone</th>
                  <th style={th}>Project</th>
                  <th style={th}>Visit Date</th>
                  <th style={th}>Status</th>
                  <th style={th}>STM</th>
                </tr>
              </thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id} style={{ transition: 'background 0.1s' }} onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.background = ''}>
                    <td style={td}><span style={{ fontWeight: 600 }}>{v.lead_name || '—'}</span></td>
                    <td style={{ ...td, color: '#6B7280' }}>{v.lead_phone || '—'}</td>
                    <td style={td}>{v.project_name || '—'}</td>
                    <td style={td}>{v.visited_at ? fmtDate(v.visited_at) : (v.scheduled_at ? fmtDate(v.scheduled_at) : '—')}</td>
                    <td style={td}><StatusBadge status={v.status} colors={SV_COLOR} /></td>
                    <td style={{ ...td, color: '#6B7280' }}>{v.stm_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div style={card}>
          {allClosures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>
              No closures from your referred leads yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Lead Name</th>
                  <th style={th}>Phone</th>
                  <th style={th}>Project</th>
                  <th style={th}>Unit</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Closure Date</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {allClosures.map(c => (
                  <tr key={c.id} style={{ transition: 'background 0.1s' }} onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.background = ''}>
                    <td style={td}><span style={{ fontWeight: 600 }}>{c.lead_name || '—'}</span></td>
                    <td style={{ ...td, color: '#6B7280' }}>{c.lead_phone || '—'}</td>
                    <td style={td}>{c.project_name || '—'}</td>
                    <td style={td}>{(c.unit_type || '') + ' ' + (c.unit_no || '')}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{c.total_amount ? '₹' + new Intl.NumberFormat('en-IN').format(c.total_amount) : '—'}</td>
                    <td style={td}>{c.closure_date ? fmtDate(c.closure_date) : '—'}</td>
                    <td style={td}><StatusBadge status={c.status} colors={CLOSURE_STATUS_COLOR} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
