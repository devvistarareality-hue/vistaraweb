'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import Loader from '../../../components/Loader';
import MultiSelect from '../../../components/MultiSelect';
import { C1Modal, C1Section, C1Field } from '../_Form';


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
  // Scheme filter — the lead's scheme, as on the other Club 1000 screens.
  const [schemeSel, setSchemeSel] = useState([]);

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
  const schemeOptions = [...new Set(items.map((fu) => fu.lead_scheme_name).filter(Boolean))].sort();
  const visible = items.filter((fu) => {
    const at = new Date(fu.scheduled_at);
    if (schemeSel.length && !schemeSel.includes(fu.lead_scheme_name)) return false;
    if (filter === 'all')     return true;
    if (filter === 'pending') return fu.status === 'pending';
    if (filter === 'today')   return fu.status === 'pending' && at >= startOfToday() && at <= endOfToday();
    if (filter === 'overdue') return fu.status === 'pending' && at < now;
    return true;
  });

  return (
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Follow-Ups</h1>
          <p className="nx-page-sub">{visible.length} follow-up{visible.length === 1 ? '' : 's'}{user?.name ? ` · ${user.name}` : ''}</p>
        </div>
        <div className="ard-filters">
          {schemeOptions.length > 1 && (
            <MultiSelect allLabel="All Schemes" noun="schemes" value={schemeSel} onChange={setSchemeSel}
              options={schemeOptions.map((n) => ({ value: n, label: n }))} />
          )}
        </div>
      </div>

      <div className="nx-filters col-tabs">
        {TABS.map((t) => (
          <button type="button" key={t.key} className={`nx-btn nx-btn-md nx-toggle${filter === t.key ? ' is-on' : ''}`} onClick={() => setFilter(t.key)}>{t.label}</button>
        ))}
      </div>

      {loading ? <Loader label="Loading…" /> : visible.length === 0 ? (
        <div className="nx-card ar-card"><div className="ar-empty">No follow-ups here. Schedule one from a lead's details.</div></div>
      ) : (
        <div className="coll-grid">
          {visible.map((fu) => {
            const overdue = fu.status === 'pending' && new Date(fu.scheduled_at) < now;
            return (
              <article key={fu.id} className={`nx-card coll-card${overdue ? ' is-late' : ''}`}>
                <header className="coll-head">
                  <div className="coll-who">
                    <h3>{fu.lead_name || 'Lead'}</h3>
                    <div className="coll-meta">
                      {fu.lead_scheme_name ? <span className="coll-chip">{fu.lead_scheme_name}</span> : null}
                      {fu.assigned_to_name ? <span className="coll-chip">{fu.assigned_to_name}</span> : null}
                    </div>
                  </div>
                  <span className={`coll-age ${overdue ? 'bad' : fu.status === 'pending' ? 'info' : 'warn'}`}><b className="c1f-when">{fmtDateTime(fu.scheduled_at)}</b><span>{overdue ? 'overdue' : fu.status}</span></span>
                </header>
                {(fu.remarks || fu.outcome) && (
                  <div className="c1f-notes">
                    {fu.remarks && <p className="coll-outcome">“{fu.remarks}”</p>}
                    {fu.outcome && <p className="coll-promise">Outcome: {fu.outcome}</p>}
                  </div>
                )}
                {fu.status === 'pending' && (
                  <footer className="coll-foot">
                    <div className="coll-actions">
                      <button type="button" className="nx-btn nx-btn-sm nx-btn-primary" onClick={() => openDone(fu)}>Mark Done</button>
                    </div>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Complete follow-up: lead status + remarks + optional next follow-up */}
      {done && (
        <C1Modal title="Complete follow-up" sub={`${done.lead_name} · ${fmtDateTime(done.scheduled_at)}`} onClose={() => !submitting && setDone(null)}
          footer={<>
            <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setDone(null)} disabled={submitting}>Cancel</button>
            <button type="button" className="nx-btn nx-btn-md nx-btn-success" onClick={completeFollowUp} disabled={submitting || (schedNext && !isTerminal && !nextAt)}>{submitting ? 'Saving…' : 'Mark Done'}</button>
          </>}>
          <C1Section title="Outcome">
            <C1Field label="Lead status">
              <select className="nx-input" value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)}>
                {STATUS_OPTIONS.map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
              </select>
            </C1Field>
            <C1Field label="Remarks">
              <textarea className="nx-input c1-textarea" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Outcome of this follow-up…" />
            </C1Field>
          </C1Section>
          {!isTerminal && (
            <C1Section title="Next follow-up">
              <C1Field label="Schedule next">
                <label className="c1s-opt"><input type="checkbox" checked={schedNext} onChange={(e) => setSchedNext(e.target.checked)} /> Book the next call</label>
              </C1Field>
              {schedNext && (
                <C1Field label="Date & time" required>
                  <input className="nx-input" type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
                </C1Field>
              )}
            </C1Section>
          )}
        </C1Modal>
      )}
    </div>
  );
}
