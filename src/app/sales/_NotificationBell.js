'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AUTH_ENDPOINTS, authHeaders } from '../../constants/api';

import Icon from '../../components/Icon';
// Where each notification type deep-links. booking_approved/rejected → the
// booker's My Bookings (Booking → My Bookings), not My Conversions.
const URL_FOR_TYPE = {
  new_lead: '/sales/leads',
  followup: '/sales/follow-ups',
  sv: '/sales/site-visits',
  sv_done: '/sales/site-visits',
  booking_approval: '/sales/bookings',
  booking_approved: '/sales/closure?view=mybookings',
  booking_rejected: '/sales/closure?view=mybookings',
  closure: '/sales/my-conversions',
  followup_overdue: '/sales/follow-ups',
  sv_overdue: '/sales/site-visits',
  availability_reminder: '/sales',
};


function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ICON = {
  new_lead: 'user', followup: 'phone', sv: 'pin', sv_done: 'check-circle',
  booking_approval: 'note', booking_approved: 'party', booking_rejected: 'ban',
  closure: 'trophy', overdue: 'clock', mark_available: 'dot', test: 'bell',
  followup_overdue: 'clock', sv_overdue: 'clock', availability_reminder: 'dot',
};
const TYPE_COLOR = {
  new_lead: '#23874A', followup: '#2F6DB5', sv: '#23874A', sv_done: '#23874A',
  booking_approval: '#A3671A', booking_approved: '#23874A', booking_rejected: '#D9434B',
  closure: '#2F6DB5', overdue: '#D9434B', mark_available: '#23874A', test: '#2F6DB5',
  followup_overdue: '#D9434B', sv_overdue: '#D9434B', availability_reminder: '#23874A',
};

export default function NotificationBell({ up = false, align = 'right' }) {
  const router = useRouter();
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
        style={{ position: 'relative', width: 38, height: 38, borderRadius: 14, border: '1.5px solid #ECEEF0', background: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: '36px' }}>
        <Icon name="bell" />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#D9434B', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', ...(up ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }), ...(align === 'left' ? { left: 0 } : { right: 0 }), width: 340, maxWidth: 'min(340px, calc(100vw - 24px))', background: '#fff', borderRadius: 16, border: '1px solid #ECEEF0', boxShadow: '0 12px 40px rgba(36,90,150,0.22)', zIndex: 1000, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #F4F5F7' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#1D1D1F' }}>Notifications</span>
            <button onClick={markAll} style={{ background: 'none', border: 'none', color: '#2F6DB5', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {rows.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#6E7278', fontSize: 13 }}>You're all caught up <Icon name="party" /></div>
            ) : rows.map((n) => {
              const url = URL_FOR_TYPE[n.type];
              const color = TYPE_COLOR[n.type] || '#2F6DB5';
              return (
              <div key={n.id} onClick={() => { if (url) { setOpen(false); router.push(url); } }}
                style={{ display: 'flex', gap: 11, padding: '12px 14px', borderBottom: '1px solid #F4F5F7', borderLeft: `3px solid ${n.is_read ? 'transparent' : color}`, background: n.is_read ? '#fff' : '#F3F9FF', cursor: url ? 'pointer' : 'default' }}>
                <span style={{ width: 34, height: 34, borderRadius: 17, background: color + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}><Icon name={ICON[n.type] || 'bell'} size={16} style={{ color }} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: '#55585E', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: '#9A9EA5', marginTop: 4 }}>{ago(n.created_at)}</div>
                </div>
                {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0, marginTop: 6 }} />}
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
