'use client';
import { useSelector } from 'react-redux';
import { can } from '../../../lib/moduleAccess';
import { useEffect, useState } from 'react';
import { Phone, MessageCircle, MapPin, Mail, CircleDot, CalendarClock, CheckCircle2, X } from 'lucide-react';
import { AR_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { notify } from '../../../lib/notify';
import { rupee } from './_ar';
import { fmtWhen } from '../../../components/ActivityHistory';

export const CHANNELS = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'visit', label: 'Visit', icon: MapPin },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'other', label: 'Other', icon: CircleDot },
];
const ICON = Object.fromEntries(CHANNELS.map((c) => [c.value, c.icon]));

// Local "YYYY-MM-DDTHH:MM" for a datetime-local input, `days` from now at `hour`.
export function localAt(days = 1, hour = 11) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const blankNew = (me) => ({ scheduled_at: localAt(1), channel: 'call', note: '', assigned_to: me ? String(me) : '' });

// One account's follow-ups: what is scheduled, what was said last time, and the
// forms to book the next one or close the open one.
export default function FollowUpModal({ row, companyId, me, onClose, onChanged }) {
  // Reading the history is fine without the capability; booking, closing or
  // cancelling a follow-up is not (Designation Master → Permissions).
  const user = useSelector((s) => s.auth.user);
  const mayManage = can(user, 'ar.followup.manage');
  const [items, setItems] = useState(null);
  const [people, setPeople] = useState([]);
  const [draft, setDraft] = useState(() => blankNew(me));
  const [closing, setClosing] = useState(null);   // { id, outcome, promised_amount, promised_on, next_at }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cq = companyId ? `?company_id=${companyId}` : '';

  async function load() {
    const r = await apiFetch(AR_ENDPOINTS.followUps(row.id) + cq);
    const d = await r.json().catch(() => ({}));
    setItems(r.ok ? d.results || [] : []);
    if (!r.ok) setErr(d.detail || 'Could not load follow-ups.');
  }

  useEffect(() => {
    load();
    apiFetch(AR_ENDPOINTS.assignees + cq).then((r) => r.json()).then((d) => setPeople(d.results || [])).catch(() => {});
  }, [row.id]);

  async function send(url, method, body, okMsg) {
    setBusy(true); setErr('');
    try {
      const r = await apiFetch(url + cq, { method, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.detail || 'Could not save.'); return false; }
      notify(okMsg, 'success');
      await load();
      onChanged?.();
      return true;
    } catch {
      setErr('Could not save. Check your connection.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function schedule() {
    if (await send(AR_ENDPOINTS.followUps(row.id), 'POST', { ...draft, assigned_to: draft.assigned_to || undefined }, 'Follow-up scheduled')) {
      setDraft(blankNew(me));
    }
  }

  async function close() {
    const body = { status: 'done', outcome: closing.outcome, promised_amount: closing.promised_amount || null,
      promised_on: closing.promised_on || null, next_at: closing.next_at || null };
    if (await send(AR_ENDPOINTS.followUp(closing.id), 'PATCH', body, 'Follow-up closed')) setClosing(null);
  }

  const cancel = (f) => send(AR_ENDPOINTS.followUp(f.id), 'PATCH', { status: 'cancelled' }, 'Follow-up cancelled');
  const pending = (items || []).filter((f) => f.status === 'pending');
  const past = (items || []).filter((f) => f.status !== 'pending');

  return (
    <div className="ar-backdrop" onClick={() => !busy && onClose()}>
      <div className="nx-card nx-modal ar-modal fu-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fu-head">
          <div>
            <div className="ar-modal-title">Follow-ups · {row.client_name || '—'}</div>
            <div className="ar-modal-sub">
              {row.project} · Plot {row.plots}{row.phone ? ` · ${row.phone}` : ''}
              {row.overdue > 0 ? ` · Overdue ${rupee(row.overdue)}` : ''}
              {row.next_due ? ` · Next ${rupee(row.next_due.amount)} on ${row.next_due.date.split('-').reverse().join('/')}` : ''}
            </div>
          </div>
          <button type="button" className="fu-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {err && <div className="nx-note bad">{err}</div>}

        {items === null ? <div className="act-empty">Loading…</div> : (
          <>
            {pending.length > 0 && <div className="fu-section">Scheduled</div>}
            {pending.map((f) => {
              const Icon = ICON[f.channel] || CircleDot;
              return (
                <div key={f.id} className={`fu-item${f.is_overdue ? ' is-late' : ''}`}>
                  <span className="fu-icon"><Icon size={15} /></span>
                  <div className="fu-body">
                    <div className="fu-title">{f.channel_label} · {fmtWhen(f.scheduled_at)}{f.is_overdue ? <span className="nx-status bad">Overdue</span> : null}</div>
                    {f.note && <div className="fu-text">{f.note}</div>}
                    <div className="fu-meta">Assigned to {f.assigned_to?.name || '—'} · by {f.created_by || '—'}</div>
                    {closing?.id === f.id ? (
                      <div className="fu-close">
                        <textarea className="nx-input" rows={2} placeholder="What happened? e.g. Customer will pay inst 3 on Friday"
                          value={closing.outcome} onChange={(e) => setClosing({ ...closing, outcome: e.target.value })} />
                        <div className="fu-row">
                          <label>Promised ₹<input className="nx-input nx-input-sm" type="number" min="0" value={closing.promised_amount} onChange={(e) => setClosing({ ...closing, promised_amount: e.target.value })} /></label>
                          <label>By<input className="nx-input nx-input-sm" type="date" value={closing.promised_on} onChange={(e) => setClosing({ ...closing, promised_on: e.target.value })} /></label>
                          <label>Next follow-up<input className="nx-input nx-input-sm" type="datetime-local" value={closing.next_at} onChange={(e) => setClosing({ ...closing, next_at: e.target.value })} /></label>
                        </div>
                        <div className="fu-actions">
                          <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setClosing(null)} disabled={busy}>Back</button>
                          <button type="button" className="nx-btn nx-btn-sm nx-btn-success" onClick={close} disabled={busy || !closing.outcome.trim()}>{busy ? 'Saving…' : 'Mark done'}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="fu-actions">
                        {mayManage && <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => cancel(f)} disabled={busy}>Cancel</button>}
                        {mayManage && <button type="button" className="nx-btn nx-btn-sm nx-btn-primary" disabled={busy}
                          onClick={() => setClosing({ id: f.id, outcome: '', promised_amount: '', promised_on: '', next_at: '' })}>
                          <CheckCircle2 size={14} /> Log outcome
                        </button>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {mayManage && <div className="fu-section">New follow-up</div>}
            {mayManage && <div className="fu-new">
              <div className="fu-chips">
                {CHANNELS.map((c) => (
                  <button type="button" key={c.value} className={`nx-btn nx-btn-sm nx-toggle${draft.channel === c.value ? ' is-on' : ''}`}
                    onClick={() => setDraft({ ...draft, channel: c.value })}><c.icon size={13} /> {c.label}</button>
                ))}
              </div>
              <div className="fu-row">
                <label>When<input className="nx-input nx-input-sm" type="datetime-local" value={draft.scheduled_at} onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value })} /></label>
                <label>Assign to
                  <select className="nx-input nx-input-sm" value={draft.assigned_to} onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value })}>
                    {people.map((p) => <option key={p.id} value={String(p.id)}>{p.name}{String(p.id) === String(me) ? ' (me)' : ''}</option>)}
                  </select>
                </label>
              </div>
              <input className="nx-input" placeholder="Note — e.g. Remind about inst 2 and interest" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              <div className="fu-actions">
                <button type="button" className="nx-btn nx-btn-md nx-btn-primary" onClick={schedule} disabled={busy || !draft.scheduled_at}>
                  <CalendarClock size={15} /> {busy ? 'Saving…' : 'Schedule'}
                </button>
              </div>
            </div>}

            {past.length > 0 && <div className="fu-section">History</div>}
            {past.map((f) => {
              const Icon = ICON[f.channel] || CircleDot;
              return (
                <div key={f.id} className={`fu-item is-${f.status}`}>
                  <span className="fu-icon"><Icon size={15} /></span>
                  <div className="fu-body">
                    <div className="fu-title">{f.channel_label} · {fmtWhen(f.done_at || f.scheduled_at)}
                      <span className={`nx-status ${f.status === 'done' ? 'ok' : 'off'}`}>{f.status === 'done' ? 'Done' : 'Cancelled'}</span></div>
                    {f.outcome && <div className="fu-text">{f.outcome}</div>}
                    {f.promised_amount != null && (
                      <div className="fu-promise">Promised {rupee(f.promised_amount)}{f.promised_on ? ` by ${f.promised_on.split('-').reverse().join('/')}` : ''}</div>
                    )}
                    <div className="fu-meta">{f.done_by ? `By ${f.done_by}` : `Scheduled by ${f.created_by || '—'}`}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
