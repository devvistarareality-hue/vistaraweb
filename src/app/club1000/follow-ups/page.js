'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';

const TEAL = '#00838F';

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in LOCAL time.
function toDatetimeLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const endOfToday   = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };

const fuStatusColor = { pending: '#F9A825', completed: '#2E7D32', missed: '#B71C1C', rescheduled: '#0097A7' };
const STATUS_OPTIONS = ['new', 'contacted', 'interested', 'not_interested', 'converted', 'lost'];
// A lead in one of these has nothing left to follow up on — matches the backend's
// terminal-status handling in LeadDetailView.patch (clears next_follow_up_date).
const TERMINAL_STATUSES = ['not_interested', 'lost', 'converted'];

const TABS = [
  { key: 'today',   label: "Today's" },
  { key: 'overdue', label: 'Overdue' },
  { key: 'pending', label: 'All Pending' },
  { key: 'all',     label: 'All' },
];

export default function Club1000FollowUpsPage() {
  const user = useSelector((s) => s.auth.user);
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('today');

  // Completion modal: capture the lead's new status + remarks, and optionally
  // schedule the next follow-up — mirrors sales' Follow-Ups completion flow,
  // plus the lead-status update Club 1000 additionally asks for.
  const [done,        setDone]        = useState(null); // the follow-up being completed
  const [leadStatus,  setLeadStatus]  = useState('new');
  const [outcome,     setOutcome]     = useState('');
  const [schedNext,   setSchedNext]   = useState(false);
  const [nextAt,      setNextAt]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.followUps);
      if (res.ok) setItems(await res.json());
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openDone(fu) {
    setDone(fu);
    setLeadStatus(fu.lead_status || 'new');
    setOutcome('');
    setSchedNext(false);
    const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
    setNextAt(toDatetimeLocal(d));
  }

  const isTerminal = TERMINAL_STATUSES.includes(leadStatus);

  async function completeFollowUp() {
    if (!done) return;
    if (schedNext && !isTerminal && !nextAt) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.followUp(done.id), {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString(), outcome: outcome.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((list) => list.map((f) => (f.id === done.id ? updated : f)));
      }
      // Update the lead's status regardless of whether it changed.
      await apiFetch(CLUB1000_ENDPOINTS.lead(done.lead), {
        method: 'PATCH',
        body: JSON.stringify({ status: leadStatus }),
      });
      // Optionally schedule the next follow-up — only makes sense if the lead
      // isn't in a terminal status (nothing left to follow up on there).
      if (schedNext && !isTerminal && nextAt) {
        const r2 = await apiFetch(CLUB1000_ENDPOINTS.followUps, {
          method: 'POST',
          body: JSON.stringify({ lead: done.lead, scheduled_at: new Date(nextAt).toISOString() }),
        });
        if (r2.ok) { const created = await r2.json(); setItems((list) => [...list, created]); }
      }
      setDone(null);
      load();
    } catch (_) {}
    setSubmitting(false);
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
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E', margin: 0 }}>Follow-Ups</h1>
      <p style={{ fontSize: 13, color: '#8492A6', margin: '4px 0 18px' }}>
        {visible.length} item{visible.length === 1 ? '' : 's'} · {user?.name || ''}
      </p>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E4E8F0', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'none', border: 'none', whiteSpace: 'nowrap',
                color: active ? TEAL : '#8492A6',
                borderBottom: active ? `2px solid ${TEAL}` : '2px solid transparent',
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
          <p style={{ fontSize: 13, color: '#B0BAC9', margin: '4px 0 0' }}>Schedule follow-ups from a lead's details</p>
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
                  {fu.remarks && <p style={{ fontSize: 12, color: '#3A3A5C', margin: '6px 0 0', fontStyle: 'italic' }}>"{fu.remarks}"</p>}
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

      {/* Complete follow-up: lead status + remarks + optional next follow-up */}
      {done && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,30,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => !submitting && setDone(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, padding: '22px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>Complete follow-up</div>
            <div style={{ fontSize: 12, color: '#8492A6', marginTop: 2, marginBottom: 16 }}>{done.lead_name} · {fmtDateTime(done.scheduled_at)}</div>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Lead Status</label>
            <select value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)}
              style={{ width: '100%', height: 38, marginTop: 6, borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none', padding: '0 10px' }}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>

            <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', display: 'block', marginTop: 14 }}>Remarks</label>
            <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={3} placeholder="Outcome of this follow-up…"
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', outline: 'none' }} />

            {!isTerminal && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, fontWeight: 600, color: '#1A1A2E', cursor: 'pointer' }}>
                  <input type="checkbox" checked={schedNext} onChange={(e) => setSchedNext(e.target.checked)} style={{ accentColor: TEAL }} />
                  Schedule next follow-up
                </label>
                {schedNext && (
                  <div style={{ marginTop: 12, paddingLeft: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Next follow-up date &amp; time</label>
                    <input type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)}
                      style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setDone(null)} disabled={submitting} style={{ padding: '9px 18px', background: '#F3F4F6', color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={completeFollowUp} disabled={submitting || (schedNext && !isTerminal && !nextAt)}
                style={{ padding: '9px 20px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (submitting || (schedNext && !isTerminal && !nextAt)) ? 0.6 : 1 }}>
                {submitting ? 'Saving…' : 'Mark Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
