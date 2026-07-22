'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';


function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const endOfToday   = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };

const fuStatusColor = { pending: '#F9A825', completed: '#2E7D32', missed: '#B71C1C', rescheduled: '#0097A7' };

const TABS = [
  { key: 'today',   label: "Today's" },
  { key: 'overdue', label: 'Overdue' },
  { key: 'pending', label: 'All Pending' },
  { key: 'all',     label: 'All' },
];

export function FollowUpsContent({ adminView = false }) {
  const user      = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('today');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = [];
      if (companyId) params.push(`company_id=${companyId}`);
      if (adminView) params.push('admin_view=1');
      const url = params.length ? `${SALES_ENDPOINTS.followUps}?${params.join('&')}` : SALES_ENDPOINTS.followUps;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) setItems(await res.json());
    } catch (_) {}
    setLoading(false);
  }, [companyId, adminView]);

  useEffect(() => { load(); }, [load, companyId]);

  async function markDone(id) {
    const res = await fetch(SALES_ENDPOINTS.followUp(id), {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((list) => list.map((f) => (f.id === id ? updated : f)));
    }
  }

  const now = new Date();
  const visible = items.filter((fu) => {
    const at = new Date(fu.scheduled_at);
    if (filter === 'all')     return true;
    if (filter === 'pending') return fu.status === 'pending';
    if (filter === 'today')   return fu.status === 'pending' && at >= startOfToday() && at <= endOfToday();
    if (filter === 'overdue') return fu.status === 'pending' && at < now;
    return true;
  });

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>Follow-Ups</h1>
      <p style={{ fontSize: 13, color: '#8492A6', margin: '4px 0 18px' }}>
        {visible.length} item{visible.length === 1 ? '' : 's'} · {user?.name || ''}
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E4E8F0', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'none', border: 'none', whiteSpace: 'nowrap',
                color: active ? '#3D5AFE' : '#8492A6',
                borderBottom: active ? '2px solid #3D5AFE' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: '#8492A6', textAlign: 'center', padding: '40px 0' }}>Loading…</p>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#5A6B85', margin: 0 }}>No follow-ups</p>
          <p style={{ fontSize: 13, color: '#B0BAC9', margin: '4px 0 0' }}>Schedule follow-ups from lead details</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.map((fu) => {
            const overdue = fu.status === 'pending' && new Date(fu.scheduled_at) < now;
            return (
              <div key={fu.id} style={{
                border: `1.5px solid ${overdue ? '#FECACA' : '#E4E8F0'}`,
                background: overdue ? '#FEF2F2' : '#fff',
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>{fu.lead_name || 'Lead'}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6,
                      color: fu.role_context === 'stm' ? '#FF6B2B' : '#0097A7' }}>
                      {fu.role_context?.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      backgroundColor: (fuStatusColor[fu.status] || '#9E9E9E') + '18',
                      color: fuStatusColor[fu.status] || '#9E9E9E' }}>
                      {fu.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: overdue ? '#DC2626' : '#3A3A5C', margin: '6px 0 0' }}>
                    {fmtDateTime(fu.scheduled_at)}
                  </p>
                  {fu.assigned_to_name && <p style={{ fontSize: 12, color: '#8492A6', margin: '2px 0 0' }}>Assigned to: {fu.assigned_to_name}</p>}
                  {fu.remarks && <p style={{ fontSize: 12, color: '#3A3A5C', margin: '6px 0 0', fontStyle: 'italic' }}>“{fu.remarks}”</p>}
                </div>
                {fu.status === 'pending' && (
                  <button onClick={() => markDone(fu.id)}
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 8,
                      border: '1.5px solid #2E7D32', color: '#2E7D32', background: '#fff', cursor: 'pointer' }}>
                    Mark Done
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  return <FollowUpsContent />;
}
