'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ERP_MASTER } from '../../../constants/api';

const GREEN = '#2E7D32';

const fmtINR = (n) => {
  const v = parseFloat(n) || 0;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(2)} L`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
};

export default function WBSListPage() {
  const router = useRouter();
  const [activities, setActivities] = useState([]);
  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [projectId,  setProjectId]  = useState('');
  const [search,     setSearch]     = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const h = { Authorization: `Bearer ${token}` };
      const [wbsRes, prjRes] = await Promise.all([
        fetch(ERP_MASTER.wbs, { headers: h }),
        fetch(ERP_MASTER.projects, { headers: h }),
      ]);
      if (wbsRes.ok) {
        const d = await wbsRes.json();
        setActivities(Array.isArray(d) ? d : (d.results || []));
      }
      if (prjRes.ok) {
        const d = await prjRes.json();
        setProjects(Array.isArray(d) ? d : (d.results || []));
      }
    } catch {}
    setLoading(false);
  }

  const filtered = activities.filter((a) =>
    (!projectId || String(a.project) === projectId) &&
    (!search || a.wbs_code?.toLowerCase().includes(search.toLowerCase()) ||
                a.description?.toLowerCase().includes(search.toLowerCase()) ||
                a.item_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const totalEstimation  = filtered.reduce((s, a) => s + (parseFloat(a.budgeted_cost) || 0), 0);
  const totalBudgetedQty = filtered.reduce((s, a) => s + (parseFloat(a.budgeted_qty) || 0), 0);

  // Group filtered activities by project for summary row
  const projectTotals = {};
  filtered.forEach((a) => {
    const key = a.project_name || 'Unknown';
    if (!projectTotals[key]) projectTotals[key] = 0;
    projectTotals[key] += parseFloat(a.budgeted_cost) || 0;
  });

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.breadcrumb}>ERP › Execution › WBS / BOQ</div>
          <h1 style={s.pageTitle}>WBS & Estimation</h1>
          <p style={s.pageSub}>Work Breakdown Structure — budgeted quantities and rates from BOQ</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={load} style={s.refreshBtn}>↻ Refresh</button>
          <button onClick={() => router.push('/erp/wbs/create')} style={s.newBtn}>+ New WBS Entry</button>
        </div>
      </div>

      {/* Estimation Summary Banner */}
      <div style={{ background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 55%, #388E3C 100%)', borderRadius: 16, padding: '22px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.8, marginBottom: 4 }}>TOTAL WBS ESTIMATION</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {projectId ? projects.find((p) => String(p.id) === projectId)?.name || 'Selected Project' : 'All Projects'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 40, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{fmtINR(totalEstimation)}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Total Budgeted Cost (BOQ)</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.15)', alignSelf: 'stretch' }} />
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#A5D6A7', lineHeight: 1 }}>{filtered.length}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>WBS Activities</div>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#C8E6C9', lineHeight: 1 }}>{Object.keys(projectTotals).length}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>Projects</div>
          </div>
        </div>

        {/* Project-wise breakdown */}
        {Object.keys(projectTotals).length > 1 && (
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 1, marginBottom: 4 }}>BY PROJECT</div>
            {Object.entries(projectTotals).map(([name, cost]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#A5D6A7', whiteSpace: 'nowrap' }}>{fmtINR(cost)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={s.toolbar}>
        <input
          style={{ ...s.search, flex: 1 }}
          placeholder="Search by WBS code, description or material..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          style={s.projectSelect}
        >
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <div style={s.center}>
            <div style={s.spinner} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>
            No WBS activities found.{' '}
            <button onClick={() => router.push('/erp/wbs/create')} style={{ color: GREEN, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              Add your first WBS entry →
            </button>
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['WBS Code', 'Description', 'Project', 'Material', 'UOM', 'Budgeted Qty', 'Unit Rate', 'Budgeted Cost'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} style={s.tr}>
                  <td style={{ ...s.td, fontWeight: 700, color: GREEN, whiteSpace: 'nowrap' }}>{a.wbs_code}</td>
                  <td style={{ ...s.td, maxWidth: 220 }}>{a.description}</td>
                  <td style={{ ...s.td, fontSize: 12, color: '#8492A6' }}>{a.project_name}</td>
                  <td style={{ ...s.td, fontSize: 12 }}>{a.item_name || '—'}</td>
                  <td style={{ ...s.td, textAlign: 'center', fontSize: 12 }}>{a.uom}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>
                    {parseFloat(a.budgeted_qty || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 600 }}>
                    ₹{parseFloat(a.unit_rate || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 800, color: GREEN, whiteSpace: 'nowrap' }}>
                    {fmtINR(a.budgeted_cost)}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ background: '#E8F5E9', borderTop: `2px solid ${GREEN}` }}>
                <td colSpan={7} style={{ ...s.td, fontWeight: 800, color: '#1A1A2E', textAlign: 'right' }}>TOTAL ESTIMATION</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 900, fontSize: 15, color: GREEN, whiteSpace: 'nowrap' }}>{fmtINR(totalEstimation)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const s = {
  page:          { padding: '24px', minHeight: '100vh', backgroundColor: '#DFE4EE' },
  pageHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  breadcrumb:    { fontSize: 11, color: '#8492A6', fontWeight: 500, marginBottom: 4 },
  pageTitle:     { fontSize: 26, fontWeight: 800, color: '#1A1A2E', margin: 0 },
  pageSub:       { fontSize: 12, color: '#8492A6', margin: '4px 0 0' },
  refreshBtn:    { padding: '8px 16px', borderRadius: 10, border: '1px solid #E0E6F0', backgroundColor: '#fff', fontSize: 13, fontWeight: 600, color: '#0C1E3C', cursor: 'pointer' },
  newBtn:        { padding: '8px 18px', borderRadius: 10, border: 'none', backgroundColor: GREEN, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  toolbar:       { backgroundColor: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', gap: 12, alignItems: 'center' },
  search:        { padding: '10px 14px', borderRadius: 10, border: '1px solid #E0E6F0', fontSize: 13, color: '#1A1A2E', outline: 'none', boxSizing: 'border-box' },
  projectSelect: { padding: '10px 14px', borderRadius: 10, border: '1px solid #E0E6F0', fontSize: 13, color: '#1A1A2E', outline: 'none', background: '#fff', cursor: 'pointer', minWidth: 200 },
  tableWrap:     { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  table:         { width: '100%', borderCollapse: 'collapse' },
  th:            { padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textAlign: 'left', borderBottom: '1px solid #F0F4FA', letterSpacing: 0.4, backgroundColor: '#FAFBFD', whiteSpace: 'nowrap' },
  tr:            { borderBottom: '1px solid #F0F4FA' },
  td:            { padding: '13px 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' },
  center:        { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner:       { width: 32, height: 32, borderRadius: '50%', border: '3px solid #E0E6F0', borderTopColor: GREEN, animation: 'spin 0.8s linear infinite' },
  empty:         { padding: 48, textAlign: 'center', color: '#8492A6', fontSize: 14 },
};
