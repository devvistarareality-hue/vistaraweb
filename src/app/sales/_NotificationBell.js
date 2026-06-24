'use client';
import { useEffect, useRef, useState } from 'react';
import { AUTH_ENDPOINTS } from '../../constants/api';

function authHeaders() {
  const t = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` };
}

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ICON = {
  new_lead: '👤', followup: '📞', sv: '📍', sv_done: '✅',
  booking_approval: '📝', booking_approved: '🎉', booking_rejected: '⛔',
  closure: '🏆', overdue: '⏰', mark_available: '🟢', test: '🔔',
};

export default function NotificationBell({ up = false, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  async function load() {
    try {
      const r = await fetch(AUTH_ENDPOINTS.notifications, { headers: authHeaders() });
      if (!r.ok) return;
      const d = await r.json();
      setRows(Array.isArray(d.results) ? d.results : []);
      setUnread(d.unread || 0);
    } catch (_) {}
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);          // poll every 30s
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function markAll() {
    setUnread(0); setRows((s) => s.map((n) => ({ ...n, is_read: true })));
    try { await fetch(AUTH_ENDPOINTS.notificationsReadAll, { method: 'POST', headers: authHeaders() }); } catch (_) {}
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { setOpen((o) => !o); if (!open && unread) markAll(); }}
        aria-label="Notifications"
        style={{ position: 'relative', width: 38, height: 38, borderRadius: 10, border: '1.5px solid #E4E8F0', background: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: '36px' }}>
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', ...(up ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }), ...(align === 'left' ? { left: 0 } : { right: 0 }), width: 340, maxWidth: 'min(340px, calc(100vw - 24px))', background: '#fff', borderRadius: 12, border: '1px solid #E4E8F0', boxShadow: '0 12px 40px rgba(60,80,120,0.22)', zIndex: 1000, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #F0F3FA' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1A2E' }}>Notifications</span>
            <button onClick={markAll} style={{ background: 'none', border: 'none', color: '#3D5AFE', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {rows.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#8492A6', fontSize: 13 }}>You're all caught up 🎉</div>
            ) : rows.map((n) => (
              <div key={n.id} style={{ display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid #F5F7FB', background: n.is_read ? '#fff' : '#F3F6FF' }}>
                <span style={{ fontSize: 18, lineHeight: '20px' }}>{ICON[n.type] || '🔔'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: '#5B6B82', marginTop: 2 }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{ago(n.created_at)}</div>
                </div>
                {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: 4, background: '#3D5AFE', flexShrink: 0, marginTop: 6 }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
