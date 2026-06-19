'use client';
import { useState, useEffect } from 'react';
import { ERP_MASTER, ERP_INVENTORY } from '../../../constants/api';

export default function StockBalancePage() {
  const [projects,  setProjects]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [stock,     setStock]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [search,    setSearch]    = useState('');

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res   = await fetch(ERP_MASTER.projects, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.results || []);
        setProjects(list);
        if (list.length > 0) loadStock(list[0]);
        else setLoading(false);
      } else { setLoading(false); }
    } catch { setLoading(false); }
  }

  async function loadStock(proj) {
    setSelected(proj);
    setLoadingStock(true);
    try {
      const token = localStorage.getItem('access_token');
      const res   = await fetch(ERP_INVENTORY.stockBalance(proj.id), { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setStock(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
    setLoadingStock(false);
  }

  const filtered = stock.filter((s) => s.item_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.breadcrumb}>ERP › Stock Balance</div>
          <h1 style={s.pageTitle}>Stock Balance{selected ? ` — ${selected.name}` : ''}</h1>
        </div>
        <div style={s.headerRight}>
          <span style={s.countChip}>{filtered.length} items</span>
          {selected && <button onClick={() => loadStock(selected)} style={s.refreshBtn}>↻ Refresh</button>}
        </div>
      </div>

      {/* Project tabs */}
      {!loading && projects.length > 0 && (
        <div style={s.projectTabs}>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => loadStock(p)}
              style={{ ...s.projTab, ...(selected?.id === p.id ? s.projTabActive : {}) }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div style={s.toolbar}>
        <input style={s.search} placeholder="Search material..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={s.tableWrap}>
        {(loading || loadingStock) ? (
          <div style={s.center}><div style={s.spinner} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>No stock data for this project.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>{['Material', 'UOM', 'Balance Qty', 'Status'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const qty    = parseFloat(item.balance_qty || 0);
                const isLow  = qty <= 0;
                return (
                  <tr key={i} style={s.tr}>
                    <td style={{ ...s.td, fontWeight: 600, color: '#1A1A2E' }}>{item.item_name}</td>
                    <td style={s.td}>{item.uom}</td>
                    <td style={{ ...s.td, fontWeight: 800, fontSize: 15, color: isLow ? '#DC2626' : '#2E7D32' }}>
                      {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(3)}
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, backgroundColor: isLow ? '#FEE2E2' : '#E8F5E9', color: isLow ? '#DC2626' : '#2E7D32' }}>
                        {isLow ? 'Out of Stock' : 'In Stock'}
                      </span>
                    </td>
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
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  breadcrumb: { fontSize: 11, color: '#8492A6', fontWeight: 500, marginBottom: 6 },
  pageTitle:  { fontSize: 26, fontWeight: 800, color: '#1A1A2E' },
  headerRight:{ display: 'flex', gap: 10, alignItems: 'center' },
  countChip:  { fontSize: 12, color: '#8492A6', backgroundColor: '#fff', borderRadius: 20, padding: '4px 12px', border: '1px solid #E0E6F0' },
  refreshBtn: { padding: '8px 16px', borderRadius: 10, border: '1px solid #E0E6F0', backgroundColor: '#fff', fontSize: 13, fontWeight: 600, color: '#0C1E3C', cursor: 'pointer' },
  projectTabs:{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  projTab:    { padding: '7px 16px', borderRadius: 20, border: '1px solid #E0E6F0', fontSize: 12, fontWeight: 600, backgroundColor: '#fff', color: '#8492A6', cursor: 'pointer' },
  projTabActive:{ backgroundColor: '#0C1E3C', color: '#fff', borderColor: '#0C1E3C' },
  toolbar:    { backgroundColor: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  search:     { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E0E6F0', fontSize: 13, color: '#1A1A2E', outline: 'none', boxSizing: 'border-box' },
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
