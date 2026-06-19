'use client';
import { useState, useEffect } from 'react';
import { ERP_FINANCE } from '../../../constants/api';

const MATCH_COLORS = {
  'Pending':  { bg: '#FFF8E1', text: '#F9A825' },
  '2-Way':    { bg: '#E0F7FA', text: '#0097A7' },
  '3-Way':    { bg: '#E8F5E9', text: '#2E7D32' },
  'Approved': { bg: '#EEF0FF', text: '#3D5AFE' },
  'Disputed': { bg: '#FEE2E2', text: '#DC2626' },
};

const PAY_COLORS = {
  'Pending': { bg: '#FFF8E1', text: '#F9A825' },
  'Partial': { bg: '#E0F7FA', text: '#0097A7' },
  'Paid':    { bg: '#E8F5E9', text: '#2E7D32' },
};

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('All');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res   = await fetch(ERP_FINANCE.invoices, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : (data.results || []));
      }
    } catch {}
    setLoading(false);
  }

  const statuses = ['All', 'Pending', '2-Way', '3-Way', 'Approved', 'Disputed'];
  const filtered = invoices.filter((inv) =>
    (filter === 'All' || inv.match_status === filter) &&
    (inv.invoice_no?.toLowerCase().includes(search.toLowerCase()) ||
     inv.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
     inv.project_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const totalOutstanding = filtered
    .filter((inv) => inv.payment_status !== 'Paid')
    .reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.breadcrumb}>ERP › Vendor Invoices</div>
          <h1 style={s.pageTitle}>Vendor Invoices</h1>
        </div>
        <div style={s.headerRight}>
          <div style={s.outstandingChip}>
            <span style={s.outLabel}>Outstanding</span>
            <span style={s.outAmount}>₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <span style={s.countChip}>{filtered.length} records</span>
          <button onClick={load} style={s.refreshBtn}>↻ Refresh</button>
        </div>
      </div>

      <div style={s.toolbar}>
        <input style={s.search} placeholder="Search invoice, vendor or project..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div style={s.statusTabs}>
          <span style={s.filterLabel}>Match:</span>
          {statuses.map((st) => (
            <button key={st} onClick={() => setFilter(st)} style={{ ...s.tab, ...(filter === st ? s.tabActive : {}) }}>{st}</button>
          ))}
        </div>
      </div>

      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.center}><div style={s.spinner} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>No invoices found.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>{['Invoice No.', 'Vendor', 'Project', 'Date', 'Amount', 'Match', 'Payment'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const mc = MATCH_COLORS[inv.match_status] || { bg: '#F5F6FA', text: '#8492A6' };
                const pc = PAY_COLORS[inv.payment_status] || { bg: '#F5F6FA', text: '#8492A6' };
                return (
                  <tr key={inv.id} style={s.tr}>
                    <td style={{ ...s.td, fontWeight: 700, color: '#1A1A2E' }}>{inv.invoice_no}</td>
                    <td style={s.td}>{inv.vendor_name}</td>
                    <td style={s.td}>{inv.project_name}</td>
                    <td style={s.td}>{inv.invoice_date}</td>
                    <td style={{ ...s.td, fontWeight: 700 }}>₹{parseFloat(inv.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td style={s.td}><span style={{ ...s.badge, backgroundColor: mc.bg, color: mc.text }}>{inv.match_status}</span></td>
                    <td style={s.td}><span style={{ ...s.badge, backgroundColor: pc.bg, color: pc.text }}>{inv.payment_status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { padding: '24px', minHeight: '100vh', backgroundColor: '#DFE4EE' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  breadcrumb: { fontSize: 11, color: '#8492A6', fontWeight: 500, marginBottom: 6 },
  pageTitle:  { fontSize: 26, fontWeight: 800, color: '#1A1A2E' },
  headerRight:{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  outstandingChip: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: '8px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  outLabel:   { fontSize: 9, fontWeight: 700, color: '#DC2626', letterSpacing: 0.8 },
  outAmount:  { fontSize: 15, fontWeight: 800, color: '#DC2626' },
  countChip:  { fontSize: 12, color: '#8492A6', backgroundColor: '#fff', borderRadius: 20, padding: '4px 12px', border: '1px solid #E0E6F0' },
  refreshBtn: { padding: '8px 16px', borderRadius: 10, border: '1px solid #E0E6F0', backgroundColor: '#fff', fontSize: 13, fontWeight: 600, color: '#0C1E3C', cursor: 'pointer' },
  toolbar:    { backgroundColor: '#fff', borderRadius: 14, padding: '16px 20px', marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 12 },
  search:     { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E0E6F0', fontSize: 13, color: '#1A1A2E', outline: 'none', boxSizing: 'border-box' },
  statusTabs: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  filterLabel:{ fontSize: 11, fontWeight: 700, color: '#8492A6', marginRight: 4 },
  tab:        { padding: '5px 12px', borderRadius: 20, border: '1px solid #E0E6F0', fontSize: 11, fontWeight: 600, backgroundColor: '#F5F6FA', color: '#8492A6', cursor: 'pointer' },
  tabActive:  { backgroundColor: '#0C1E3C', color: '#fff', borderColor: '#0C1E3C' },
  tableWrap:  { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th:         { padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textAlign: 'left', borderBottom: '1px solid #F0F4FA', letterSpacing: 0.4, backgroundColor: '#FAFBFD' },
  tr:         { borderBottom: '1px solid #F0F4FA' },
  td:         { padding: '14px 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' },
  badge:      { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  center:     { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 },
  spinner:    { width: 32, height: 32, borderRadius: '50%', border: '3px solid #E0E6F0', borderTopColor: '#0C1E3C', animation: 'spin 0.8s linear infinite' },
  empty:      { padding: 48, textAlign: 'center', color: '#8492A6', fontSize: 14 },
};
