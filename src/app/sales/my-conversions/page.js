'use client';
import { useState, useEffect, useCallback } from 'react';

import { useSelector } from 'react-redux';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';


import Icon from '../../../components/Icon';
import Loader from '../../../components/Loader';
import MultiSelect from '../../../components/MultiSelect';
import { can } from '../../../lib/moduleAccess';
import BookFilter, { useBook } from '../../../components/BookFilter';
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const HISTORY_LABEL = {
  created: 'Lead Created', status: 'Overall Status', telecaller_status: 'TC Status',
  stm_status: 'STM Status', telecaller: 'Telecaller Assigned', stm: 'STM Assigned',
  warm_transfer: 'Transferred to STM', site_visit: 'Site Visit', closure: 'Closure',
};

// In-place lead detail + full history. Opens instantly with the row data we already
// have, then streams the history timeline from a single lead-detail fetch — no
// navigation, no leads-list load.
function LeadHistoryModal({ lead, onClose }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    let alive = true;
    setDetail(null);
    (async () => {
      try {
        const res = await fetch(SALES_ENDPOINTS.lead(lead.id), { headers: authHeaders() });
        if (res.ok && alive) setDetail(await res.json());
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [lead.id]);

  const d = detail || {};
  const rows = [
    ['Phone', d.phone || lead.phone],
    ['Project', d.project_name || lead.project_name],
    ['Source', d.source_name],
    ['Telecaller', d.telecaller_name],
    ['STM', d.stm_name],
    ['Status', (d.status || '').replace(/_/g, ' ')],
  ];

  return (
    <div className="nx-modal-backdrop" onClick={onClose}>
      <div className="nx-modal myconv-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="nx-modal-head myconv-modal-head">
          <div>
            <div className="myconv-modal-name">{lead.name || '—'}</div>
            <div className="myconv-modal-phone">{d.phone || lead.phone || ''}</div>
          </div>
          <button onClick={onClose} className="myconv-modal-close"><Icon name="x" /></button>
        </div>

        <div className="myconv-modal-body">
          {/* Quick detail */}
          <div className="myconv-detail-grid">
            {rows.map(([k, v]) => (
              <div key={k}>
                <div className="myconv-detail-label">{k}</div>
                <div className={`myconv-detail-value${k === 'Status' ? ' is-status' : ''}`}>{v || '—'}</div>
              </div>
            ))}
          </div>

          <div className="myconv-history-title">History</div>

          {/* Lead received */}
          <div className="myconv-tl-row">
            <div className="myconv-tl-rail">
              <div className="nx-dot-icon"><Icon name="download" /></div>
              <div className="myconv-tl-line" />
            </div>
            <div className="myconv-tl-body">
              <p className="myconv-tl-title">Lead Received</p>
              <p className="myconv-tl-desc">Source: {d.source_name || '—'} · Project: {d.project_name || lead.project_name || '—'}</p>
              <p className="myconv-tl-date">{fmtDateTime(d.created_at)}</p>
            </div>
          </div>

          {!detail && <Loader variant="inline" size="sm" label="Loading…" />}
          {detail && (detail.history || []).filter(h => h.field_changed !== 'created').length === 0 && (
            <p className="myconv-tl-empty">No changes recorded yet.</p>
          )}
          {(detail?.history || []).filter(h => h.field_changed !== 'created').map((h, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const icon   = h.field_changed === 'warm_transfer' ? 'flame'
                         : h.field_changed === 'telecaller'    ? 'user'
                         : h.field_changed === 'stm'           ? 'building'
                         : h.field_changed === 'site_visit'    ? 'home'
                         : h.field_changed === 'closure'       ? 'check-circle'
                         : h.field_changed.includes('status')  ? 'refresh' : 'pencil';
            const singleValue = ['created', 'warm_transfer', 'closure'].includes(h.field_changed) || !h.old_value;
            const byLabel = h.changed_by_name || (['created', 'telecaller', 'stm'].includes(h.field_changed) ? 'System (auto)' : null);
            return (
              <div key={h.id} className={`myconv-tl-row${isLast ? ' is-last' : ''}`}>
                <div className="myconv-tl-rail">
                  <div className="myconv-tl-dot" data-field={h.field_changed}><Icon name={icon} size={15} /></div>
                  {!isLast && <div className="myconv-tl-line" />}
                </div>
                <div className={`myconv-tl-body${isLast ? ' is-last' : ''}`}>
                  <p className="myconv-tl-title">{HISTORY_LABEL[h.field_changed] || h.field_changed}</p>
                  <p className="myconv-tl-value">
                    {singleValue ? (
                      <span className="myconv-tl-new" data-field={h.field_changed}>{h.new_value || '—'}</span>
                    ) : (
                      <>
                        <span className="myconv-tl-old">{h.old_value || '—'}</span>
                        {' → '}
                        <span className="myconv-tl-new" data-field={h.field_changed}>{h.new_value || '—'}</span>
                      </>
                    )}
                  </p>
                  {byLabel && <p className="myconv-tl-by">by {byLabel}</p>}
                  <p className="myconv-tl-date">{fmtDateTime(h.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, kind }) {
  return (
    <span className="nx-badge myconv-status" data-kind={kind} data-status={status}>
      {(status || '').replace(/_/g, ' ').toUpperCase()}
    </span>
  );
}

export function MyConversionsContent({ adminView = false, cpOnly = false }) {
  const user = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  // Source filter: Sales / CP / All (components/BookFilter).
  const [book, setBook] = useBook(cpOnly);
  const cqParts = [];
  if (companyId) cqParts.push(`company_id=${companyId}`);
  if (adminView) cqParts.push('admin_view=1');
  if (cpOnly) cqParts.push('cp_only=true');
  cqParts.push(`book=${book}`);
  const cq = cqParts.length ? `?${cqParts.join('&')}` : '';
  // Cancelling a booking lives on Bookings & Approvals — this page is read-only.
  const isStm = can(user, 'sales.pipeline.stm');
  const [tab, setTab] = useState('sv');
  // Deep-link to a tab (dashboard Closures card → ?tab=closures). Read in an
  // effect, not a lazy initializer — during client navigation window.location
  // isn't committed yet when the initializer runs.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'closures' || t === 'sv' || t === 'upcoming') setTab(t);
  }, []);
  const [historyLead, setHistoryLead] = useState(null); // { id, name, phone, project_name } | null

  const openLead = (row) => {
    if (row?.lead) setHistoryLead({ id: row.lead, name: row.lead_name, phone: row.lead_phone, project_name: row.project_name });
  };
  // Only a window of rows reaches the DOM; a thousand table rows is what made
  // this page crawl.
  const [shown, setShown] = useState(PAGE_STEP);
  const [search, setSearch] = useState('');
  // Narrowing the list and switching tabs both start a new list, so the window
  // goes back to the top — otherwise a search that matches 3 rows still reads
  // "Showing 50 of 3" from wherever the last one had been scrolled to.
  const [projF, setProjF] = useState([]);   // project names; empty = all
  const [stmF, setStmF] = useState([]);     // STM names; empty = all
  useEffect(() => { setShown(PAGE_STEP); }, [search, tab, projF, stmF]);
  const [visits, setVisits] = useState([]);
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [svRes, clRes] = await Promise.all([
        fetch(SALES_ENDPOINTS.siteVisits + cq, { headers: authHeaders() }),
        fetch(SALES_ENDPOINTS.closures + cq, { headers: authHeaders() }),
      ]);
      if (svRes.ok) setVisits(await svRes.json());
      if (clRes.ok) setClosures(await clRes.json());
    } catch (_) {}
    setLoading(false);
  }, [cq]);

  useEffect(() => { load(); }, [load]);

  const svCompleted = visits.filter(v => v.status === 'completed');
  // Visits still to happen, soonest first — what "Upcoming Visits" counts.
  const upcoming = visits.filter(v => v.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));
  // Each tab lists exactly what its card counts: the Site Visits tab used to show
  // every visit (scheduled, cancelled…) under a "Site Visits Done" number.
  // One box across every column a person would recognise a row by. Names are the
  // obvious one, but phone is what someone has in hand when a client rings back,
  // and STM/telecaller is how a manager narrows a long list to one person's work.
  const match = (row, needle) => [
    row.lead_name, row.lead_phone, row.project_name,
    row.stm_name, row.referred_by_telecaller_name,
    row.unit_type, row.unit_no,
  ].some((f) => String(f || '').toLowerCase().includes(needle));

  const q = search.trim().toLowerCase();
  const filter = (rows) => rows.filter((r) => (!q || match(r, q))
    && (!projF.length || projF.includes(r.project_name || '—'))
    && (!stmF.length || stmF.includes(r.stm_name || '—')));

  // The pickers offer only what this tab's rows hold — no project or STM that
  // would empty the list. A pick made on another tab stays listed so it can be
  // seen and cleared.
  const tabRows = tab === 'upcoming' ? upcoming : tab === 'closures' ? closures : svCompleted;
  const present = (key, picked) => [...new Set([...tabRows.map((r) => r[key] || '—'), ...picked])]
    .sort((a, b) => (a === '—') - (b === '—') || a.localeCompare(b))
    .map((n) => ({ value: n, label: n === '—' ? (key === 'stm_name' ? 'No STM' : 'No project') : n }));
  const projOptions = present('project_name', projF);
  const stmOptions = present('stm_name', stmF);

  const svRows = filter(tab === 'upcoming' ? upcoming : svCompleted);
  const allClosures = filter(closures);
  const loaderPad = { padding: '28px 0' };

  return (
    <div className="nx-page nx-page-center nx-w-lg">
      <div className="myconv-head">
        <h1 className="nx-page-title">My Conversions</h1>
        <p className="nx-page-sub">
          {isStm
            ? 'Track all your site visits and closures across the leads you handle'
            : 'Track site visits and closures from leads you referred to the sales team'}
        </p>
      </div>

      {/* Stats cards */}
      <div className="myconv-stats">
        <div className="myconv-stat is-sv">
          <div className="myconv-stat-value">{svCompleted.length}</div>
          <div className="myconv-stat-label">Site Visits Done</div>
        </div>
        <div className="myconv-stat is-closures">
          {/* The three cards are the totals for this person, so they stay put
              while a search narrows the table under them — `closures`, not the
              filtered `allClosures`, which would make the headline number
              flicker as you type. */}
          <div className="myconv-stat-value">{closures.length}</div>
          <div className="myconv-stat-label">Total Closures</div>
        </div>
        <div className="myconv-stat is-upcoming">
          <div className="myconv-stat-value">{upcoming.length}</div>
          <div className="myconv-stat-label">Upcoming Visits</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="book-row-plain">
        <BookFilter value={book} onChange={setBook} />
      </div>
      <div className="myconv-tabs">
        {[
          { key: 'sv', label: 'Site Visits' },
          { key: 'upcoming', label: 'Upcoming Visits' },
          { key: 'closures', label: 'Closures' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`myconv-tab${tab === t.key ? ' is-on' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="myconv-filters">
      <div className="nx-search-wrap myconv-search">
        <span className="nx-search-icon"><Icon name="search" /></span>
        <input className="nx-input nx-search-input" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lead, phone, project, STM or telecaller…" />
        {!!search && (
          <button type="button" className="myconv-search-clear" onClick={() => setSearch('')}
            aria-label="Clear search"><Icon name="x" /></button>
        )}
      </div>
        <MultiSelect allLabel="All Projects" noun="projects" value={projF} onChange={setProjF} options={projOptions} />
        <MultiSelect allLabel="All STMs" noun="STMs" value={stmF} onChange={setStmF} options={stmOptions} align="right" />
      </div>

      {loading ? (
        <Loader label="Loading…" style={loaderPad} />
      ) : tab === 'sv' || tab === 'upcoming' ? (
        <div className="nx-card myconv-card">
          {svRows.length === 0 ? (
            <div className="myconv-empty">
              {(q || projF.length || stmF.length)
                ? <>Nothing matches {search ? <b>{search}</b> : 'these filters'} in this tab.</>
                : tab === 'upcoming'
                  ? (isStm ? 'No visits scheduled.' : 'No visits scheduled for your referred leads.')
                  : (isStm ? 'No site visits recorded yet.' : 'No site visits completed for your referred leads yet.')}
            </div>
          ) : (<>
            <div className="myconv-scroll convScroll">
            <table className="nx-table myconv-table">
              <thead>
                <tr>
                  <th>Lead Name</th>
                  <th>Phone</th>
                  <th>Project</th>
                  <th>Visit Date</th>
                  <th>Status</th>
                  <th>STM</th>
                  <th>Telecaller</th>
                </tr>
              </thead>
              <tbody>
                {svRows.slice(0, shown).map(v => (
                  <tr key={v.id} onClick={() => openLead(v)} className="myconv-row">
                    <td><span className="myconv-name">{v.lead_name || '—'}</span></td>
                    <td className="myconv-muted">{v.lead_phone || '—'}</td>
                    <td>{v.project_name || '—'}</td>
                    <td>{v.visited_at ? fmtDate(v.visited_at) : (v.scheduled_at ? fmtDate(v.scheduled_at) : '—')}</td>
                    <td><StatusBadge status={v.status} kind="sv" /></td>
                    <td className="myconv-muted">{v.stm_name || '—'}</td>
                    <td className="myconv-muted">{v.referred_by_telecaller_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {svRows.length > shown && (
              <div className="nx-more">
                <span className="nx-more-count">Showing {shown} of {svRows.length}{(q || projF.length || stmF.length) ? ' matching' : ''}</span>
                <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setShown((n) => n + PAGE_STEP)}>Show more</button>
              </div>
            )}
          </>)}
        </div>
      ) : (
        <div className="nx-card myconv-card">
          {allClosures.length === 0 ? (
            <div className="myconv-empty">
              {(q || projF.length || stmF.length)
                ? <>Nothing matches {search ? <b>{search}</b> : 'these filters'} in this tab.</>
                : isStm ? 'No closures recorded yet.' : 'No closures from your referred leads yet.'}
            </div>
          ) : (<>
            <div className="myconv-scroll convScroll">
            <table className="nx-table myconv-table">
              <thead>
                <tr>
                  <th>Lead Name</th>
                  <th>Phone</th>
                  <th>Project</th>
                  <th>Unit</th>
                  <th>Amount</th>
                  <th>Closure Date</th>
                  <th>STM</th>
                  <th>Telecaller</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {/* A closure outlives its lead (trial reset) — no lead, no history to open. */}
                {allClosures.slice(0, shown).map(c => (
                  <tr key={c.id} onClick={() => openLead(c)} className={`myconv-row${c.lead ? '' : ' is-static'}`}>
                    <td><span className="myconv-name">{c.lead_name || '—'}</span></td>
                    <td className="myconv-muted">{c.lead_phone || '—'}</td>
                    <td>{c.project_name || '—'}</td>
                    <td>{(c.unit_type || '') + ' ' + (c.unit_no || '')}</td>
                    <td className="myconv-bold">{c.total_amount ? '₹' + new Intl.NumberFormat('en-IN').format(c.total_amount) : '—'}</td>
                    <td>{c.closure_date ? fmtDate(c.closure_date) : '—'}</td>
                    <td className="myconv-muted">{c.stm_name || '—'}</td>
                    <td className="myconv-muted">{c.referred_by_telecaller_name || '—'}</td>
                    <td><StatusBadge status={c.status} kind="closure" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {allClosures.length > shown && (
              <div className="nx-more">
                <span className="nx-more-count">Showing {shown} of {allClosures.length}{(q || projF.length || stmF.length) ? ' matching' : ''}</span>
                <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setShown((n) => n + PAGE_STEP)}>Show more</button>
              </div>
            )}
          </>)}
        </div>
      )}

      {/* A visible scrollbar — the default overlay one on macOS hides until you scroll,
          which makes a fixed-height table look truncated rather than scrollable. */}
      <style>{`
        .convScroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .convScroll::-webkit-scrollbar-track { background: var(--surface-2); border-radius: 8px; }
        .convScroll::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 8px; border: 2px solid var(--surface-2); }
        .convScroll::-webkit-scrollbar-thumb:hover { background: var(--primary); }
        .convScroll { scrollbar-width: thin; scrollbar-color: var(--border-strong) var(--surface-2); }
      `}</style>

      {historyLead && <LeadHistoryModal lead={historyLead} onClose={() => setHistoryLead(null)} />}
    </div>
  );
}

const PAGE_STEP = 50;

export default function MyConversionsPage() {
  return <MyConversionsContent />;
}
