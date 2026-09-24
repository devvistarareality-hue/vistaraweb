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
  booking_submitted: '/sales/closure?view=mybookings',
  booking_update: '/sales/bookings',
  booking_cancelled: '/sales/bookings',
  accounts_booking_approved: '/sales/closure?view=mybookings',
  accounts_booking_rejected: '/sales/closure?view=mybookings',
  accounts_booking_approval: '/m/accounts/approvals',
  accounts_booking_update: '/m/accounts/approvals',
  accounts_booking_cancelled: '/m/accounts/bookings',
  ar_followup_assigned: '/m/ar/collections?tab=followups',
  ar_followup_due: '/m/ar/collections?tab=followups',
  ar_followup_overdue: '/m/ar/collections?tab=followups',
  ar_collections_digest: '/m/ar/collections',
  ar_due_soon: '/m/ar/collections?tab=upcoming',
  lead_transfer_requested: '/sales/bookings',
  lead_transfer_approved: '/sales/leads',
  lead_transfer_rejected: '/sales/leads',
  closure: '/sales/closure?view=mybookings&status=sold',
  followup_overdue: '/sales/follow-ups',
  sv_overdue: '/sales/site-visits',
  availability_reminder: '/sales',
  task_assigned: '/m/execution/list?my_tasks=true',
  task_comment: '/m/execution/list?my_tasks=true',
  task_due_soon: '/m/execution/list?my_tasks=true',
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
  booking_submitted: 'note', booking_update: 'note', booking_cancelled: 'ban',
  accounts_booking_approval: 'note', accounts_booking_update: 'note', accounts_booking_cancelled: 'ban',
  accounts_booking_approved: 'party', accounts_booking_rejected: 'ban',
  ar_followup_assigned: 'phone', ar_followup_due: 'phone', ar_followup_overdue: 'clock', ar_collections_digest: 'chart', ar_due_soon: 'clock',
  lead_transfer_requested: 'user', lead_transfer_approved: 'user', lead_transfer_rejected: 'user',
  closure: 'trophy', overdue: 'clock', mark_available: 'dot', test: 'bell',
  followup_overdue: 'clock', sv_overdue: 'clock', availability_reminder: 'dot',
  task_assigned: 'note', task_comment: 'phone', task_due_soon: 'clock',
};
const TYPE_COLOR = {
  new_lead: 'var(--success)', followup: 'var(--accent)', sv: 'var(--success)', sv_done: 'var(--success)',
  booking_approval: 'var(--warning)', booking_approved: 'var(--success)', booking_rejected: 'var(--danger)',
  booking_submitted: 'var(--accent)', booking_update: 'var(--accent)', booking_cancelled: 'var(--danger)',
  accounts_booking_approval: 'var(--warning)', accounts_booking_update: 'var(--accent)', accounts_booking_cancelled: 'var(--danger)',
  accounts_booking_approved: 'var(--success)', accounts_booking_rejected: 'var(--danger)',
  ar_followup_assigned: 'var(--accent)', ar_followup_due: 'var(--warning)', ar_followup_overdue: 'var(--danger)', ar_collections_digest: 'var(--accent)', ar_due_soon: 'var(--warning)',
  lead_transfer_requested: 'var(--warning)', lead_transfer_approved: 'var(--success)', lead_transfer_rejected: 'var(--danger)',
  closure: 'var(--accent)', overdue: 'var(--danger)', mark_available: 'var(--success)', test: 'var(--accent)',
  followup_overdue: 'var(--danger)', sv_overdue: 'var(--danger)', availability_reminder: 'var(--success)',
  task_assigned: 'var(--accent)', task_comment: 'var(--accent)', task_due_soon: 'var(--warning)',
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
      <button className="nx-btn nx-btn-lg nx-btn-secondary" onClick={() => { setOpen((o) => !o); if (!open && unread) markAll(); }}
        aria-label="Notifications"
        style={{ position: 'relative', width: 38, height: 38, borderRadius: 14, border: '1.5px solid var(--surface-3)', background: 'var(--surface)', cursor: 'pointer', fontSize: 18, lineHeight: '36px' }}>
        <Icon name="bell" />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--danger-solid)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="nx-popover" style={{ position: 'absolute', ...(up ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }), ...(align === 'left' ? { left: 0 } : { right: 0 }), width: 340, maxWidth: 'min(340px, calc(100vw - 24px))', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--surface-3)', boxShadow: '0 12px 40px rgba(36,90,150,0.22)', zIndex: 1000, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--surface-2)' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Notifications</span>
            <button className="nx-btn nx-btn-sm nx-btn-link" onClick={markAll} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {rows.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>You're all caught up <Icon name="party" /></div>
            ) : rows.map((n) => {
              const url = URL_FOR_TYPE[n.type];
              const color = TYPE_COLOR[n.type] || 'var(--accent)';
              return (
              <div key={n.id} onClick={() => { if (url) { setOpen(false); router.push(url); } }}
                style={{ display: 'flex', gap: 11, padding: '12px 14px', borderBottom: '1px solid var(--surface-2)', borderLeft: `3px solid ${n.is_read ? 'transparent' : color}`, background: n.is_read ? 'var(--surface)' : 'var(--accent-softer)', cursor: url ? 'pointer' : 'default' }}>
                <span style={{ width: 34, height: 34, borderRadius: 17, background: `color-mix(in srgb, ${color} 10%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}><Icon name={ICON[n.type] || 'bell'} size={16} style={{ color }} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{ago(n.created_at)}</div>
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
