'use client';
import { useState, useEffect, useCallback } from 'react';
import { SALES_ENDPOINTS } from '../../../constants/api';

function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function DistributionPage() {
  const [projects,    setProjects]    = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [log,         setLog]         = useState([]);
  const [stats,       setStats]       = useState({ unassigned_tc: 0, unassigned_stm: 0 });
  const [loading,     setLoading]     = useState(true);
  const [distributing, setDistributing] = useState(null);
  const [clearingLog,  setClearingLog]  = useState(false);

  // Form
  const [distType,   setDistType]   = useState('telecaller');
  const [projectId,  setProjectId]  = useState('');
  const [count,      setCount]      = useState(10);
  const [result,     setResult]     = useState(null);

  const load = useCallback(async () => {
    const [pRes, tRes, lRes, sRes] = await Promise.all([
      fetch(SALES_ENDPOINTS.projects + '?active_only=true', { headers: authHeaders() }).then((r) => r.json()),
      fetch(SALES_ENDPOINTS.team, { headers: authHeaders() }).then((r) => r.json()),
      fetch(SALES_ENDPOINTS.distLog, { headers: authHeaders() }).then((r) => r.json()),
      fetch(SALES_ENDPOINTS.stats, { headers: authHeaders() }).then((r) => r.json()),
    ]);
    setProjects(Array.isArray(pRes) ? pRes : []);
    setTeamMembers(Array.isArray(tRes) ? tRes : []);
    setLog(Array.isArray(lRes) ? lRes : []);
    if (sRes && !sRes.detail) {
      setStats({ unassigned_tc: sRes.new_leads || 0, unassigned_stm: 0 });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function distribute() {
    setDistributing(distType);
    setResult(null);
    const res  = await fetch(SALES_ENDPOINTS.distribute, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ type: distType, project_id: projectId || null, count }),
    });
    const data = await res.json();
    setDistributing(null);
    if (!res.ok) { setResult({ error: data.detail || 'Distribution failed' }); return; }
    setResult({ success: true, ...data });
    load();
  }

  async function clearLog() {
    if (!window.confirm('Clear all distribution history?')) return;
    setClearingLog(true);
    await fetch(SALES_ENDPOINTS.distLog, { method: 'DELETE', headers: authHeaders() });
    setLog([]);
    setClearingLog(false);
  }

  const tcMembers  = teamMembers.filter((m) => m.crm_role === 'telecaller');
  const stmMembers = teamMembers.filter((m) => m.crm_role === 'stm');
  const activeRole = distType === 'telecaller' ? tcMembers : stmMembers;

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Lead Distribution</h1>
        <p style={{ fontSize: 13, color: '#8492A6' }}>Assign unassigned leads to telecallers or STMs</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Distribute panel */}
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 16 }}>Distribute Leads</h2>

          {/* Role toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[
              { val: 'telecaller', label: 'Telecallers', count: tcMembers.length },
              { val: 'stm',        label: 'STMs',        count: stmMembers.length },
            ].map((opt) => (
              <button key={opt.val} onClick={() => setDistType(opt.val)} style={{
                flex: 1, padding: '9px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: distType === opt.val ? 'none' : '1.5px solid #E0E6F0',
                backgroundColor: distType === opt.val ? '#182350' : '#fff',
                color: distType === opt.val ? '#fff' : '#8492A6',
              }}>
                {opt.label} ({opt.count})
              </button>
            ))}
          </div>

          {/* Team availability */}
          <div style={{ backgroundColor: '#F8FAFD', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              {distType === 'telecaller' ? 'Telecaller' : 'STM'} Team
            </p>
            {activeRole.length === 0 ? (
              <p style={{ fontSize: 12, color: '#EF4444' }}>No {distType === 'telecaller' ? 'telecallers' : 'STMs'} in team. Add members first.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activeRole.map((m) => (
                  <span key={m.id} style={{ padding: '3px 10px', borderRadius: 20, backgroundColor: '#E8EEFF', color: '#3D5AFE', fontSize: 12, fontWeight: 600 }}>
                    {m.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Project filter */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Project (optional)</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inp}>
              <option value="">All unassigned leads</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Count */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Max leads to distribute</label>
            <input type="number" min={1} max={500} value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))} style={inp} />
            <p style={{ fontSize: 11, color: '#8492A6', marginTop: 4 }}>Distributed equally (round-robin) among active team members.</p>
          </div>

          {/* Result */}
          {result && (
            <div style={{
              padding: '10px 14px', borderRadius: 9, marginBottom: 14,
              backgroundColor: result.error ? '#FEF2F2' : '#F0FDF4',
              color: result.error ? '#EF4444' : '#2E7D32',
              fontSize: 13, fontWeight: 600,
            }}>
              {result.error ? `✕ ${result.error}` : `✓ ${result.distributed} leads distributed`}
              {result.assignments && (
                <div style={{ fontWeight: 400, marginTop: 4, fontSize: 12 }}>
                  {Object.entries(result.assignments).map(([name, cnt]) => `${name}: ${cnt}`).join(' · ')}
                </div>
              )}
            </div>
          )}

          <button
            onClick={distribute}
            disabled={!!distributing || activeRole.length === 0}
            style={{ ...saveBtn, width: '100%', opacity: (!!distributing || activeRole.length === 0) ? 0.5 : 1 }}>
            {distributing === distType ? 'Distributing…' : `⚡ Distribute to ${distType === 'telecaller' ? 'Telecallers' : 'STMs'}`}
          </button>
        </div>

        {/* Team overview */}
        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 16 }}>Team Overview</h2>
          {loading ? <p style={{ color: '#8492A6', fontSize: 13 }}>Loading…</p> : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Telecallers', value: tcMembers.length, color: '#F9A825' },
                  { label: 'STMs',        value: stmMembers.length, color: '#3D5AFE' },
                  { label: 'Managers',    value: teamMembers.filter((m) => m.crm_role === 'manager').length, color: '#2E7D32' },
                  { label: 'Unassigned Leads', value: stats.unassigned_tc, color: '#EF4444' },
                ].map((s) => (
                  <div key={s.label} style={{ backgroundColor: '#F8FAFD', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: '#8492A6', marginTop: 2 }}>{s.label}</p>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>All Members</p>
              {teamMembers.length === 0 ? (
                <p style={{ fontSize: 12, color: '#8492A6' }}>No team members yet. Go to Users → Add Team Member.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {teamMembers.map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', backgroundColor: '#F8FAFD', borderRadius: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#E8EEFF', color: '#3D5AFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                        {(m.name || 'U')[0].toUpperCase()}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, color: '#1A1A2E', fontWeight: 500 }}>{m.name}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, backgroundColor: '#E8EEFF', color: '#3D5AFE', textTransform: 'capitalize' }}>
                        {m.crm_role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Distribution Log */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>Distribution History</h2>
          {log.length > 0 && (
            <button onClick={clearLog} disabled={clearingLog} style={{ ...cancelBtn, color: '#EF4444', fontSize: 12, padding: '6px 12px' }}>
              {clearingLog ? 'Clearing…' : 'Clear History'}
            </button>
          )}
        </div>

        {log.length === 0 ? (
          <p style={{ color: '#8492A6', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>No distributions run yet</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead style={{ backgroundColor: '#F8FAFD' }}>
                <tr>
                  {['Type', 'Leads', 'Triggered By', 'When', 'Details'].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #F0F3FA' }}>
                    <td style={td}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 700,
                        backgroundColor: row.dist_type === 'telecaller' ? '#FFF8E1' : '#E8EEFF',
                        color: row.dist_type === 'telecaller' ? '#F9A825' : '#3D5AFE',
                        textTransform: 'capitalize',
                      }}>
                        {row.dist_type}
                      </span>
                    </td>
                    <td style={{ ...td, fontWeight: 700, color: '#1A1A2E' }}>{row.leads_distributed}</td>
                    <td style={{ ...td, color: '#8492A6' }}>{row.triggered_by}</td>
                    <td style={{ ...td, color: '#8492A6', fontSize: 12 }}>{fmtDateTime(row.created_at)}</td>
                    <td style={{ ...td, color: '#8492A6', fontSize: 12 }}>
                      {row.details?.assignments?.map((a) => `${a.name}: ${a.count}`).join(' · ') || '—'}
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

const inp = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid #E0E6F0', fontSize: 13, boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8492A6', marginBottom: 5 };
const card = { backgroundColor: '#fff', borderRadius: 14, padding: '20px', boxShadow: '0 2px 8px rgba(184,196,214,0.18)' };
const tbl  = { width: '100%', borderCollapse: 'collapse' };
const th   = { textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8492A6', padding: '8px 14px', textTransform: 'uppercase', letterSpacing: 0.5 };
const td   = { padding: '10px 14px', fontSize: 13 };
const saveBtn   = { padding: '10px 20px', backgroundColor: '#182350', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const cancelBtn = { padding: '8px 14px', backgroundColor: '#F0F3FA', color: '#8492A6', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
