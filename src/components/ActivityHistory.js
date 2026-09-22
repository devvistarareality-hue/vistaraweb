'use client';
import { useEffect, useState } from 'react';
import { History, ChevronDown } from 'lucide-react';
import { ACTIVITY_ENDPOINTS } from '../constants/api';
import { apiFetch } from '../utils/apiFetch';

// Who did what to one record (a booking, an AR account…), newest first.
// Collapsed until opened, so a list of twenty bookings makes no requests.
export function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function actionTone(action) {
  if (/approv|done|recorded|imported/.test(action)) return 'ok';
  if (/reject|cancel|delet/.test(action)) return 'bad';
  if (/submit|creat/.test(action)) return 'info';
  return 'off';
}

export function ActivityRows({ rows, showModule = true }) {
  if (!rows.length) return <div className="act-empty">Nothing recorded yet.</div>;
  return (
    <ol className="act-list">
      {rows.map((r) => (
        <li key={r.id} className={`act-item act-${actionTone(r.action)}`}>
          <span className="act-dot" />
          <div className="act-body">
            <div className="act-summary">{r.summary}</div>
            <div className="act-meta">
              <b>{r.actor?.name || 'System'}</b>
              {showModule && r.module ? <span className="act-chip">{r.module}</span> : null}
              <span>{fmtWhen(r.at)}</span>
              {r.legacy ? <span className="act-faint">from the record</span> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function ActivityHistory({ targetType, targetId, companyId, title = 'History', defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !targetId) return undefined;
    let alive = true;
    const q = new URLSearchParams({ target_type: targetType, target_id: String(targetId) });
    if (companyId) q.set('company_id', companyId);
    setErr('');
    apiFetch(`${ACTIVITY_ENDPOINTS.log}?${q}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) { setErr(d.detail || 'Could not load the history.'); setRows([]); return; }
        setRows(d.results || []);
      })
      .catch(() => { if (alive) { setErr('Could not load the history.'); setRows([]); } });
    return () => { alive = false; };
  }, [open, targetType, targetId, companyId]);

  return (
    <div className="act-box">
      <button type="button" className={`act-toggle${open ? ' is-open' : ''}`} onClick={() => setOpen((v) => !v)}>
        <History size={14} /> {title} <ChevronDown size={14} className="act-caret" />
      </button>
      {open && (
        err ? <div className="nx-note bad">{err}</div>
          : rows === null ? <div className="act-empty">Loading…</div>
            : <ActivityRows rows={rows} />
      )}
    </div>
  );
}
