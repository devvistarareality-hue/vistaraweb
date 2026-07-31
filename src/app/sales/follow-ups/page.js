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

// Lead-status options a follow-up can set when completed, by the follow-up's role.
// Telecaller updates TC Status; STM updates STM Status (a manager completing either
// writes the matching field). Marking a TC lead "warm" auto-transfers it to the STM.
const TC_STATUS_OPTS  = [['warm', 'Warm'], ['cold', 'Cold'], ['not_interested', 'Not Interested'], ['not_reachable', 'Not Reachable'], ['callback', 'Callback']];
const STM_STATUS_OPTS = [['hot', 'Hot'], ['warm', 'Warm'], ['cold', 'Cold'], ['not_interested', 'Not Interested'], ['sv_scheduled', 'SV Scheduled'], ['sv_done', 'SV Done'], ['closed', 'Closed']];

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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  // Completion modal: capture remarks + optionally schedule the next follow-up.
  const [done,    setDone]    = useState(null);   // the follow-up being completed
  const [outcome, setOutcome] = useState('');
  const [schedNext, setSchedNext] = useState(false);
  const [nextAt,  setNextAt]  = useState('');
  const [nextRemarks, setNextRemarks] = useState('');
  const [newStatus, setNewStatus] = useState('');   // optional lead status to set on completion
  const [submitting, setSubmitting] = useState(false);

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

  function openDone(fu) {
    // Pre-select the lead's current TC/STM status so the caller sees where it stands.
    const cur = (fu.role_context === 'stm' ? fu.lead_stm_status : fu.lead_telecaller_status) || '';
    setDone(fu); setOutcome(''); setSchedNext(false); setNextAt(''); setNextRemarks(''); setNewStatus(cur);
  }

  async function completeFollowUp() {
    if (!done) return;
    if (schedNext && !nextAt) { return; }
    setSubmitting(true);
    try {
      // Mark this follow-up completed, saving the outcome remarks.
      const res = await fetch(SALES_ENDPOINTS.followUp(done.id), {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString(), outcome: outcome.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((list) => list.map((f) => (f.id === done.id ? updated : f)));
      }
      // Update the lead's status (TC or STM, per the follow-up's role) — only if changed.
      const origStatus = (done.role_context === 'stm' ? done.lead_stm_status : done.lead_telecaller_status) || '';
      if (newStatus && newStatus !== origStatus && done.lead) {
        const field = done.role_context === 'stm' ? 'stm_status' : 'telecaller_status';
        await fetch(SALES_ENDPOINTS.lead(done.lead), {
          method: 'PATCH', headers: authHeaders(),
          body: JSON.stringify({ [field]: newStatus }),
        });
      }
      // Optionally schedule the next follow-up on the same lead / assignee / role.
      if (schedNext && nextAt) {
        const r2 = await fetch(SALES_ENDPOINTS.followUps, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({
            lead: done.lead, assigned_to: done.assigned_to, role_context: done.role_context,
            scheduled_at: new Date(nextAt).toISOString(), remarks: nextRemarks.trim(), status: 'pending',
          }),
        });
        if (r2.ok) { const created = await r2.json(); setItems((list) => [...list, created]); }
      }
      setDone(null);
      load();
    } catch (_) {}
    setSubmitting(false);
  }

  const now = new Date();
  // Date-range filter on the scheduled date (applies before the tab filter).
  const inDateRange = (fu) => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(fu.scheduled_at);
    if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo   && d > new Date(dateTo   + 'T23:59:59')) return false;
    return true;
  };
  const dateItems = items.filter(inDateRange);

  // Status-wise counts for the selected date range (independent of the tab).
  const counts = {
    total:     dateItems.length,
    pending:   dateItems.filter((f) => f.status === 'pending').length,
    completed: dateItems.filter((f) => f.status === 'completed').length,
    overdue:   dateItems.filter((f) => f.status === 'pending' && new Date(f.scheduled_at) < now).length,
  };

  const visible = dateItems.filter((fu) => {
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

      {/* Date range filter + status-wise counts */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.6 }}>Date</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 9, border: '1.5px solid #E4E8F0', fontSize: 12.5, color: '#1A1A2E', outline: 'none' }} />
        <span style={{ color: '#B0BAC9' }}>→</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 9, border: '1.5px solid #E4E8F0', fontSize: 12.5, color: '#1A1A2E', outline: 'none' }} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid #E4E8F0', background: '#fff', color: '#6B7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {[
          { label: 'Total',     n: counts.total,     c: '#3D5AFE', bg: '#EEF2FF' },
          { label: 'Pending',   n: counts.pending,   c: '#B45309', bg: '#FEF3C7' },
          { label: 'Overdue',   n: counts.overdue,   c: '#DC2626', bg: '#FEE2E2' },
          { label: 'Completed', n: counts.completed, c: '#2E7D32', bg: '#E7F6EE' },
        ].map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 20, background: s.bg }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: s.c }}>{s.n}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: s.c, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</span>
          </div>
        ))}
      </div>

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
                  {fu.outcome && <p style={{ fontSize: 12, color: '#2E7D32', margin: '6px 0 0' }}><b>Remarks:</b> {fu.outcome}</p>}
                </div>
                {fu.status === 'pending' && (
                  <button onClick={() => openDone(fu)}
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

      {/* Complete follow-up: remarks + optional next follow-up */}
      {done && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,30,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => !submitting && setDone(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, padding: '22px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>Complete follow-up</div>
            <div style={{ fontSize: 12, color: '#8492A6', marginTop: 2, marginBottom: 16 }}>{done.lead_name} · {fmtDateTime(done.scheduled_at)}</div>

            {/* Update the lead's status after this call (TC or STM, per the follow-up's role). */}
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>
              {done.role_context === 'stm' ? 'Update STM Status' : 'Update TC Status'}
            </label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
              style={{ width: '100%', marginTop: 6, marginBottom: 4, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', cursor: 'pointer', background: '#fff' }}>
              <option value="">— No change —</option>
              {(done.role_context === 'stm' ? STM_STATUS_OPTS : TC_STATUS_OPTS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {newStatus === 'warm' && done.role_context !== 'stm' && (done.lead_telecaller_status || '') !== 'warm' && (
              <p style={{ fontSize: 11, color: '#B45309', margin: '2px 0 0' }}>Marking warm will transfer this lead to the STM pipeline.</p>
            )}

            <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', display: 'block', marginTop: 14 }}>Remarks</label>
            <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={3} placeholder="Outcome of this follow-up…"
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', outline: 'none' }} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, fontWeight: 600, color: '#1A1A2E', cursor: 'pointer' }}>
              <input type="checkbox" checked={schedNext} onChange={(e) => setSchedNext(e.target.checked)} style={{ accentColor: '#3D5AFE' }} />
              Schedule next follow-up
            </label>
            {schedNext && (
              <div style={{ marginTop: 12, paddingLeft: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Next follow-up date &amp; time</label>
                <input type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)}
                  style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', display: 'block', marginTop: 10 }}>Next follow-up note</label>
                <textarea value={nextRemarks} onChange={(e) => setNextRemarks(e.target.value)} rows={2} placeholder="What to discuss next…"
                  style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', outline: 'none' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setDone(null)} disabled={submitting} style={{ padding: '9px 18px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={completeFollowUp} disabled={submitting || (schedNext && !nextAt)}
                style={{ padding: '9px 20px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (submitting || (schedNext && !nextAt)) ? 0.6 : 1 }}>
                {submitting ? 'Saving…' : 'Mark Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  return <FollowUpsContent />;
}
