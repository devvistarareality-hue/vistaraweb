'use client';
import { useEffect, useState } from 'react';
import { SALES_ENDPOINTS, authHeaders } from '../constants/api';
import Icon from './Icon';
import Loader from './Loader';

// A lead's timeline — status changes, assignments, visits, closures and its
// follow-ups (scheduled / done / missed) — for screens that are not the lead
// modal itself, e.g. the Follow-ups "Complete follow-up" dialog. Mirrored in the
// app at Vistarafront/src/components/LeadHistory.js.
const LABEL = {
  created: 'Lead Created', status: 'Overall Status', telecaller_status: 'TC Status', stm_status: 'STM Status',
  telecaller_remarks: 'TC Remarks', stm_remarks: 'STM Remarks', telecaller: 'Telecaller Assigned',
  stm: 'STM Assigned', warm_transfer: 'Transferred to STM', site_visit: 'Site Visit', closure: 'Closure',
  follow_up: 'Follow-up Scheduled', follow_up_done: 'Follow-up Done', follow_up_missed: 'Follow-up Missed',
  re_enquiry: 'Enquired Again',
};
const TONE = {
  status: 'accent', telecaller_status: 'success', stm_status: 'warn', telecaller_remarks: 'success',
  stm_remarks: 'warn', telecaller: 'accent', stm: 'success', warm_transfer: 'danger', site_visit: 'warn',
  closure: 'success', follow_up: 'accent', follow_up_done: 'success', follow_up_missed: 'danger', re_enquiry: 'warn',
};
const icon = (f) => (f === 'warm_transfer' ? 'flame' : f === 'telecaller' ? 'user' : f === 'stm' ? 'building'
  : f === 'site_visit' ? 'home' : f === 'closure' ? 'check-circle' : f.startsWith('follow_up') ? 'calendar'
    : f.includes('remarks') ? 'note' : f.includes('status') ? 'refresh' : 'pencil');
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '');

export default function LeadHistory({ leadId }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    setRows(null); setErr('');
    fetch(SALES_ENDPOINTS.lead(leadId), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load the history.'))))
      .then((d) => { if (alive) setRows((d.history || []).filter((h) => h.field_changed !== 'created').reverse()); })
      .catch((e) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [leadId]);

  if (err) return <p className="lh-empty">{err}</p>;
  if (!rows) return <Loader variant="inline" size="sm" label="Loading…" />;
  if (!rows.length) return <p className="lh-empty">No history yet.</p>;
  return (
    <div className="lh-list">
      {rows.map((h) => {
        const f = h.field_changed;
        const single = ['warm_transfer', 'closure', 'telecaller_remarks', 'stm_remarks'].includes(f) || !h.old_value;
        const text = (f.includes('remarks') ? h.remarks : null) || h.new_value || '—';
        const by = h.changed_by_name || (['telecaller', 'stm'].includes(f) ? 'System (auto)' : null);
        return (
          <div key={h.id} className={`lh-row lh-${TONE[f] || 'muted'}`}>
            <span className="lh-dot"><Icon name={icon(f)} size={14} /></span>
            <div className="lh-body">
              <div className="lh-title">{LABEL[f] || f}</div>
              <div className="lh-value">
                {single ? <b>{text}</b> : <><span className="lh-old">{h.old_value}</span> → <b>{h.new_value || '—'}</b></>}
              </div>
              <div className="lh-meta">{by ? `by ${by} · ` : ''}{fmt(h.created_at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
