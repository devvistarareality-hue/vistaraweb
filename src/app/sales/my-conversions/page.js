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

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const HISTORY_LABEL = {
  created: 'Lead Created', status: 'Overall Status', telecaller_status: 'TC Status',
  stm_status: 'STM Status', telecaller: 'Telecaller Assigned', stm: 'STM Assigned',
  warm_transfer: 'Transferred to STM', site_visit: 'Site Visit', closure: 'Closure',
};
const HISTORY_COLOR = {
  created: '#64748B', status: '#3D5AFE', telecaller_status: '#0097A7', stm_status: '#FF6B2B',
  telecaller: '#7B1FA2', stm: '#2E7D32', warm_transfer: '#EF4444', site_visit: '#F9A825', closure: '#15803D',
};

// In-place lead detail + full history. Opens instantly with the row data we already
// have, then streams the history timeline from a single lead-detail fetch — no
// navigation, no leads-list load.
function LeadHistoryModal({ lead, onClose }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    let alive = true;
    setDetail(null);
    (async () => {
      try {
        const res = await fetch(SALES_ENDPOINTS.lead(lead.id), { headers: authHeaders() });
        if (res.ok && alive) setDetail(await res.json());
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [lead.id]);

  const d = detail || {};
  const rows = [
    ['Phone', d.phone || lead.phone],
    ['Project', d.project_name || lead.project_name],
    ['Source', d.source_name],
    ['Telecaller', d.telecaller_name],
    ['STM', d.stm_name],
    ['Status', (d.status || '').replace(/_/g, ' ')],
  ];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: '100%', maxHeight: '88vh', backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #182350 0%, #3D5AFE 100%)', padding: '18px 22px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{lead.name || '—'}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{d.phone || lead.phone || ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: 22, overflowY: 'auto' }}>
          {/* Quick detail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 20 }}>
            {rows.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.4 }}>{k}</div>
                <div style={{ fontSize: 13, color: '#1A1A2E', marginTop: 2, textTransform: k === 'Status' ? 'capitalize' : 'none' }}>{v || '—'}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, color: '#0C1E3C', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>History</div>

          {/* Lead received */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#3D5AFE18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📥</div>
              <div style={{ width: 2, flex: 1, backgroundColor: '#F0F3FA', marginTop: 4 }} />
            </div>
            <div style={{ paddingBottom: 18, flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>Lead Received</p>
              <p style={{ fontSize: 11, color: '#8492A6', margin: '3px 0 0' }}>Source: {d.source_name || '—'} · Project: {d.project_name || lead.project_name || '—'}</p>
              <p style={{ fontSize: 11, color: '#B0BAC9', margin: '3px 0 0' }}>{fmtDateTime(d.created_at)}</p>
            </div>
          </div>

          {!detail && <p style={{ fontSize: 13, color: '#8492A6' }}>Loading…</p>}
          {detail && (detail.history || []).filter(h => h.field_changed !== 'created').length === 0 && (
            <p style={{ fontSize: 13, color: '#B0BAC9', textAlign: 'center', marginTop: 8 }}>No changes recorded yet.</p>
          )}
          {(detail?.history || []).filter(h => h.field_changed !== 'created').map((h, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const color  = HISTORY_COLOR[h.field_changed] || '#8492A6';
            const icon   = h.field_changed === 'warm_transfer' ? '🔥'
                         : h.field_changed === 'telecaller'    ? '👤'
                         : h.field_changed === 'stm'           ? '🏢'
                         : h.field_changed === 'site_visit'    ? '🏠'
                         : h.field_changed === 'closure'       ? '✅'
                         : h.field_changed.includes('status')  ? '🔄' : '✏️';
            const singleValue = ['created', 'warm_transfer', 'closure'].includes(h.field_changed) || !h.old_value;
            const byLabel = h.changed_by_name || (['created', 'telecaller', 'stm'].includes(h.field_changed) ? 'System (auto)' : null);
            return (
              <div key={h.id} style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{icon}</div>
                  {!isLast && <div style={{ width: 2, flex: 1, backgroundColor: '#F0F3FA', marginTop: 4 }} />}
                </div>
                <div style={{ paddingBottom: isLast ? 0 : 18, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>{HISTORY_LABEL[h.field_changed] || h.field_changed}</p>
                  <p style={{ fontSize: 12, color: '#3A3A5C', margin: '3px 0 0' }}>
                    {singleValue ? (
                      <span style={{ color, fontWeight: 600 }}>{h.new_value || '—'}</span>
                    ) : (
                      <>
                        <span style={{ color: '#8492A6' }}>{h.old_value || '—'}</span>
                        {' → '}
                        <span style={{ color, fontWeight: 600 }}>{h.new_value || '—'}</span>
                      </>
                    )}
                  </p>
                  {byLabel && <p style={{ fontSize: 11, color: '#8492A6', margin: '2px 0 0' }}>by {byLabel}</p>}
                  <p style={{ fontSize: 11, color: '#B0BAC9', margin: '2px 0 0' }}>{fmtDateTime(h.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
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
  const des = (user?.designation || '').toLowerCase();
  const isStm = des.includes('stm') || des.includes('sales team') || des.includes('sales executive');
  const [tab, setTab] = useState('sv');
  const [historyLead, setHistoryLead] = useState(null); // { id, name, phone, project_name } | null

  const openLead = (row) => {
    if (row?.lead) setHistoryLead({ id: row.lead, name: row.lead_name, phone: row.lead_phone, project_name: row.project_name });
  };
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
          {isStm
            ? 'Track all your site visits and closures across the leads you handle'
            : 'Track site visits and closures from leads you referred to the sales team'}
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
              {isStm ? 'No site visits recorded yet.' : 'No site visits completed for your referred leads yet.'}
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
                  <th style={th}>{isStm ? 'Telecaller' : 'STM'}</th>
                </tr>
              </thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id} onClick={() => openLead(v)} style={{ transition: 'background 0.1s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.background = ''}>
                    <td style={td}><span style={{ fontWeight: 600 }}>{v.lead_name || '—'}</span></td>
                    <td style={{ ...td, color: '#6B7280' }}>{v.lead_phone || '—'}</td>
                    <td style={td}>{v.project_name || '—'}</td>
                    <td style={td}>{v.visited_at ? fmtDate(v.visited_at) : (v.scheduled_at ? fmtDate(v.scheduled_at) : '—')}</td>
                    <td style={td}><StatusBadge status={v.status} colors={SV_COLOR} /></td>
                    <td style={{ ...td, color: '#6B7280' }}>{(isStm ? v.referred_by_telecaller_name : v.stm_name) || '—'}</td>
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
              {isStm ? 'No closures recorded yet.' : 'No closures from your referred leads yet.'}
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
                  <tr key={c.id} onClick={() => openLead(c)} style={{ transition: 'background 0.1s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'} onMouseOut={e => e.currentTarget.style.background = ''}>
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

      {historyLead && <LeadHistoryModal lead={historyLead} onClose={() => setHistoryLead(null)} />}
    </div>
  );
}
