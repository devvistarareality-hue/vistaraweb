'use client';
/**
 * Follow-ups and site visits with a channel partner themselves.
 *
 * The CP module already tracks both of these against a partner's *leads*. This
 * is the partner side of the relationship: ringing them to stay in touch, and
 * driving them out to a project. Any number of each, over and over — a partner
 * is a continuing relationship, which is also why there is deliberately no
 * hot/warm/cold here. That judgement belongs to a lead being qualified, not to
 * someone you will be selling through for years.
 *
 * Two shapes are exported from one file because they render the same rows:
 *   PartnerActivityModal — one partner's history, opened from CP Details.
 *   PartnerActivitySection — the whole company's, for the module's own screens.
 *
 * Deliberately NOT folded into the shared Sales FollowUpsContent/SiteVisits
 * components: those are driven by `lead` and are reused by the Sales module, so
 * threading a second, lead-less record type through them would put partner rows
 * one bug away from appearing on Sales screens that should never show them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import Icon from '../../../components/Icon';
import Loader from '../../../components/Loader';
import { confirmDialog, notify } from '../../../lib/notify';
import PartnerPicker from '../../sales/_PartnerPicker';
import DateFilter from '../../sales/_DateFilter';
import MultiSelect from '../../../components/MultiSelect';

// These are the model's own choice lists (FOLLOWUP_STATUS and SV_STATUS in
// backend/sales/models.py), not a parallel set — the two lists genuinely differ,
// and a status that is not in them comes back as a 400.
const FU_STATUS = {
  pending:     { label: 'Pending',     cls: 'cpa-chip-warn' },
  completed:   { label: 'Completed',   cls: 'cpa-chip-ok' },
  missed:      { label: 'Missed',      cls: 'cpa-chip-bad' },
  rescheduled: { label: 'Rescheduled', cls: 'cpa-chip-mute' },
};
const SV_STATUS = {
  scheduled: { label: 'Scheduled', cls: 'cpa-chip-info' },
  completed: { label: 'Completed', cls: 'cpa-chip-ok' },
  cancelled: { label: 'Cancelled', cls: 'cpa-chip-mute' },
  no_show:   { label: 'No Show',   cls: 'cpa-chip-bad' },
};
// What counts as "still owed" differs between the two, so the open state is
// named once here rather than hard-coded as 'pending' at each use.
const OPEN_STATUS = { fu: 'pending', sv: 'scheduled' };
// The second action on an open row: a call that did not happen was missed, a
// visit that will not happen is cancelled.
const DROP_STATUS = { fu: ['missed', 'Missed'], sv: ['cancelled', 'Cancel'] };

function StatusChip({ map, value }) {
  const s = map[value] || { label: value || '—', cls: 'cpa-chip-mute' };
  return <span className={`nx-badge cpa-chip ${s.cls}`}>{s.label}</span>;
}

function fmt(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Default a new one to an hour from now, as a local-time string.
// <input type="datetime-local"> reads local time while toISOString() writes UTC,
// so the offset has to come back out or every default lands hours off in IST.
function inAnHourLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60 - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function isOverdue(kind, row) {
  return row.status === OPEN_STATUS[kind] && row.scheduled_at
    && new Date(row.scheduled_at) < new Date();
}

/* ------------------------------------------------------------------ data */

function useActivity({ kind, partnerId, companyId, enabled = true }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(enabled);

  const list = kind === 'fu' ? SALES_ENDPOINTS.partnerFollowUps : SALES_ENDPOINTS.partnerSiteVisits;

  const load = useCallback(() => {
    if (!enabled) return;
    const q = [partnerId ? `channel_partner_id=${partnerId}` : '',
               companyId ? `company_id=${companyId}` : ''].filter(Boolean).join('&');
    setLoading(true);
    fetch(list(q ? `?${q}` : ''), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setRows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [kind, partnerId, companyId, enabled]);

  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load };
}

/* ------------------------------------------------------------------ forms */

function ScheduleFollowUp({ partnerId, partners, onDone, onCancel }) {
  // On a partner's own page the partner is already known; on the module screen
  // it has to be chosen, out of a directory running to hundreds.
  const [who, setWho] = useState('');
  const target = partnerId || who;
  const [when, setWhen] = useState(inAnHourLocal());
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!target) { setErr('Pick the partner you are calling.'); return; }
    if (!when) { setErr('Pick a date and time.'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch(SALES_ENDPOINTS.partnerFollowUps(), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          channel_partner: target,
          scheduled_at: new Date(when).toISOString(),
          remarks,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.detail || 'Could not schedule that.'); setSaving(false); return; }
      notify('Follow-up scheduled.', 'success');
      onDone();
    } catch (e) { setErr(e.message); setSaving(false); }
  }

  return (
    <div className="cpa-form">
      <div className="cpa-form-row">
        {!partnerId && (
          <label className="cpa-lbl cpa-lbl-wide">
            Partner
            <PartnerPicker partners={partners || []} value={who} onChange={setWho}
              placeholder="Search a channel partner…" />
          </label>
        )}
        <label className="cpa-lbl">
          When
          <input className="nx-input nx-input-sm" type="datetime-local"
            value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
      </div>
      <label className="cpa-lbl">
        Remarks
        <textarea className="nx-input cpa-textarea" value={remarks} rows={2}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="What is this call about?" />
      </label>
      {err && <p className="cpa-err">{err}</p>}
      <div className="nx-actions cpa-form-actions">
        <button className="nx-btn nx-btn-sm nx-btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Scheduling…' : 'Schedule Follow-Up'}
        </button>
        <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ScheduleSiteVisit({ partnerId, partners, companyId, onDone, onCancel }) {
  const [who, setWho] = useState('');
  const target = partnerId || who;
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState('');
  const [when, setWhen] = useState(inAnHourLocal());
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const q = companyId ? `?company_id=${companyId}` : '';
    fetch(SALES_ENDPOINTS.projects + q, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setProjects(Array.isArray(d) ? d.filter((p) => p.is_active !== false) : []))
      .catch(() => {});
  }, [companyId]);

  async function save() {
    if (!target) { setErr('Pick the partner who is visiting.'); return; }
    if (!project) { setErr('Pick the project they are visiting.'); return; }
    if (!when) { setErr('Pick a date and time.'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch(SALES_ENDPOINTS.partnerSiteVisits(), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          channel_partner: target,
          project,
          scheduled_at: new Date(when).toISOString(),
          remarks,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.detail || 'Could not schedule that.'); setSaving(false); return; }
      notify('Site visit scheduled.', 'success');
      onDone();
    } catch (e) { setErr(e.message); setSaving(false); }
  }

  return (
    <div className="cpa-form">
      <div className="cpa-form-row">
        {!partnerId && (
          <label className="cpa-lbl cpa-lbl-wide">
            Partner
            <PartnerPicker partners={partners || []} value={who} onChange={setWho}
              placeholder="Search a channel partner…" />
          </label>
        )}
        <label className="cpa-lbl">
          Project
          <select className="nx-input nx-input-sm" value={project}
            onChange={(e) => setProject(e.target.value)}>
            <option value="">— Select —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="cpa-lbl">
          When
          <input className="nx-input nx-input-sm" type="datetime-local"
            value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
      </div>
      <label className="cpa-lbl">
        Remarks
        <textarea className="nx-input cpa-textarea" value={remarks} rows={2}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Who is hosting, what are they being shown?" />
      </label>
      {err && <p className="cpa-err">{err}</p>}
      <div className="nx-actions cpa-form-actions">
        <button className="nx-btn nx-btn-sm nx-btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Scheduling…' : 'Schedule Site Visit'}
        </button>
        <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ tables */

function ActivityTable({ kind, rows, showPartner, onChanged }) {
  const endpoint = kind === 'fu' ? SALES_ENDPOINTS.partnerFollowUp : SALES_ENDPOINTS.partnerSiteVisit;
  const map = kind === 'fu' ? FU_STATUS : SV_STATUS;
  const [busy, setBusy] = useState(null);

  async function setStatus(row, status) {
    setBusy(row.id);
    const res = await fetch(endpoint(row.id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!res.ok) { notify('Could not update that.', 'error'); return; }
    onChanged();
  }

  async function remove(row) {
    const what = kind === 'fu' ? 'follow-up' : 'site visit';
    if (!(await confirmDialog(`Remove this ${what}? It will not be recoverable.`))) return;
    setBusy(row.id);
    const res = await fetch(endpoint(row.id), { method: 'DELETE', headers: authHeaders() });
    setBusy(null);
    if (res.ok || res.status === 204) onChanged();
    else notify('Could not remove that.', 'error');
  }

  return (
    <div className="cpa-scroll">
      <table className="nx-table cpa-table">
        <thead>
          <tr>
            {showPartner && <th>Partner</th>}
            {kind === 'sv' && <th>Project</th>}
            <th>Scheduled</th>
            <th>{kind === 'fu' ? 'Completed' : 'Visited'}</th>
            <th>{kind === 'fu' ? 'Assigned To' : 'Host'}</th>
            <th>Remarks</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={isOverdue(kind, row) ? 'cpa-overdue' : undefined}>
              {showPartner && (
                <td>
                  <span className="cpa-strong">{row.partner_name || '—'}</span>
                  {row.partner_firm ? <span className="cpa-sub">{row.partner_firm}</span> : null}
                </td>
              )}
              {kind === 'sv' && <td>{row.project_name || '—'}</td>}
              <td>{fmt(row.scheduled_at)}</td>
              <td>{fmt(kind === 'fu' ? row.completed_at : row.visited_at)}</td>
              <td>{(kind === 'fu' ? row.assigned_to_name : row.host_name) || '—'}</td>
              <td className="cpa-remarks">{row.remarks || row.outcome || '—'}</td>
              <td><StatusChip map={map} value={row.status} /></td>
              <td className="cpa-row-actions">
                {row.status !== 'completed' && (
                  <button className="nx-btn nx-btn-sm nx-btn-success-soft" disabled={busy === row.id}
                    onClick={() => setStatus(row, 'completed')}>Done</button>
                )}
                {row.status === OPEN_STATUS[kind] ? (
                  <button className="nx-btn nx-btn-sm nx-btn-ghost" disabled={busy === row.id}
                    onClick={() => setStatus(row, DROP_STATUS[kind][0])}>{DROP_STATUS[kind][1]}</button>
                ) : null}
                <button className="nx-btn nx-btn-sm nx-icon-btn nx-btn-danger-soft" disabled={busy === row.id}
                  onClick={() => remove(row)} aria-label="Remove"><Icon name="trash" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------- one partner: modal */

export function PartnerActivityModal({ partner, companyId, onClose }) {
  const [tab, setTab] = useState('fu');
  const [adding, setAdding] = useState(false);

  const fu = useActivity({ kind: 'fu', partnerId: partner.id, companyId });
  const sv = useActivity({ kind: 'sv', partnerId: partner.id, companyId });
  const active = tab === 'fu' ? fu : sv;

  const pending = fu.rows.filter((r) => r.status === 'pending').length;
  const upcoming = sv.rows.filter((r) => r.status === 'scheduled').length;

  const done = () => { setAdding(false); active.reload(); };

  return (
    <div className="nx-modal-backdrop cpa-backdrop" onClick={onClose}>
      <div className="nx-modal cpa-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cpa-modal-head">
          <div>
            <div className="cpa-modal-title">{partner.name}</div>
            <div className="cpa-modal-sub">
              {[partner.firm_name, partner.contact_no, partner.city].filter(Boolean).join(' · ') || 'Channel partner'}
            </div>
          </div>
          <button className="nx-btn nx-btn-sm nx-icon-btn nx-btn-ghost" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>

        <div className="cpa-tabs">
          {[['fu', 'Follow-Ups', fu.rows.length, pending ? `${pending} pending` : ''],
            ['sv', 'Site Visits', sv.rows.length, upcoming ? `${upcoming} upcoming` : '']].map(([key, label, count, note]) => (
            <button key={key} className={`cpa-tab${tab === key ? ' is-on' : ''}`}
              onClick={() => { setTab(key); setAdding(false); }}>
              {label} <span className="cpa-tab-count">{count}</span>
              {note ? <span className="cpa-tab-note">{note}</span> : null}
            </button>
          ))}
        </div>

        <div className="cpa-modal-body">
          {adding ? (
            tab === 'fu'
              ? <ScheduleFollowUp partnerId={partner.id} onDone={done} onCancel={() => setAdding(false)} />
              : <ScheduleSiteVisit partnerId={partner.id} companyId={companyId} onDone={done} onCancel={() => setAdding(false)} />
          ) : (
            <button className="nx-btn nx-btn-md nx-btn-primary cpa-add" onClick={() => setAdding(true)}>
              + Schedule {tab === 'fu' ? 'Follow-Up' : 'Site Visit'}
            </button>
          )}

          {active.loading ? (
            <Loader label="Loading…" />
          ) : active.rows.length === 0 ? (
            <p className="cpa-empty">
              {tab === 'fu'
                ? 'No follow-ups with this partner yet. Schedule the first one above.'
                : 'No site visits with this partner yet. Schedule the first one above.'}
            </p>
          ) : (
            <ActivityTable kind={tab} rows={active.rows} onChanged={active.reload} />
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------- whole company: a tab panel */

// The status tabs mirror the CP Leads half of each screen one-for-one, using
// this side's own statuses. "Today's" and "Overdue" are derived from
// scheduled_at rather than stored, exactly as they are over there.
const PANEL_TABS = {
  fu: [
    { key: 'today', label: "Today's" },
    { key: 'overdue', label: 'Overdue' },
    { key: 'pending', label: 'All Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'all', label: 'All' },
  ],
  sv: [
    { key: 'today', label: "Today's" },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'completed', label: 'Completed' },
    { key: 'no_show', label: 'No Show' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'all', label: 'All' },
  ],
};

const dayOf = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toLocaleDateString('en-CA');
};
const todayKey = () => new Date().toLocaleDateString('en-CA');

/**
 * `kind` is 'fu' or 'sv'. This is the CP Details half of the Follow-Ups and Site
 * Visits screens — the partners themselves, where the CP Leads half shows the
 * work against their leads.
 *
 * Laid out to match that half exactly: same title block, same status tabs, same
 * search bar, the same DateFilter the dashboards use, the same centred empty
 * state. Flipping the toggle should change the subject, not the furniture. The
 * one thing missing is the OUTCOME row — a partner has no hot/warm/cold.
 */
export function PartnerActivityPanel({ kind, companyId }) {
  const { rows, loading, reload } = useActivity({ kind, companyId });
  const [partners, setPartners] = useState([]);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState(kind === 'fu' ? 'pending' : 'scheduled');
  const [q, setQ] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [proj, setProj] = useState([]);

  // Needed to schedule from here, where no partner is preselected.
  useEffect(() => {
    fetch(SALES_ENDPOINTS.channelPartners + (companyId ? `?company_id=${companyId}` : ''),
      { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPartners(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [companyId]);

  // Project options come from every row, not the filtered set, so picking one
  // never removes the others from the dropdown.
  const projOptions = useMemo(() => {
    if (kind !== 'sv') return [];
    return [...new Set(rows.map((r) => r.project_name).filter(Boolean))].sort();
  }, [rows, kind]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const dated = !!(range.from || range.to);
    const today = todayKey();
    return rows.filter((r) => {
      const day = dayOf(r.scheduled_at);
      if (tab === 'today') { if (day !== today) return false; }
      else if (tab === 'overdue') {
        if (r.status !== OPEN_STATUS[kind] || !r.scheduled_at) return false;
        if (new Date(r.scheduled_at) >= new Date()) return false;
      } else if (tab === 'pending') { if (r.status !== OPEN_STATUS[kind]) return false; }
      else if (tab !== 'all' && r.status !== tab) return false;

      if (dated) {
        if (!day) return false;
        if (range.from && day < range.from) return false;
        if (range.to && day > range.to) return false;
      }
      if (proj.length && !proj.includes(r.project_name || '—')) return false;
      if (needle && ![r.partner_name, r.partner_firm, r.project_name, r.remarks]
        .some((v) => String(v || '').toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [rows, tab, q, range, proj, kind]);

  const narrowed = !!(q.trim() || range.from || range.to || proj.length);
  const noun = kind === 'fu' ? 'follow-up' : 'site visit';
  const done = () => { setAdding(false); reload(); };

  return (
    <div className="nx-page nx-page-center nx-w-md">
      <div className="cpa-head">
        <div>
          <h1 className="cpa-title">{kind === 'fu' ? 'Partner Follow-Ups' : 'Partner Site Visits'}</h1>
          <p className="cpa-sub">
            {visible.length} {noun}{visible.length === 1 ? '' : 's'}
          </p>
        </div>
        {!adding && (
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => setAdding(true)}>
            + Schedule {kind === 'fu' ? 'Follow-Up' : 'Visit'}
          </button>
        )}
      </div>

      <div className="cpa-tabrow">
        {PANEL_TABS[kind].map((t) => (
          <button key={t.key} className={`cpa-tabbtn${tab === t.key ? ' is-on' : ''}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {adding && (
        kind === 'fu'
          ? <ScheduleFollowUp partners={partners} onDone={done} onCancel={() => setAdding(false)} />
          : <ScheduleSiteVisit partners={partners} companyId={companyId}
              onDone={done} onCancel={() => setAdding(false)} />
      )}

      <div className="nx-search-wrap nx-mb-14">
        <span className="nx-search-icon"><Icon name="search" /></span>
        <input className="nx-input nx-search-input" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={kind === 'fu' ? 'Search partner, firm or remarks…' : 'Search partner, firm or project…'} />
      </div>

      {/* The same date control the dashboards and the CP Leads half use, so its
          Month / Quarter / FY choices mean the same thing on both sides. */}
      <DateFilter onChange={setRange} />
      <div className="cpa-filterrow">
        {projOptions.length > 1 && (
          <MultiSelect allLabel="All Projects" noun="projects" value={proj} onChange={setProj}
            options={projOptions.map((n) => ({ value: n, label: n }))} />
        )}
        {narrowed && (
          <button className="nx-btn nx-btn-sm nx-btn-secondary nx-clear-filters-btn"
            onClick={() => { setQ(''); setProj([]); }}>
            <Icon name="x" /> Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <Loader label="Loading…" />
      ) : visible.length === 0 ? (
        <div className="cpa-blank">
          <p className="cpa-blank-title">
            {narrowed ? `No ${noun}s match these filters` : `No partner ${noun}s`}
          </p>
          <p className="cpa-blank-sub">
            {narrowed
              ? 'Try widening the date range or clearing the search.'
              : `Schedule one above, or open a partner under CP Details on All Leads.`}
          </p>
        </div>
      ) : (
        <ActivityTable kind={kind} rows={visible} showPartner onChanged={reload} />
      )}
    </div>
  );
}
