'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ERP_PURCHASE, ERP_INVENTORY, ERP_FINANCE } from '../../../constants/api';

const ORANGE = '#E65100';

const PO_STATUSES = ['Draft', 'Confirmed', 'Dispatched', 'Closed', 'Cancelled'];

const STATUS_STYLE = {
  'Draft':      { bg: '#F5F6FA', text: '#8492A6' },
  'Confirmed':  { bg: '#EEF0FF', text: '#3D5AFE' },
  'Dispatched': { bg: '#E0F7FA', text: '#0097A7' },
  'Closed':     { bg: '#E8F5E9', text: '#2E7D32' },
  'Cancelled':  { bg: '#FEE2E2', text: '#DC2626' },
};

const INVOICE_STYLE = {
  'Unpaid':          { bg: '#FEE2E2', text: '#DC2626' },
  'Partially Paid':  { bg: '#FFF3E0', text: '#E65100' },
  'Paid':            { bg: '#E8F5E9', text: '#2E7D32' },
};

function Badge({ status, styleMap }) {
  const map = styleMap || STATUS_STYLE;
  const c   = map[status] || { bg: '#F5F6FA', text: '#8492A6' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.text, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

function KpiCard({ label, value, sub, color, bg, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 1, minWidth: 130, background: '#fff', border: `1.5px solid ${bg}`, borderRadius: 16, padding: '20px 20px 16px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
        </svg>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#8492A6', marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

export default function PurchaseDashboard() {
  const router = useRouter();
  const [loading,      setLoading]      = useState(true);
  const [kpi,          setKpi]          = useState(null);
  const [statusCounts, setStatusCounts] = useState({});
  const [recentPOs,    setRecentPOs]    = useState([]);
  const [recentGRNs,   setRecentGRNs]   = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    try {
      const [poRes, grnRes, invRes] = await Promise.all([
        fetch(ERP_PURCHASE.pos,       { headers: h }),
        fetch(ERP_INVENTORY.grns,     { headers: h }),
        fetch(ERP_FINANCE.invoices,   { headers: h }),
      ]);

      const [poData, grnData, invData] = await Promise.all([
        poRes.ok  ? poRes.json()  : null,
        grnRes.ok ? grnRes.json() : null,
        invRes.ok ? invRes.json() : null,
      ]);

      const pos      = Array.isArray(poData)  ? poData  : (poData?.results  || []);
      const grns     = Array.isArray(grnData) ? grnData : (grnData?.results || []);
      const invoices = Array.isArray(invData) ? invData : (invData?.results || []);

      // PO status counts
      const counts = {};
      PO_STATUSES.forEach((s) => { counts[s] = 0; });
      pos.forEach((po) => { if (counts[po.status] !== undefined) counts[po.status]++; });

      const unpaidInvoices = invoices.filter((i) => i.payment_status === 'Unpaid').length;
      const totalValue     = pos.reduce((s, po) => s + (parseFloat(po.total_amount) || 0), 0);

      setKpi({
        totalPOs:     pos.length,
        openPOs:      pos.filter((p) => !['Closed', 'Cancelled'].includes(p.status)).length,
        totalGRNs:    grns.length,
        unpaidInvoices,
        totalValue,
      });
      setStatusCounts(counts);
      setRecentPOs(pos.slice(0, 6));
      setRecentGRNs(grns.slice(0, 4));
      setRecentInvoices(invoices.slice(0, 4));
    } catch {}
    setLoading(false);
  }

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', backgroundColor: '#DFE4EE' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#8492A6', letterSpacing: 1.5, marginBottom: 6 }}>PURCHASE DEPARTMENT</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>Dashboard</h1>
        </div>
        <button
          onClick={() => router.push('/erp/po/create')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: ORANGE, border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(230,81,0,0.3)' }}
        >
          <span style={{ fontSize: 16 }}>+</span> New PO
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E0E6F0', borderTopColor: ORANGE, animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiCard label="Total POs"      value={kpi?.totalPOs}       sub="All time"              color={ORANGE}   bg="#FFF3E0"  onClick={() => router.push('/erp/po')} />
            <KpiCard label="Open POs"       value={kpi?.openPOs}        sub="Active orders"         color="#0097A7"  bg="#E0F7FA"  onClick={() => router.push('/erp/po')} />
            <KpiCard label="Total GRNs"     value={kpi?.totalGRNs}      sub="Goods received"        color="#2E7D32"  bg="#E8F5E9"  onClick={() => router.push('/erp/grn')} />
            <KpiCard label="Unpaid Invoices" value={kpi?.unpaidInvoices} sub="Awaiting payment"     color="#DC2626"  bg="#FEE2E2"  onClick={() => router.push('/erp/invoices')} />
            {kpi?.totalValue > 0 && (
              <KpiCard label="Total PO Value" value={`₹${(kpi.totalValue / 100000).toFixed(1)}L`} sub="Excl. tax" color="#182350" bg="#E8EEFF" />
            )}
          </div>

          {/* ── Status breakdown + Recent POs ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 20 }}>

            {/* PO Status breakdown */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 18 }}>PO STATUS BREAKDOWN</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {PO_STATUSES.map((st) => {
                  const count = statusCounts[st] || 0;
                  const total = kpi?.totalPOs || 1;
                  const pct   = Math.round((count / total) * 100);
                  const c     = STATUS_STYLE[st] || { bg: '#F5F6FA', text: '#8492A6' };
                  return (
                    <div key={st}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{st}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: c.text }}>{count}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: '#F0F4FA', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: c.text, borderRadius: 3, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent POs */}
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1 }}>RECENT PURCHASE ORDERS</div>
                <button onClick={() => router.push('/erp/po')} style={{ background: '#FFF3E0', border: 'none', borderRadius: 8, padding: '5px 12px', color: ORANGE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>View All</button>
              </div>
              {recentPOs.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8492A6', fontSize: 13 }}>No POs yet. <button onClick={() => router.push('/erp/po/create')} style={{ color: ORANGE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Create your first PO →</button></div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #F0F4FA', background: '#FAFBFD' }}>
                      {['PO No.', 'Project', 'Vendor', 'Date', 'Status'].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, color: '#8492A6', textAlign: 'left', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentPOs.map((po) => (
                      <tr key={po.id} style={{ borderBottom: '1px solid #F5F8FC' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{po.po_no}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#374151' }}>{po.project_name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#374151' }}>{po.vendor_name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#8492A6' }}>{po.po_date}</td>
                        <td style={{ padding: '12px 16px' }}><Badge status={po.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── GRNs + Invoices + Quick Actions ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

            {/* Recent GRNs */}
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1 }}>RECENT GRNs</div>
                <button onClick={() => router.push('/erp/grn')} style={{ background: '#E0F7FA', border: 'none', borderRadius: 8, padding: '4px 10px', color: '#0097A7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>All</button>
              </div>
              {recentGRNs.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: '#8492A6', fontSize: 12 }}>No GRNs recorded yet.</div>
              ) : (
                <div style={{ padding: '0 20px 16px' }}>
                  {recentGRNs.map((grn) => (
                    <div key={grn.id} style={{ borderBottom: '1px solid #F5F8FC', paddingBottom: 10, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{grn.grn_no}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: grn.qc_status === 'Accepted' ? '#2E7D32' : '#E65100', background: grn.qc_status === 'Accepted' ? '#E8F5E9' : '#FFF3E0', borderRadius: 10, padding: '2px 8px' }}>{grn.qc_status || 'Pending'}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#8492A6', marginTop: 3 }}>{grn.vendor_name} · {grn.received_date}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Invoices */}
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1 }}>RECENT INVOICES</div>
                <button onClick={() => router.push('/erp/invoices')} style={{ background: '#EEF0FF', border: 'none', borderRadius: 8, padding: '4px 10px', color: '#3D5AFE', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>All</button>
              </div>
              {recentInvoices.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', color: '#8492A6', fontSize: 12 }}>No invoices recorded yet.</div>
              ) : (
                <div style={{ padding: '0 20px 16px' }}>
                  {recentInvoices.map((inv) => (
                    <div key={inv.id} style={{ borderBottom: '1px solid #F5F8FC', paddingBottom: 10, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{inv.invoice_no}</span>
                        <Badge status={inv.payment_status} styleMap={INVOICE_STYLE} />
                      </div>
                      <div style={{ fontSize: 12, color: '#8492A6', marginTop: 3 }}>{inv.vendor_name}</div>
                      {inv.total_amount && <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 2 }}>₹{parseFloat(inv.total_amount).toLocaleString('en-IN')}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 16 }}>QUICK ACTIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'New Purchase Order', href: '/erp/po/create',   icon: '🛒', color: ORANGE,    bg: '#FFF3E0' },
                  { label: 'View PO List',       href: '/erp/po',          icon: '📋', color: '#0097A7', bg: '#E0F7FA' },
                  { label: 'GRN Records',        href: '/erp/grn',         icon: '🚚', color: '#2E7D32', bg: '#E8F5E9' },
                  { label: 'Stock Balance',      href: '/erp/stock',       icon: '📦', color: '#F9A825', bg: '#FFF8E1' },
                  { label: 'Vendor Invoices',    href: '/erp/invoices',    icon: '📄', color: '#3D5AFE', bg: '#EEF0FF' },
                ].map((a) => (
                  <button key={a.href} onClick={() => router.push(a.href)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: a.bg, border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: a.color }}>{a.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: a.color, opacity: 0.6 }}>→</span>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 12, background: 'linear-gradient(135deg, #BF360C, #E65100)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5, marginBottom: 4 }}>DEPARTMENT</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>Purchase</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>Procurement & Inventory</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
