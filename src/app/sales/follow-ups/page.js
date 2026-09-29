'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';


import Icon from '../../../components/Icon';
import Loader from '../../../components/Loader';
import MultiSelect from '../../../components/MultiSelect';
import { onlyPresent } from '../../../lib/presentOptions';
import { notify } from '../../../lib/notify';
import LeadHistory from '../../../components/LeadHistory';
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const endOfToday   = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };


// Lead-status options a follow-up can set when completed, by the follow-up's role.
// Telecaller updates TC Status; STM updates STM Status (a manager completing either
// writes the matching field). Marking a TC lead "warm" auto-transfers it to the STM.
const TC_STATUS_OPTS  = [['warm', 'Warm'], ['cold', 'Cold'], ['not_interested', 'Not Interested'], ['not_reachable', 'Not Reachable'], ['callback', 'Callback']];
const STM_STATUS_OPTS = [['hot', 'Hot'], ['warm', 'Warm'], ['cold', 'Cold'], ['not_interested', 'Not Interested'], ['sv_scheduled', 'SV Scheduled'], ['sv_done', 'SV Done'], ['closed', 'Closed']];

// Filter-bar status options — same full set the Leads list's filter dropdowns use
// (superset of TC_STATUS_OPTS/STM_STATUS_OPTS above, which only offer the statuses
// a follow-up can set on completion).
const TC_FILTER_STATUSES  = ['warm', 'cold', 'not_interested', 'not_reachable', 'callback', 'not_qualified'];
const STM_FILTER_STATUSES = ['hot', 'warm', 'cold', 'not_interested', 'sv_scheduled', 'sv_done', 'closed', 'not_qualified'];

const PAGE_STEP = 50;
const TABS = [
  { key: 'today',   label: "Today's" },
  { key: 'overdue', label: 'Overdue' },
  { key: 'pending', label: 'All Pending' },
  // The completed count was being totalled and shown as a chip, but there was no tab
  // to reach those rows — the only way to see a completed follow-up was to scroll
  // "All" past every pending one.
  { key: 'completed', label: 'Completed' },
  { key: 'all',     label: 'All' },
];

export function FollowUpsContent({ adminView = false, cpOnly = false }) {
  const user      = useSelector((s) => s.auth.user);
  const router = useRouter();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  // Same designation split as the Leads list, so this page offers the same filter
  // set (a Telecaller only ever sees their own follow-ups anyway, so hiding the
  // assignee/status pickers that don't apply to them keeps the bar uncluttered).
  const _desig = (user?.designation || '').toLowerCase();
  const isTelecaller = _desig.includes('telecaller') || _desig.includes('tele caller');
  const isStm        = _desig.includes('stm') || _desig.includes('sales team') || _desig.includes('sales executive');
  const isCp         = _desig.includes('cp executive') || _desig.includes('channel partner');
  const isCpHead     = _desig.includes('cp cluster head');
  const isCpAny      = isCp || isCpHead;
  const isAdminMgr   = !isTelecaller && !isStm && !isCpAny;
  const showTcStatus = isAdminMgr || isTelecaller;
  const showStmStatus= isAdminMgr || isStm || isCpAny;
  const showAssignees= isAdminMgr;
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('today');
  const [projects,    setProjects]    = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [stms,        setStms]        = useState([]);
  const [cpModuleUsers, setCpModuleUsers] = useState([]);
  const [searchText,      setSearchText]      = useState('');
  const [projectFilter,   setProjectFilter]   = useState([]);   // [] = every project
  const [tcStatusFilter,  setTcStatusFilter]  = useState('');
  const [stmStatusFilter, setStmStatusFilter] = useState('');
  const [telecallerFilter, setTelecallerFilter] = useState([]);  // [] = everyone
  const [stmFilter,        setStmFilter]        = useState([]);  // [] = everyone

  const loadMeta = useCallback(async () => {
    const cqUser = companyId ? `&company_id=${companyId}` : '';
    try {
      const pRes = await fetch(SALES_ENDPOINTS.projects + (companyId ? `?company_id=${companyId}` : ''), { headers: authHeaders() });
      if (pRes.ok) setProjects(await pRes.json());
    } catch (_) {}
    if (showAssignees && !cpOnly) {
      try {
        const [tRes, sRes] = await Promise.all([
          fetch(SALES_ENDPOINTS.telecallers + cqUser, { headers: authHeaders() }),
          fetch(SALES_ENDPOINTS.stms        + cqUser, { headers: authHeaders() }),
        ]);
        if (tRes.ok) setTelecallers(await tRes.json());
        if (sRes.ok) setStms(await sRes.json());
      } catch (_) {}
    }
    if (showAssignees && cpOnly) {
      try {
        const cRes = await fetch(SALES_ENDPOINTS.cpModuleUsers + cqUser, { headers: authHeaders() });
        if (cRes.ok) setCpModuleUsers(await cRes.json());
      } catch (_) {}
    }
  }, [companyId, showAssignees, cpOnly]);
  useEffect(() => { loadMeta(); }, [loadMeta]);
  // Deep link from the dashboard's Pending / Overdue tiles, e.g. ?filter=overdue.
  // Read in an effect, not a lazy initialiser: during a Next client navigation
  // window.location isn't committed yet when the initialiser runs.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('filter');
    if (TABS.some((t) => t.key === f)) setFilter(f);
  }, []);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  // Completion modal: capture remarks + optionally schedule the next follow-up.
  const [done,    setDone]    = useState(null);   // the follow-up being completed
  const [outcome, setOutcome] = useState('');
  const [schedNext, setSchedNext] = useState(false);
  const [nextAt,  setNextAt]  = useState('');
  const [nextRemarks, setNextRemarks] = useState('');
  const [newStatus, setNewStatus] = useState('');   // optional lead status to set on completion
  // Completing with sv_scheduled schedules the visit inline, the same way the lead modal does.
  const [svAt, setSvAt] = useState('');
  const [svRemarks, setSvRemarks] = useState('');
  // SV Done needs the visit itself: its outcome and date go with the status.
  const [svOutcome, setSvOutcome] = useState('');
  const [svDate, setSvDate] = useState('');
  // The Complete dialog's tabs: 'complete' (the form) or 'history' (the lead's timeline).
  const [doneTab, setDoneTab] = useState('complete');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = [];
      if (companyId) params.push(`company_id=${companyId}`);
      if (adminView) params.push('admin_view=1');
      if (cpOnly)    params.push('cp_only=true');
      const url = params.length ? `${SALES_ENDPOINTS.followUps}?${params.join('&')}` : SALES_ENDPOINTS.followUps;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) setItems(await res.json());
    } catch (_) {}
    setLoading(false);
  }, [companyId, adminView, cpOnly]);

  useEffect(() => { load(); }, [load, companyId]);

  function openDone(fu) {
    // Pre-select the lead's current TC/STM status so the caller sees where it stands.
    const cur = (fu.role_context === 'stm' ? fu.lead_stm_status : fu.lead_telecaller_status) || '';
    setDone(fu); setOutcome(''); setSchedNext(false); setNextAt(''); setNextRemarks(''); setNewStatus(cur);
    setSvAt(''); setSvRemarks(''); setSvOutcome(''); setSvDate(new Date().toISOString().slice(0, 10));
    setDoneTab('complete');
  }

  async function completeFollowUp() {
    if (!done) return;
    if (schedNext && !nextAt) { return; }
    const origStm = (done.role_context === 'stm' ? done.lead_stm_status : done.lead_telecaller_status) || '';
    const markingSvDone = newStatus === 'sv_done' && origStm !== 'sv_done';
    if (markingSvDone && (!svOutcome || !svDate || !outcome.trim())) {
      notify('Pick the visit outcome and date, and add remarks, to mark SV Done.', 'error'); return;
    }
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
        // SV Done carries its visit — the server records it in the same save.
        const extra = markingSvDone ? { sv_outcome: svOutcome, sv_visited_at: svDate, sv_remarks: outcome.trim() } : {};
        const lr = await fetch(SALES_ENDPOINTS.lead(done.lead), {
          method: 'PATCH', headers: authHeaders(),
          body: JSON.stringify({ [field]: newStatus, ...extra }),
        });
        if (!lr.ok) {
          const d = await lr.json().catch(() => ({}));
          notify(d.detail || 'The lead status could not be saved.', 'error');
        }
      }
      // STM set sv_scheduled -> create the site visit, matching the lead modal.
      if (newStatus === 'sv_scheduled' && svAt && done.lead) {
        try {
          await fetch(SALES_ENDPOINTS.siteVisits, {
            method: 'POST', headers: authHeaders(),
            body: JSON.stringify({
              lead: done.lead, project: done.lead_project || null,
              scheduled_at: new Date(svAt).toISOString(), status: 'scheduled',
              stm: done.assigned_to, referred_by_telecaller: done.lead_telecaller || null,
              remarks: svRemarks.trim(),
            }),
          });
        } catch (_) {}
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
      // STM set closed -> hand off to the booking flow with this lead prefilled, exactly
      // as the lead modal does, so a closure is recorded the same way from either screen.
      if (newStatus === 'closed' && done.lead) {
        try {
          sessionStorage.setItem('closure_sv', JSON.stringify({
            lead: done.lead, lead_name: done.lead_name || '', lead_phone: done.lead_phone || '',
            project: done.lead_project || null,
          }));
        } catch (_) {}
        setDone(null);
        router.push(done.lead_project ? `/sales/closure/${done.lead_project}` : '/sales/closure');
        setSubmitting(false);
        return;
      }
      setDone(null);
      load();
    } catch (_) {}
    setSubmitting(false);
  }

  const now = new Date();
  // Date-range + filter-bar predicate (applies before the tab filter, same as the
  // Leads list's `filters` object) — the stat chips below are computed off this,
  // so they always describe what the filter bar is currently showing.
  const q = searchText.trim().toLowerCase();
  const matchesFilters = (fu) => {
    const d = new Date(fu.scheduled_at);
    if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo   && d > new Date(dateTo   + 'T23:59:59')) return false;
    if (q) {
      const name  = (fu.lead_name  || '').toLowerCase();
      const phone = (fu.lead_phone || '').toLowerCase();
      if (!name.includes(q) && !phone.includes(q)) return false;
    }
    if (projectFilter.length && !projectFilter.includes(String(fu.lead_project || ''))) return false;
    if (tcStatusFilter  && (fu.lead_telecaller_status || '') !== tcStatusFilter) return false;
    if (stmStatusFilter && (fu.lead_stm_status || '') !== stmStatusFilter) return false;
    // Both pickers name who the follow-up is assigned to, so together they are one
    // list of people: a follow-up shows if it belongs to any of them.
    const people = [...telecallerFilter, ...stmFilter];
    if (people.length && !people.includes(String(fu.assigned_to || ''))) return false;
    return true;
  };
  const dateItems = items.filter(matchesFilters);

  // The pickers list only what these follow-ups hold (see lib/presentOptions).
  const seen = (key) => (loading ? null : items.map((f) => f[key]));

  // Status-wise counts for the selected date range (independent of the tab).
  const counts = {
    total:     dateItems.length,
    pending:   dateItems.filter((f) => f.status === 'pending').length,
    completed: dateItems.filter((f) => f.status === 'completed').length,
    overdue:   dateItems.filter((f) => f.status === 'pending' && new Date(f.scheduled_at) < now).length,
  };

  const [shown, setShown] = useState(PAGE_STEP);
  const visible = dateItems.filter((fu) => {
    const at = new Date(fu.scheduled_at);
    if (filter === 'all')     return true;
    if (filter === 'pending') return fu.status === 'pending';
    if (filter === 'completed') return fu.status === 'completed';
    if (filter === 'today')   return fu.status === 'pending' && at >= startOfToday() && at <= endOfToday();
    if (filter === 'overdue') return fu.status === 'pending' && at < now;
    return true;
  });

  return (
    <div className="nx-page nx-page-center nx-w-md">
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Follow-Ups</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 18px' }}>
        {visible.length} item{visible.length === 1 ? '' : 's'} · {user?.name || ''}
      </p>

      {/* Filter bar — same shape as the Leads list's: search bar, then date range +
          quick presets + project/status pickers, then a row of assignee pickers. */}
      {(() => {
        const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const today   = localDate(new Date());
        const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
        const anyFilter = !!(searchText || dateFrom || dateTo || projectFilter.length || tcStatusFilter || stmStatusFilter || telecallerFilter.length || stmFilter.length);
        const clearAll = () => {
          setSearchText(''); setDateFrom(''); setDateTo('');
          setProjectFilter([]); setTcStatusFilter(''); setStmStatusFilter('');
          setTelecallerFilter([]); setStmFilter([]);
        };
        const fSel = {
          height: 36, padding: '0 10px', borderRadius: 8,
          border: '1.5px solid var(--surface-3)', fontSize: 12, background: 'var(--surface-2)',
          cursor: 'pointer', outline: 'none', color: 'var(--text)', fontWeight: 500,
        };
        const activeSelStyle = (val) => val ? { ...fSel, borderColor: 'var(--accent)', background: 'var(--accent-softer)', color: 'var(--accent)', fontWeight: 600 } : fSel;

        return (
          <div className="nx-card nx-fu-filterbar">

            {/* Search bar */}
            <div className="nx-fu-filterbar-search">
              <div className="nx-search-wrap">
                <span className="nx-search-icon"><Icon name="search" /></span>
                <input className="nx-input nx-search-input" value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search name, phone…" />
              </div>
            </div>

            {/* Row 1: date range + quick buttons + project + tc/stm status */}
            <div className="nx-fu-filterbar-row">
              <span className="nx-fu-filterbar-label">Date</span>
              <input className="nx-input nx-fu-date-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="nx-fu-arrow">→</span>
              <input className="nx-input nx-fu-date-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <div className="nx-fu-divider" />
              <select className="nx-input nx-input-sm nx-filter-sel"
                value={(dateFrom === today && dateTo === today) ? 'today'
                     : (dateFrom === daysAgo(6) && dateTo === today) ? 'week'
                     : (dateFrom === daysAgo(29) && dateTo === today) ? 'month' : ''}
                onChange={(e) => {
                  const k = e.target.value;
                  setDateFrom(k === 'today' ? today : k === 'week' ? daysAgo(6) : k === 'month' ? daysAgo(29) : '');
                  setDateTo(k ? today : '');
                }}>
                <option value="">Any date</option>
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
              <div className="nx-fu-divider" />
              <MultiSelect allLabel="All Projects" noun="projects" value={projectFilter} onChange={setProjectFilter}
                options={onlyPresent(projects.map((p) => ({ value: String(p.id), label: p.name })), seen('lead_project'), projectFilter)} />
              {showTcStatus && (
                <select value={tcStatusFilter} onChange={(e) => setTcStatusFilter(e.target.value)} style={activeSelStyle(tcStatusFilter)}>
                  <option value="">TC Status</option>
                  {onlyPresent(TC_FILTER_STATUSES, seen('lead_telecaller_status'), tcStatusFilter).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              )}
              {showStmStatus && (
                <select value={stmStatusFilter} onChange={(e) => setStmStatusFilter(e.target.value)} style={activeSelStyle(stmStatusFilter)}>
                  <option value="">{cpOnly ? 'Lead Status' : isCpAny ? 'CP Status' : 'STM Status'}</option>
                  {onlyPresent(STM_FILTER_STATUSES, seen('lead_stm_status'), stmStatusFilter).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              )}
              {anyFilter && (
                <button className="nx-btn nx-btn-sm nx-btn-danger-soft nx-ml-auto" onClick={clearAll}>
                  <Icon name="x" /> Clear all
                </button>
              )}
            </div>

            {/* Row 2: assignee pickers */}
            {showAssignees && !cpOnly && (
              <div className="nx-fu-filterbar-row">
                <MultiSelect allLabel="All Telecallers" noun="telecallers" value={telecallerFilter} onChange={setTelecallerFilter}
                  options={onlyPresent(telecallers.map((u) => ({ value: String(u.id), label: u.name })), seen('assigned_to'), telecallerFilter)} />
                <MultiSelect allLabel="All STMs" noun="STMs" value={stmFilter} onChange={setStmFilter}
                  options={onlyPresent(stms.map((u) => ({ value: String(u.id), label: u.name })), seen('assigned_to'), stmFilter)} />
              </div>
            )}
            {showAssignees && cpOnly && (
              <div className="nx-fu-filterbar-row">
                <MultiSelect allLabel="All Team Members" noun="people" value={stmFilter} onChange={setStmFilter}
                  options={onlyPresent(cpModuleUsers.map((u) => ({ value: String(u.id), label: u.name })), seen('assigned_to'), stmFilter)} />
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        {[
          { label: 'Total',     n: counts.total,     c: 'var(--accent)', bg: 'var(--accent-softer)' },
          { label: 'Pending',   n: counts.pending,   c: 'var(--warning)', bg: 'var(--warning-soft)' },
          { label: 'Overdue',   n: counts.overdue,   c: 'var(--danger)', bg: 'var(--danger-soft)' },
          { label: 'Completed', n: counts.completed, c: 'var(--success)', bg: 'var(--success-soft)' },
        ].map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 20, background: s.bg }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: s.c }}>{s.n}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: s.c, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--surface-3)', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'none', border: 'none', whiteSpace: 'nowrap',
                color: active ? 'var(--accent)' : 'var(--muted)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Loader label="Loading…" style={{ padding: '28px 0' }} />
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-3)', margin: 0 }}>No follow-ups</p>
          <p style={{ fontSize: 13, color: 'var(--faint)', margin: '4px 0 0' }}>Schedule follow-ups from lead details</p>
        </div>
      ) : (
        <div className="nx-fu-list">
          {visible.slice(0, shown).map((fu) => {
            const overdue = fu.status === 'pending' && new Date(fu.scheduled_at) < now;
            return (
              <div key={fu.id} className={`nx-card nx-fu-card${overdue ? ' is-overdue' : ''}`}>
                <div className="nx-fu-main">
                  <div className="nx-fu-head">
                    <span className="nx-fu-name">{fu.lead_name || 'Lead'}</span>
                    <span className={`nx-fu-role ${fu.role_context === 'stm' ? 'stm' : 'tc'}`}>
                      {fu.role_context?.toUpperCase()}
                    </span>
                    <span className={`nx-status ${fu.status === 'done' ? 'ok' : fu.status === 'pending' ? 'warn' : 'off'}`}>
                      {fu.status}
                    </span>
                  </div>
                  <p className="nx-fu-when">{fmtDateTime(fu.scheduled_at)}</p>
                  {fu.assigned_to_name && <p className="nx-fu-meta">Assigned to: {fu.assigned_to_name}</p>}
                  {fu.remarks && <p className="nx-fu-note">“{fu.remarks}”</p>}
                  {fu.outcome && <p className="nx-fu-outcome"><b>Remarks:</b> {fu.outcome}</p>}
                </div>
                {fu.status === 'pending' && (
                  <button className="nx-btn nx-btn-sm nx-btn-success-soft" onClick={() => openDone(fu)}>
                    Mark Done
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {visible.length > shown && (
        <div className="nx-more">
          <span className="nx-more-count">Showing {shown} of {visible.length}</span>
          <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setShown((n) => n + PAGE_STEP)}>Show more</button>
        </div>
      )}

      {/* Complete follow-up: remarks + optional next follow-up */}
      {done && (
        <div className="nx-modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(4,8,16,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => !submitting && setDone(null)}>
          <div className="nx-modal" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 460, padding: '22px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Complete follow-up</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, marginBottom: 16 }}>{done.lead_name}{!!done.lead_phone && ` · ${done.lead_phone}`} · {fmtDateTime(done.scheduled_at)}</div>

            {/* Complete: the form below. History: this lead's timeline, to read before
                writing the outcome. */}
            <div className="fu-done-tabs">
              {[['complete', 'Complete'], ['history', 'History']].map(([k, l]) => (
                <button type="button" key={k} className={`fu-done-tab${doneTab === k ? ' is-on' : ''}`} onClick={() => setDoneTab(k)}>{l}</button>
              ))}
            </div>
            {doneTab === 'history' ? <LeadHistory leadId={done.lead} /> : (<>

            {/* Update the lead's status after this call (TC or STM, per the follow-up's role). */}
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>
              {done.role_context === 'stm' ? 'Update STM Status' : 'Update TC Status'}
            </label>
            <select className="nx-input" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
              style={{ width: '100%', marginTop: 6, marginBottom: 4, padding: '10px 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', cursor: 'pointer', background: 'var(--surface)' }}>
              <option value="">— No change —</option>
              {(done.role_context === 'stm' ? STM_STATUS_OPTS : TC_STATUS_OPTS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {newStatus === 'warm' && done.role_context !== 'stm' && (done.lead_telecaller_status || '') !== 'warm' && (
              <p style={{ fontSize: 11, color: 'var(--warning)', margin: '2px 0 0' }}>Marking warm will transfer this lead to the STM pipeline.</p>
            )}

            {/* Same two hand-offs the lead modal offers, so a status set here behaves
                identically to one set on the lead. */}
            {newStatus === 'sv_scheduled' && (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--success-2)', borderRadius: 16, padding: 14, marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
                  <Icon name="pin" /> Schedule Site Visit
                </div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)' }}>Date &amp; Time <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="nx-input" type="datetime-local" value={svAt} onChange={(e) => setSvAt(e.target.value)}
                  style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', display: 'block', marginTop: 10 }}>Visit Remarks</label>
                <input className="nx-input" value={svRemarks} onChange={(e) => setSvRemarks(e.target.value)} placeholder="Location, notes…"
                  style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                {!svAt && <p style={{ fontSize: 11, color: 'var(--success)', margin: '8px 0 0' }}>Set a date &amp; time to create the site visit automatically.</p>}
              </div>
            )}
            {newStatus === 'sv_done' && (done.lead_stm_status || '') !== 'sv_done' && (
              <div className="fu-sv-box">
                <div className="fu-sv-title"><Icon name="pin" /> Site visit done</div>
                <label className="fu-sv-label">Outcome <span className="fu-sv-req">*</span></label>
                <select className="nx-input fu-sv-input" value={svOutcome} onChange={(e) => setSvOutcome(e.target.value)}>
                  <option value="">Pick outcome</option>
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cold">Cold</option>
                  <option value="not_interested">Not Interested</option>
                </select>
                <label className="fu-sv-label">Visit date <span className="fu-sv-req">*</span></label>
                <input className="nx-input fu-sv-input" type="date" value={svDate} max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setSvDate(e.target.value)} />
                <p className="fu-sv-note">The visit is recorded with this status, using your remarks above.</p>
              </div>
            )}
            {newStatus === 'closed' && (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--success-2)', borderRadius: 16, padding: '12px 14px', marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--success)' }}><Icon name="check-circle" /></span>
                <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                  Marking done takes you to the booking flow — pick the unit(s) and record the booking for this lead.
                </span>
              </div>
            )}

            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginTop: 14 }}>Remarks</label>
            <textarea className="nx-input" value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={3} placeholder="Outcome of this follow-up…"
              style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', outline: 'none' }} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={schedNext} onChange={(e) => setSchedNext(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              Schedule next follow-up
            </label>
            {schedNext && (
              <div style={{ marginTop: 12, paddingLeft: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Next follow-up date &amp; time</label>
                <input className="nx-input" type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)}
                  style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginTop: 10 }}>Next follow-up note</label>
                <textarea className="nx-input" value={nextRemarks} onChange={(e) => setNextRemarks(e.target.value)} rows={2} placeholder="What to discuss next…"
                  style={{ width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', outline: 'none' }} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setDone(null)} disabled={submitting} style={{ padding: '9px 18px', background: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button className="nx-btn nx-btn-md nx-btn-success" onClick={completeFollowUp} disabled={submitting || (schedNext && !nextAt)}
                style={{ padding: '9px 20px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (submitting || (schedNext && !nextAt)) ? 0.6 : 1 }}>
                {submitting ? 'Saving…' : newStatus === 'closed' ? 'Record Closure →' : 'Mark Done'}
              </button>
            </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  return <FollowUpsContent />;
}
