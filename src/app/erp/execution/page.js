'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ERP_EXECUTION, ERP_MASTER } from '../../../constants/api';

const GREEN  = '#2E7D32';
const GREEN2 = '#4CAF50';

const PR_STATUSES = ['Raised', 'Approved', 'PO Created', 'In Transit', 'Received', 'Issued to Site', 'Closed'];

const STATUS_STYLE = {
  'Raised':         { bg: '#EEF0FF', text: '#3D5AFE' },
  'Approved':       { bg: '#E8F5E9', text: '#2E7D32' },
  'PO Created':     { bg: '#FFF3E0', text: '#E65100' },
  'In Transit':     { bg: '#E0F7FA', text: '#0097A7' },
  'Received':       { bg: '#E8F5E9', text: '#388E3C' },
  'Issued to Site': { bg: '#F3E5F5', text: '#6A1B9A' },
  'Closed':         { bg: '#F5F6FA', text: '#8492A6' },
};

function Badge({ status }) {
  const c = STATUS_STYLE[status] || { bg: '#F5F6FA', text: '#8492A6' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: c.bg, color: c.text, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

function KpiCard({ label, value, sub, color, bg, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 1, minWidth: 140, background: '#fff', border: `1.5px solid ${bg}`, borderRadius: 16, padding: '20px 20px 16px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)'; }}
      onMouseLeave={(e) => { if (onClick) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#8492A6', marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

export default function ExecutionDashboard() {
  const router = useRouter();
  const [loading,      setLoading]      = useState(true);
  const [kpi,          setKpi]          = useState(null);
  const [statusCounts, setStatusCounts] = useState({});
  const [recentPRs,    setRecentPRs]    = useState([]);
  const [recentMBs,    setRecentMBs]    = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    try {
      const [prRes, mbRes] = await Promise.all([
        fetch(ERP_EXECUTION.prs, { headers: h }),
        fetch(ERP_EXECUTION.mbs, { headers: h }),
      ]);

      const [prData, mbData] = await Promise.all([
        prRes.ok  ? prRes.json() : null,
        mbRes.ok  ? mbRes.json() : null,
      ]);

      const prs = Array.isArray(prData) ? prData : (prData?.results || []);
      const mbs = Array.isArray(mbData) ? mbData : (mbData?.results || []);

      // Count by status
      const counts = {};
      PR_STATUSES.forEach((s) => { counts[s] = 0; });
      prs.forEach((pr) => { if (counts[pr.status] !== undefined) counts[pr.status]++; });

      const openPRs         = prs.filter((p) => !['Closed'].includes(p.status)).length;
      const pendingApproval = counts['Raised'] || 0;

      // This month — PRs raised in current calendar month
      const now       = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthPRs  = prs.filter((pr) => (pr.raised_date || '').startsWith(thisMonth));
      const monthLineCount = monthPRs.reduce((sum, pr) => sum + (pr.line_count || 0), 0);

      // WBS estimation = Σ budgeted_cost across all WBS activities (BOQ total)
      const wbsRaw  = await fetch(ERP_MASTER.wbs, { headers: h }).then((r) => r.ok ? r.json() : []);
      const wbsList = Array.isArray(wbsRaw) ? wbsRaw : (wbsRaw?.results || []);
      const totalWBSEstimation = wbsList.reduce((sum, w) => sum + (parseFloat(w.budgeted_cost) || 0), 0);

      setKpi({
        totalPRs: prs.length,
        openPRs,
        pendingApproval,
        totalMBs: mbs.length,
        monthPRs:            monthPRs.length,
        monthLineCount,
        totalWBSEstimation,
        monthLabel: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      });
      setStatusCounts(counts);
      setRecentPRs(prs.slice(0, 6));
      setRecentMBs(mbs.slice(0, 5));
    } catch {}
    setLoading(false);
  }

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', backgroundColor: '#DFE4EE' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#8492A6', letterSpacing: 1.5, marginBottom: 6 }}>EXECUTION DEPARTMENT</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1A1A2E', margin: 0 }}>Dashboard</h1>
        </div>
        <button
          onClick={() => router.push('/erp/pr/create')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: GREEN, border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(46,125,50,0.3)' }}
        >
          <span style={{ fontSize: 16 }}>+</span> New PR
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E0E6F0', borderTopColor: GREEN, animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiCard label="Total PRs"         value={kpi?.totalPRs}        sub="All time"              color={GREEN}    bg="#E8F5E9" onClick={() => router.push('/erp/pr')} />
            <KpiCard label="Open PRs"          value={kpi?.openPRs}         sub="Not yet closed"        color="#0097A7"  bg="#E0F7FA" onClick={() => router.push('/erp/pr')} />
            <KpiCard label="Pending Approval"  value={kpi?.pendingApproval} sub="Status: Raised"        color="#3D5AFE"  bg="#EEF0FF" onClick={() => router.push('/erp/pr')} />
            <KpiCard label="Measurement Books" value={kpi?.totalMBs}        sub="Work progress records" color="#6A1B9A"  bg="#F3E5F5" onClick={() => router.push('/erp/mb')} />
          </div>

          {/* ── WBS Estimation Banner ── */}
          {(() => {
            const est = kpi?.totalWBSEstimation ?? 0;
            const fmtINR = (n) => {
              if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
              if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
              return `₹${Math.round(n).toLocaleString('en-IN')}`;
            };
            return (
              <div style={{ background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 55%, #388E3C 100%)', borderRadius: 16, padding: '24px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.8, marginBottom: 4 }}>TOTAL WBS ESTIMATION</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Budgeted cost from BOQ activities</div>
                </div>
                <div>
                  <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{fmtINR(est)}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 5 }}>Total Estimated Project Value (WBS)</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', alignSelf: 'stretch' }} />
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 6 }}>{kpi?.monthLabel?.toUpperCase()}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#A5D6A7', lineHeight: 1 }}>{kpi?.monthPRs ?? 0}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>PRs Raised This Month</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.0)', marginBottom: 6 }}>—</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#C8E6C9', lineHeight: 1 }}>{kpi?.monthLineCount ?? 0}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Material Lines</div>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <button onClick={() => router.push('/erp/pr')}
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '8px 18px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                    View PRs →
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ── Status Breakdown + Recent PRs ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 20 }}>

            {/* Status breakdown */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 18 }}>PR STATUS BREAKDOWN</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PR_STATUSES.map((st) => {
                  const count = statusCounts[st] || 0;
                  const total = kpi?.totalPRs || 1;
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

            {/* Recent PRs */}
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1 }}>RECENT PURCHASE REQUISITIONS</div>
                <button onClick={() => router.push('/erp/pr')} style={{ background: '#E8F5E9', border: 'none', borderRadius: 8, padding: '5px 12px', color: GREEN, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>View All</button>
              </div>
              {recentPRs.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8492A6', fontSize: 13 }}>No PRs yet. <button onClick={() => router.push('/erp/pr/create')} style={{ color: GREEN, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Raise your first PR →</button></div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #F0F4FA', background: '#FAFBFD' }}>
                      {['PR No.', 'Project', 'Lines', 'Date', 'Status'].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, color: '#8492A6', textAlign: 'left', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentPRs.map((pr) => (
                      <tr key={pr.id} style={{ borderBottom: '1px solid #F5F8FC' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{pr.pr_no}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#374151' }}>{pr.project_name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#374151', textAlign: 'center' }}>{pr.line_count}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#8492A6' }}>{pr.raised_date}</td>
                        <td style={{ padding: '12px 16px' }}><Badge status={pr.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Recent MBs + Quick Actions ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>

            {/* Recent MBs */}
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1 }}>MEASUREMENT BOOKS</div>
                <button onClick={() => router.push('/erp/mb')} style={{ background: '#F3E5F5', border: 'none', borderRadius: 8, padding: '5px 12px', color: '#6A1B9A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>View All</button>
              </div>
              {recentMBs.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8492A6', fontSize: 13 }}>No measurement books recorded yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #F0F4FA', background: '#FAFBFD' }}>
                      {['MB No.', 'Project', 'Activity', 'Status'].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, color: '#8492A6', textAlign: 'left', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentMBs.map((mb) => (
                      <tr key={mb.id} style={{ borderBottom: '1px solid #F5F8FC' }}>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{mb.mb_no}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#374151' }}>{mb.project_name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#374151' }}>{mb.activity_name || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#F3E5F5', color: '#6A1B9A' }}>{mb.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Quick actions */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#8492A6', letterSpacing: 1, marginBottom: 18 }}>QUICK ACTIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Raise New PR',      href: '/erp/pr/create', icon: '📋', color: GREEN,     bg: '#E8F5E9' },
                  { label: 'View All PRs',       href: '/erp/pr',        icon: '📄', color: '#0097A7', bg: '#E0F7FA' },
                  { label: 'Measurement Books',  href: '/erp/mb',        icon: '📐', color: '#6A1B9A', bg: '#F3E5F5' },
                ].map((a) => (
                  <button key={a.href} onClick={() => router.push(a.href)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: a.bg, border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: a.color, opacity: 0.6 }}>→</span>
                  </button>
                ))}
              </div>

              {/* Dept badge */}
              <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 12, background: 'linear-gradient(135deg, #1B5E20, #2E7D32)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5, marginBottom: 4 }}>DEPARTMENT</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>Execution</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>Site & Work Management</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
