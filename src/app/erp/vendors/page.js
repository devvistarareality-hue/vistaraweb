'use client';
import { useState, useEffect } from 'react';
import { ERP_MASTER } from '../../../constants/api';

const AVATAR_COLORS = ['#182350', '#0097A7', '#3D5AFE', '#2E7D32', '#E65100', '#6A1B9A', '#F9A825'];
function avatarColor(name = '') { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] || '#182350'; }

export default function VendorListPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('All');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res   = await fetch(`${ERP_MASTER.vendors}?is_active=true`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setVendors(Array.isArray(data) ? data : (data.results || []));
      }
    } catch {}
    setLoading(false);
  }

  const filtered = vendors.filter((v) =>
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.code?.toLowerCase().includes(search.toLowerCase()) ||
    v.gstin?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={s.page}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.breadcrumb}>ERP › Vendors</div>
          <h1 style={s.pageTitle}>Vendor Master</h1>
        </div>
        <div style={s.headerRight}>
          <span style={s.countChip}>{filtered.length} vendors</span>
          <button onClick={load} style={s.refreshBtn}>↻ Refresh</button>
        </div>
      </div>

      <div style={s.toolbar}>
        <input style={s.search} placeholder="Search vendor name, code or GSTIN..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={s.grid}>
        {loading ? (
          <div style={s.center}><div style={s.spinner} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>No vendors found.</div>
        ) : (
          filtered.map((vendor) => {
            const color = avatarColor(vendor.name);
            return (
              <div key={vendor.id} style={s.card}>
                <div style={[s.avatar, { backgroundColor: color }]}>
                  <span style={s.avatarText}>{(vendor.name || 'V')[0].toUpperCase()}</span>
                </div>
                <div style={s.cardBody}>
                  <div style={s.vendorName}>{vendor.name}</div>
                  <div style={s.vendorCode}>{vendor.code}</div>
                  {vendor.phone && <div style={s.vendorMeta}>📞 {vendor.phone}</div>}
                  {vendor.gstin && <div style={s.vendorMeta}>GSTIN: {vendor.gstin}</div>}
                  {vendor.payment_terms && <div style={s.vendorMeta}>Net {vendor.payment_terms} days</div>}
                </div>
                <div style={[s.statusDot, { backgroundColor: vendor.is_active ? '#2E7D32' : '#9CA3AF' }]} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const s = {
  page: { padding: '24px', minHeight: '100vh', backgroundColor: '#DFE4EE' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  breadcrumb: { fontSize: 11, color: '#8492A6', fontWeight: 500, marginBottom: 6 },
  pageTitle:  { fontSize: 26, fontWeight: 800, color: '#1A1A2E' },
  headerRight:{ display: 'flex', gap: 10, alignItems: 'center' },
  countChip:  { fontSize: 12, color: '#8492A6', backgroundColor: '#fff', borderRadius: 20, padding: '4px 12px', border: '1px solid #E0E6F0' },
  refreshBtn: { padding: '8px 16px', borderRadius: 10, border: '1px solid #E0E6F0', backgroundColor: '#fff', fontSize: 13, fontWeight: 600, color: '#0C1E3C', cursor: 'pointer' },
  toolbar:    { backgroundColor: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  search:     { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E0E6F0', fontSize: 13, color: '#1A1A2E', outline: 'none', boxSizing: 'border-box' },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 },
  card:       { backgroundColor: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' },
  avatar:     { width: 48, height: 48, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 20, fontWeight: 800, color: '#fff' },
  cardBody:   { flex: 1, minWidth: 0 },
  vendorName: { fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 3 },
  vendorCode: { fontSize: 12, color: '#8492A6', marginBottom: 6 },
  vendorMeta: { fontSize: 12, color: '#374151', marginTop: 3 },
  statusDot:  { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  center:     { gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 },
  spinner:    { width: 32, height: 32, borderRadius: '50%', border: '3px solid #E0E6F0', borderTopColor: '#0C1E3C', animation: 'spin 0.8s linear infinite' },
  empty:      { gridColumn: '1 / -1', padding: 48, textAlign: 'center', color: '#8492A6', fontSize: 14 },
};
