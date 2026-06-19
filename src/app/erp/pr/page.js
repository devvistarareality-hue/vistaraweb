'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ERP_EXECUTION } from '../../../constants/api';

const STATUS_COLORS = {
  'Raised':         { bg: '#EEF0FF', text: '#3D5AFE' },
  'Approved':       { bg: '#E8F5E9', text: '#2E7D32' },
  'PO Created':     { bg: '#FFF3E0', text: '#E65100' },
  'In Transit':     { bg: '#E0F7FA', text: '#0097A7' },
  'Received':       { bg: '#E8F5E9', text: '#2E7D32' },
  'Issued to Site': { bg: '#F3E5F5', text: '#6A1B9A' },
  'Closed':         { bg: '#F5F6FA', text: '#8492A6' },
};

function Badge({ label, colors }) {
  const c = colors || { bg: '#F5F6FA', text: '#8492A6' };
  return (
    <span style={{ ...s.badge, backgroundColor: c.bg, color: c.text }}>{label}</span>
  );
}

export default function PRListPage() {
  const router = useRouter();
  const [prs,     setPRs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('All');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res   = await fetch(ERP_EXECUTION.prs, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPRs(Array.isArray(data) ? data : (data.results || []));
      }
    } catch {}
    setLoading(false);
  }

  const statuses = ['All', 'Raised', 'Approved', 'PO Created', 'In Transit', 'Received', 'Issued to Site', 'Closed'];
  const filtered = prs.filter((p) =>
    (filter === 'All' || p.status === filter) &&
    (p.pr_no?.toLowerCase().includes(search.toLowerCase()) ||
     p.project_name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.breadcrumb}>ERP › Purchase Requisitions</div>
          <h1 style={s.pageTitle}>Purchase Requisitions</h1>
        </div>
        <div style={s.headerRight}>
          <span style={s.countChip}>{filtered.length} records</span>
          <button onClick={load} style={s.refreshBtn}>↻ Refresh</button>
          <button onClick={() => router.push('/erp/pr/create')} style={s.newBtn}>+ New PR</button>
        </div>
      </div>

      {/* Filters */}
      <div style={s.toolbar}>
        <input
          style={s.search}
          placeholder="Search PR no. or project..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={s.statusTabs}>
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              style={{ ...s.tab, ...(filter === st ? s.tabActive : {}) }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.center}>
            <div style={s.spinner} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>No purchase requisitions found.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['PR No.', 'Project', 'Raised By', 'Date', 'Lines', 'Status'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((pr) => (
                <tr key={pr.id} style={s.tr}>
                  <td style={{ ...s.td, fontWeight: 700, color: '#1A1A2E' }}>{pr.pr_no}</td>
                  <td style={s.td}>{pr.project_name}</td>
                  <td style={s.td}>{pr.raised_by_name}</td>
                  <td style={s.td}>{pr.raised_date}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>{pr.line_count}</td>
                  <td style={s.td}>
                    <Badge label={pr.status} colors={STATUS_COLORS[pr.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const s = {
  page:       { padding: '24px', minHeight: '100vh', backgroundColor: '#DFE4EE' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  breadcrumb: { fontSize: 11, color: '#8492A6', fontWeight: 500, marginBottom: 6 },
  pageTitle:  { fontSize: 26, fontWeight: 800, color: '#1A1A2E' },
  headerRight:{ display: 'flex', gap: 10, alignItems: 'center' },
  countChip:  { fontSize: 12, color: '#8492A6', backgroundColor: '#fff', borderRadius: 20, padding: '4px 12px', border: '1px solid #E0E6F0' },
  refreshBtn: { padding: '8px 16px', borderRadius: 10, border: '1px solid #E0E6F0', backgroundColor: '#fff', fontSize: 13, fontWeight: 600, color: '#0C1E3C', cursor: 'pointer' },
  newBtn:     { padding: '8px 18px', borderRadius: 10, border: 'none', backgroundColor: '#2E7D32', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  toolbar:    { backgroundColor: '#fff', borderRadius: 14, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 12 },
  search:     { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E0E6F0', fontSize: 13, color: '#1A1A2E', outline: 'none', boxSizing: 'border-box' },
  statusTabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tab:        { padding: '5px 12px', borderRadius: 20, border: '1px solid #E0E6F0', fontSize: 11, fontWeight: 600, backgroundColor: '#F5F6FA', color: '#8492A6', cursor: 'pointer' },
  tabActive:  { backgroundColor: '#0C1E3C', color: '#fff', borderColor: '#0C1E3C' },
  tableWrap:  { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th:         { padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textAlign: 'left', borderBottom: '1px solid #F0F4FA', letterSpacing: 0.4, backgroundColor: '#FAFBFD' },
  tr:         { borderBottom: '1px solid #F0F4FA', transition: 'background 0.12s' },
  td:         { padding: '14px 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' },
  badge:      { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  center:     { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 },
  spinner:    { width: 32, height: 32, borderRadius: '50%', border: '3px solid #E0E6F0', borderTopColor: '#0C1E3C', animation: 'spin 0.8s linear infinite' },
  empty:      { padding: 48, textAlign: 'center', color: '#8492A6', fontSize: 14 },
};
