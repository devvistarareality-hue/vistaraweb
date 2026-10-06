'use client';
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { SALES_ENDPOINTS, authHeaders } from '../../../constants/api';
import DateFilter from '../_DateFilter';


import Icon from '../../../components/Icon';
import { can } from '../../../lib/moduleAccess';
import MultiSelect from '../../../components/MultiSelect';
import Loader from '../../../components/Loader';
import BookFilter, { useBook } from '../../../components/BookFilter';
import { explainApiError, explainNetworkError } from '../../../lib/apiError';
import { downloadExcel, canExportLeads } from '../../../lib/downloadExcel';
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const SV_COLOR = { scheduled: 'var(--warning-2)', completed: 'var(--success)', no_show: 'var(--danger)', cancelled: 'var(--muted)' };
const OUTCOME_COLOR = { hot: 'var(--danger)', warm: 'var(--warning-2)', cold: 'var(--accent)', not_interested: 'var(--text-3)' };
const OUTCOME_LABEL = { hot: 'Hot', warm: 'Warm', cold: 'Cold', not_interested: 'Not Interested' };
const PAGE_STEP = 50;
const TABS = [
  { key: 'today',     label: "Today's" },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'no_show',   label: 'No Show' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all',       label: 'All' },
];

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const endOfToday   = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };

const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4, display: 'block' };
const inp = { width: '100%', height: 40, padding: '0 12px', borderRadius: 14, border: '1.5px solid var(--border)', fontSize: 13, boxSizing: 'border-box', outline: 'none', background: 'var(--surface-2)' };
const btnPrimary = { padding: '9px 16px', background: 'var(--strong)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const smBtn = (bg, color, border) => ({ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${border}`, color, background: bg, cursor: 'pointer' });

export function SiteVisitsContent({ adminView = false, cpOnly = false }) {
  const router    = useRouter();
  // Source filter: Sales / CP / All (components/BookFilter).
  const [book, setBook] = useBook(cpOnly);
  const user      = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);

  // Record Closure now opens the project picker → unit map flow. Stash the site
  // visit so the closure step can POST against the right lead/SV after the STM
  // picks an available unit. sessionStorage survives the client-side navigation.
  function startClosure(sv) {
    try { sessionStorage.setItem('closure_sv', JSON.stringify(sv)); } catch (_) {}
    router.push(`/sales/closure?sv=${sv.id}`);
  }
  const [visits,  setVisits]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('today');
  const [range,   setRange]   = useState({ from: '', to: '' });   // visit date
  const [proj,    setProj]    = useState([]);                     // [] = every project
  const [outcomeFilter, setOutcomeFilter] = useState('');         // '' = every outcome
  const [searchText, setSearchText] = useState('');               // '' = every name/phone
  const [tcPerson,  setTcPerson]  = useState([]);                 // [] = every telecaller
  const [stmPerson, setStmPerson] = useState([]);                 // [] = every STM
  // Allow deep-linking to a tab (e.g. dashboard Site Visits card → ?tab=completed).
  // Read in an effect — window.location isn't committed yet when a lazy useState
  // initializer runs during Next client navigation.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (['today', 'scheduled', 'completed', 'no_show', 'cancelled', 'all'].includes(t)) setFilter(t);
  }, []);

  // schedule modal
  const [schedOpen, setSchedOpen] = useState(false);
  const [leads,     setLeads]     = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [form,      setForm]      = useState({ lead: '', project: '', scheduled_at: '' });
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  // closure modal
  const [closureSv, setClosureSv] = useState(null);
  const [closure,   setClosure]   = useState({ closure_date: new Date().toISOString().slice(0, 10), unit_no: '', unit_type: '', booking_amount: '', total_amount: '', remarks: '' });

  // "Mark Done" modal — outcome + remarks are required before a visit can be closed out.
  const [doneSv,   setDoneSv]   = useState(null);
  const [doneForm, setDoneForm] = useState({ outcome: '', remarks: '', visitedDate: '' });

  // "Edit visit" — correct a completed visit's date, outcome or remarks. Offered when
  // the server says this person may (sv.can_edit: the STM, their managers, admins).
  const [editSv,   setEditSv]   = useState(null);
  const [editForm, setEditForm] = useState({ visitedDate: '', outcome: '', remarks: '', reason: '' });
  const [editErr,  setEditErr]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = [];
      if (adminView) params.push('admin_view=1');
      if (cpOnly)    params.push('cp_only=true');
      params.push(`book=${book}`);
      const url = params.length ? `${SALES_ENDPOINTS.siteVisits}?${params.join('&')}` : SALES_ENDPOINTS.siteVisits;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) setVisits(await res.json());
    } catch (_) {}
    setLoading(false);
  }, [companyId, adminView, cpOnly, book]);

  useEffect(() => { load(); }, [load]);

  async function openSchedule() {
    setErr('');
    setForm({ lead: '', project: '', scheduled_at: '' });
    setSchedOpen(true);
    // Load the STM's own leads + active projects for the pickers
    try {
      const [lRes, pRes] = await Promise.all([
        fetch(`${SALES_ENDPOINTS.leads}?page=1`, { headers: authHeaders() }),
        fetch(SALES_ENDPOINTS.projects, { headers: authHeaders() }),
      ]);
      if (lRes.ok) { const d = await lRes.json(); setLeads(Array.isArray(d) ? d : (d.results || [])); }
      if (pRes.ok) { const d = await pRes.json(); setProjects(Array.isArray(d) ? d : (d.results || [])); }
    } catch (_) {}
  }

  async function scheduleVisit() {
    if (!form.lead || !form.scheduled_at) { setErr('Lead and date & time are required.'); return; }
    setSaving(true); setErr('');
    const lead = leads.find((l) => String(l.id) === String(form.lead));
    try {
      const res = await fetch(SALES_ENDPOINTS.siteVisits, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          lead: form.lead,
          project: form.project || null,
          scheduled_at: form.scheduled_at,
          status: 'scheduled',
          stm: user?.id,
          referred_by_telecaller: lead?.telecaller || null,
        }),
      });
      if (res.ok) {
        // Keep the lead pipeline in sync
        await fetch(SALES_ENDPOINTS.lead(form.lead), {
          method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ stm_status: 'sv_scheduled' }),
        }).catch(() => {});
        setSchedOpen(false);
        load();
      } else {
        setErr(JSON.stringify(await res.json().catch(() => ({}))));
      }
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  async function updateStatus(sv, status) {
    const body = { status };
    const res = await fetch(SALES_ENDPOINTS.siteVisit(sv.id), {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setVisits((list) => list.map((v) => (v.id === sv.id ? updated : v)));
    }
  }

  function openEdit(sv) {
    const d = sv.visited_at ? new Date(sv.visited_at).toLocaleDateString('en-CA') : '';
    setEditForm({ visitedDate: d, outcome: sv.outcome || '', remarks: sv.remarks || '', reason: '' });
    setEditErr(''); setEditSv(sv);
  }

  async function submitEdit() {
    if (!editForm.reason.trim()) { setEditErr('Say why the visit is being changed.'); return; }
    setSaving(true); setEditErr('');
    try {
      const res = await fetch(SALES_ENDPOINTS.siteVisitEdit(editSv.id), {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          visited_at: editForm.visitedDate, outcome: editForm.outcome,
          remarks: editForm.remarks, reason: editForm.reason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setVisits((list) => list.map((v) => (v.id === data.id ? data : v)));
        setEditSv(null);
      } else {
        setEditErr(explainApiError(res, data, 'Could not save the visit.'));
      }
    } catch (e) { setEditErr(explainNetworkError(e)); }
    setSaving(false);
  }

  function openDone(sv) {
    setErr('');
    setDoneForm({ outcome: '', remarks: '', visitedDate: new Date().toLocaleDateString('en-CA') });
    setDoneSv(sv);
  }

  // Keeps the current time-of-day (so same-day orders still make sense) but lets
  // the date itself be backdated to when the visit actually happened.
  function visitedAtFromDate(dateStr) {
    const now = new Date();
    const d = new Date(`${dateStr}T00:00:00`);
    d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    return d.toISOString();
  }

  async function submitDone() {
    if (!doneForm.outcome || !doneForm.remarks.trim() || !doneForm.visitedDate) {
      setErr('Outcome, visit date and remarks are required to mark a visit as done.');
      return;
    }
    setSaving(true); setErr('');
    try {
      const res = await fetch(SALES_ENDPOINTS.siteVisit(doneSv.id), {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({
          status: 'completed', visited_at: visitedAtFromDate(doneForm.visitedDate),
          outcome: doneForm.outcome, remarks: doneForm.remarks.trim(),
        }),
      });
      if (res.ok) {
        // The server moves the lead to SV Done itself when a visit completes (and
        // leaves a lead that has already moved on, e.g. booked, where it is). The
        // outcome stays on the SiteVisit, not in the lead's own STM Status.
        const updated = await res.json();
        setVisits((list) => list.map((v) => (v.id === updated.id ? updated : v)));
        setDoneSv(null);
      } else {
        setErr(JSON.stringify(await res.json().catch(() => ({}))));
      }
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  async function recordClosure() {
    if (!closure.booking_amount) { setErr('Booking amount is required.'); return; }
    setSaving(true); setErr('');
    const sv = closureSv;
    try {
      const res = await fetch(SALES_ENDPOINTS.closures, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          lead: sv.lead, site_visit: sv.id, project: sv.project || null,
          stm: sv.stm || user?.id, referred_by_telecaller: sv.referred_by_telecaller || null,
          status: 'booked',
          closure_date: closure.closure_date,
          unit_no: closure.unit_no, unit_type: closure.unit_type,
          booking_amount: closure.booking_amount,
          total_amount: closure.total_amount || null,
          remarks: closure.remarks,
        }),
      });
      if (res.ok) {
        await fetch(SALES_ENDPOINTS.lead(sv.lead), {
          method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ stm_status: 'closed' }),
        }).catch(() => {});
        setClosureSv(null);
        setClosure({ closure_date: new Date().toISOString().slice(0, 10), unit_no: '', unit_type: '', booking_amount: '', total_amount: '', remarks: '' });
        load();
      } else {
        setErr(JSON.stringify(await res.json().catch(() => ({}))));
      }
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  // A visit's own date: when it actually happened if it has, otherwise when it is due.
  // That way Completed filters by the visit date and Scheduled by the due date, without
  // a second control asking which one you meant. Sliced from the ISO stamp in local
  // time so an evening visit doesn't fall into the next day.
  const visitDay = (v) => {
    const s = v.visited_at || v.scheduled_at;
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d) ? String(s).slice(0, 10) : d.toLocaleDateString('en-CA');
  };
  const dated = !!(range.from || range.to);
  const inRange = (v) => {
    if (!dated) return true;
    const d = visitDay(v);
    if (!d) return false;
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  };
  // Options come from every visit, not the filtered set, so picking a project never
  // removes the other projects from the dropdown.
  const projName = (v) => v.project_name || '—';
  const projOptions = [...new Set(visits.map(projName))].sort((a, b) => a.localeCompare(b));
  const q = searchText.trim().toLowerCase();
  // Telecaller / STM pickers for manager-level viewers — the Follow-Ups rule: anyone
  // who isn't a telecaller, STM or CP. Options come from every visit, like projects.
  const isAdminMgr = !can(user, 'sales.pipeline.telecalling') && !can(user, 'sales.pipeline.stm')
    && !can(user, 'sales.pipeline.cp') && !can(user, 'sales.pipeline.cp_manager');
  const peopleOf = (idKey, nameKey) => {
    const m = new Map();
    visits.forEach((v) => { if (v[idKey]) m.set(String(v[idKey]), v[nameKey] || `#${v[idKey]}`); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  };
  const tcOptions  = isAdminMgr ? peopleOf('referred_by_telecaller', 'referred_by_telecaller_name') : [];
  const stmOptions = isAdminMgr ? peopleOf('stm', 'stm_name') : [];
  const narrowed = dated || proj.length > 0 || !!outcomeFilter || !!q || tcPerson.length > 0 || stmPerson.length > 0;

  // Download Excel: the completed visits, with exactly the filters set above. The
  // screen filters on the device, so they are sent along for the server to apply.
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState('');
  const [exportProgress, setExportProgress] = useState('');
  async function exportVisits() {
    setExporting(true); setExportErr('');
    const p = new URLSearchParams({ export: 'xlsx', book });
    if (cpOnly) p.set('cp_only', 'true');
    if (adminView) p.set('admin_view', '1');
    if (range.from) p.set('date_from', range.from);
    if (range.to) p.set('date_to', range.to);
    if (proj.length) p.set('projects', proj.join('||'));
    if (stmPerson.length) p.set('stm_ids', stmPerson.join(','));
    if (tcPerson.length) p.set('telecaller_ids', tcPerson.join(','));
    if (outcomeFilter) p.set('outcome', outcomeFilter);
    if (q) p.set('q', q);
    const err = await downloadExcel(`${SALES_ENDPOINTS.siteVisits}?${p}`, 'Site-Visits.xlsx',
      (done, total) => setExportProgress(`${done.toLocaleString('en-IN')} of ${(total || 0).toLocaleString('en-IN')}`));
    setExporting(false); setExportProgress('');
    if (err) setExportErr(err);
  }

  const [shown, setShown] = useState(PAGE_STEP);
  const visible = visits.filter((v) => {
    if (!inRange(v)) return false;
    if (proj.length && !proj.includes(projName(v))) return false;
    if (outcomeFilter && v.outcome !== outcomeFilter) return false;
    if (tcPerson.length && !tcPerson.includes(String(v.referred_by_telecaller || ''))) return false;
    if (stmPerson.length && !stmPerson.includes(String(v.stm || ''))) return false;
    if (q) {
      const name  = (v.lead_name  || '').toLowerCase();
      const phone = (v.lead_phone || '').toLowerCase();
      if (!name.includes(q) && !phone.includes(q)) return false;
    }
    if (filter === 'all') return true;
    if (filter === 'today') {
      const at = new Date(v.scheduled_at);
      return v.status === 'scheduled' && at >= startOfToday() && at <= endOfToday();
    }
    return v.status === filter;
  });

  return (
    <div className="nx-page nx-page-center nx-w-md">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Site Visits</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>{visible.length} visit{visible.length === 1 ? '' : 's'}</p>
        </div>
        <div className="sv-head-actions">
          {canExportLeads(user) && (
            <button type="button" className="nx-btn nx-btn-md nx-btn-success" onClick={exportVisits} disabled={exporting}
              title="Completed visits, with the filters below, as Excel">
              <Icon name="download" /> {exporting ? `Preparing…${exportProgress ? ` ${exportProgress}` : ''}` : 'Download Excel'}
            </button>
          )}
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={openSchedule} style={btnPrimary}>+ Schedule Visit</button>
        </div>
      </div>
      {exportErr && <div className="nx-note bad sv-export-err">{exportErr}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--surface-3)', margin: '18px 0 20px', overflowX: 'auto' }}>
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', whiteSpace: 'nowrap',
                color: active ? 'var(--accent)' : 'var(--muted)', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Source: Sales / CP / All — counts always add up (see BookFilter). */}
      <div className="book-row-plain">
        <BookFilter value={book} onChange={setBook} />
      </div>

      {/* Search bar */}
      <div className="nx-search-wrap nx-mb-14">
        <span className="nx-search-icon"><Icon name="search" /></span>
        <input className="nx-input nx-search-input" value={searchText} onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search name, phone…" />
      </div>

      {/* Visit date + project. The date control is the one the dashboards use, so its
          Month / Quarter / FY choices mean the same thing here. */}
      <DateFilter onChange={setRange} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: -10, marginBottom: 16 }}>
        {projOptions.length > 1 && (
          <MultiSelect allLabel="All Projects" noun="projects" value={proj} onChange={setProj}
            options={projOptions.map((n) => ({ value: n, label: n === '—' ? 'No project' : n }))} />
        )}
        {tcOptions.length > 0 && (
          <MultiSelect allLabel="All Telecallers" noun="telecallers" value={tcPerson} onChange={setTcPerson}
            options={tcOptions.map(([id, name]) => ({ value: id, label: name }))} />
        )}
        {stmOptions.length > 0 && (
          <MultiSelect allLabel="All STMs" noun="STMs" value={stmPerson} onChange={setStmPerson}
            options={stmOptions.map(([id, name]) => ({ value: id, label: name }))} />
        )}
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', letterSpacing: 0.6, marginLeft: 4 }}>OUTCOME</span>
        {['', 'hot', 'warm', 'cold', 'not_interested'].map((val) => {
          const active = outcomeFilter === val;
          const color = val ? OUTCOME_COLOR[val] : 'var(--text-3)';
          const label = val ? OUTCOME_LABEL[val] : 'All';
          return (
            <button className={`nx-btn nx-btn-sm nx-toggle${active ? ' is-on' : ''}`} key={val || 'all'} onClick={() => setOutcomeFilter(val)}
              style={{ padding: '6px 12px', borderRadius: 18, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${color}`, background: active ? color : 'var(--surface)', color: active ? '#fff' : color }}>
              {label}
            </button>
          );
        })}
        {narrowed && (
          <button className="nx-btn nx-btn-sm nx-btn-secondary nx-clear-filters-btn" onClick={() => { setProj([]); setOutcomeFilter(''); setSearchText(''); setTcPerson([]); setStmPerson([]); }}>
            <Icon name="x" /> Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <Loader label="Loading…" style={{ padding: '28px 0' }} />
      ) : visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-3)', margin: 0 }}>{narrowed ? 'No site visits match these filters' : 'No site visits'}</p>
          <p style={{ fontSize: 13, color: 'var(--faint)', margin: '4px 0 0' }}>Schedule one from your pipeline</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visible.slice(0, shown).map((sv) => (
            <div className="nx-card" key={sv.id} style={{ border: '1.5px solid var(--surface-3)', background: 'var(--surface)', borderRadius: 16, padding: '14px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{sv.lead_name || 'Lead'}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 14, textTransform: 'capitalize',
                    backgroundColor: `color-mix(in srgb, ${(SV_COLOR[sv.status] || 'var(--muted-solid)')} 9%, transparent)`, color: SV_COLOR[sv.status] || 'var(--muted)' }}>
                    {(sv.status || '').replace('_', ' ')}
                  </span>
                  {sv.outcome && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 14,
                      backgroundColor: `color-mix(in srgb, ${(OUTCOME_COLOR[sv.outcome] || 'var(--muted-solid)')} 9%, transparent)`, color: OUTCOME_COLOR[sv.outcome] || 'var(--muted)' }}>
                      {OUTCOME_LABEL[sv.outcome] || sv.outcome}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                  {sv.lead_phone || ''}{sv.project_name ? ` · ${sv.project_name}` : ''}
                </p>
                {sv.referred_by_telecaller_name && <p style={{ fontSize: 11, color: 'var(--faint)', margin: '2px 0 0' }}>via TC: {sv.referred_by_telecaller_name}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                  <span>Scheduled: {fmtDateTime(sv.scheduled_at)}</span>
                  {sv.visited_at && <span>Visited: {fmtDateTime(sv.visited_at)}</span>}
                </div>
                {sv.remarks && <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '6px 0 0', fontStyle: 'italic' }}>"{sv.remarks}"</p>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0 }}>
                {sv.status === 'scheduled' && (
                  <>
                    <button onClick={() => openDone(sv)} style={smBtn('#fff', 'var(--success)', 'var(--success)')}><Icon name="check" /> Done</button>
                    <button onClick={() => updateStatus(sv, 'no_show')} style={smBtn('#fff', 'var(--warning)', 'var(--warning-2)')}>No Show</button>
                    <button onClick={() => updateStatus(sv, 'cancelled')} style={smBtn('#fff', 'var(--faint)', 'var(--border-strong)')}>Cancel</button>
                  </>
                )}
                {sv.status === 'completed' && (
                  <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => startClosure(sv)} style={btnPrimary}>Record Closure</button>
                )}
                {sv.status === 'completed' && sv.can_edit && (
                  <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary sve-open" onClick={() => openEdit(sv)}>
                    <Icon name="pencil" /> Edit visit
                  </button>
                )}
              </div>
            </div>
          ))}
          {visible.length > shown && (
            <div className="nx-more">
              <span className="nx-more-count">Showing {shown} of {visible.length}</span>
              <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setShown((n) => n + PAGE_STEP)}>Show more</button>
            </div>
          )}
        </div>
      )}

      {/* ── Schedule Modal ── */}
      {schedOpen && (
        <Overlay onClose={() => setSchedOpen(false)}>
          <ModalCard title="Schedule Site Visit" onClose={() => setSchedOpen(false)}>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Lead *</label>
              <select className="nx-input" value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Select lead</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Project</label>
              <select className="nx-input" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">Select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Date &amp; Time *</label>
              <input className="nx-input" type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} style={inp} />
            </div>
            {err && <ErrBox>{err}</ErrBox>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setSchedOpen(false)} style={{ padding: '9px 16px', background: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button className="nx-btn nx-btn-md nx-btn-primary" onClick={scheduleVisit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Schedule'}</button>
            </div>
          </ModalCard>
        </Overlay>
      )}

      {/* ── Mark Done Modal ── */}
      {doneSv && (
        <Overlay onClose={() => setDoneSv(null)}>
          <ModalCard title="Mark Site Visit Done" onClose={() => setDoneSv(null)}>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>{doneSv.lead_name} · {doneSv.lead_phone}</p>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Outcome *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['hot', 'Hot', 'var(--danger)'], ['warm', 'Warm', 'var(--warning-2)'], ['cold', 'Cold', 'var(--accent)'], ['not_interested', 'Not Interested', 'var(--text-3)']].map(([val, label, color]) => {
                  const active = doneForm.outcome === val;
                  return (
                    <button className={`nx-btn nx-btn-md nx-toggle${active ? ' is-on' : ''}`} key={val} type="button" onClick={() => setDoneForm({ ...doneForm, outcome: val })}
                      style={{ flex: '1 1 100px', padding: '10px 8px', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${color}`, background: active ? color : 'var(--surface)', color: active ? '#fff' : color }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Visit Date *</label>
              <input className="nx-input" type="date" value={doneForm.visitedDate} max={new Date().toLocaleDateString('en-CA')}
                onChange={(e) => setDoneForm({ ...doneForm, visitedDate: e.target.value })} style={inp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Remarks *</label>
              <textarea className="nx-input" value={doneForm.remarks} onChange={(e) => setDoneForm({ ...doneForm, remarks: e.target.value })} rows={3}
                style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} placeholder="What happened on the visit…" />
            </div>
            {err && <ErrBox>{err}</ErrBox>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setDoneSv(null)} style={{ padding: '9px 16px', background: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button className="nx-btn nx-btn-md nx-btn-primary" onClick={submitDone} disabled={saving || !doneForm.outcome || !doneForm.remarks.trim() || !doneForm.visitedDate}
                style={{ ...btnPrimary, opacity: (saving || !doneForm.outcome || !doneForm.remarks.trim() || !doneForm.visitedDate) ? 0.5 : 1 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </ModalCard>
        </Overlay>
      )}

      {/* ── Edit Visit Modal ── */}
      {editSv && (
        <Overlay onClose={() => !saving && setEditSv(null)}>
          <ModalCard title="Edit site visit" onClose={() => !saving && setEditSv(null)}>
            <p className="sve-sub">{editSv.lead_name} · {editSv.lead_phone}{editSv.stm_name ? ` · ${editSv.stm_name}` : ''}</p>
            <label className="sve-lbl">Visit date</label>
            <input className="nx-input sve-inp" type="date" value={editForm.visitedDate} max={new Date().toLocaleDateString('en-CA')}
              onChange={(e) => setEditForm({ ...editForm, visitedDate: e.target.value })} />
            <label className="sve-lbl">Outcome</label>
            <div className="sve-outs">
              {[['hot', 'Hot'], ['warm', 'Warm'], ['cold', 'Cold'], ['not_interested', 'Not Interested']].map(([val, label]) => (
                <button key={val} type="button" data-out={val} className={`sve-out${editForm.outcome === val ? ' is-on' : ''}`}
                  onClick={() => setEditForm({ ...editForm, outcome: val })}>{label}</button>
              ))}
            </div>
            <label className="sve-lbl">Remarks</label>
            <textarea className="nx-input sve-inp sve-area" rows={3} value={editForm.remarks}
              onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} />
            <label className="sve-lbl">Why are you changing it? *</label>
            <input className="nx-input sve-inp" value={editForm.reason} placeholder="e.g. Picked the wrong date"
              onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} />
            <p className="sve-note">The change and your reason are saved on the lead&apos;s history and the activity log.</p>
            {editErr && <ErrBox>{editErr}</ErrBox>}
            <div className="sve-foot">
              <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setEditSv(null)} disabled={saving}>Cancel</button>
              <button type="button" className="nx-btn nx-btn-md nx-btn-primary" onClick={submitEdit}
                disabled={saving || !editForm.reason.trim() || !editForm.visitedDate}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </ModalCard>
        </Overlay>
      )}

      {/* ── Closure Modal ── */}
      {closureSv && (
        <Overlay onClose={() => setClosureSv(null)}>
          <ModalCard title="Record Closure" onClose={() => setClosureSv(null)}>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px' }}>{closureSv.lead_name} · {closureSv.lead_phone}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px', marginBottom: 12 }}>
              <div>
                <label style={lbl}>Closure Date *</label>
                <input className="nx-input" type="date" value={closure.closure_date} onChange={(e) => setClosure({ ...closure, closure_date: e.target.value })} style={inp} />
              </div>
              <div>
                <label style={lbl}>Unit No.</label>
                <input className="nx-input" value={closure.unit_no} onChange={(e) => setClosure({ ...closure, unit_no: e.target.value })} style={inp} placeholder="A-101" />
              </div>
              <div>
                <label style={lbl}>Unit Type</label>
                <input className="nx-input" value={closure.unit_type} onChange={(e) => setClosure({ ...closure, unit_type: e.target.value })} style={inp} placeholder="2BHK" />
              </div>
              <div>
                <label style={lbl}>Booking Amount *</label>
                <input className="nx-input" type="number" value={closure.booking_amount} onChange={(e) => setClosure({ ...closure, booking_amount: e.target.value })} style={inp} placeholder="₹" />
              </div>
              <div>
                <label style={lbl}>Total Amount</label>
                <input className="nx-input" type="number" value={closure.total_amount} onChange={(e) => setClosure({ ...closure, total_amount: e.target.value })} style={inp} placeholder="₹" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Remarks</label>
              <textarea className="nx-input" value={closure.remarks} onChange={(e) => setClosure({ ...closure, remarks: e.target.value })} rows={2}
                style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} placeholder="Notes…" />
            </div>
            {err && <ErrBox>{err}</ErrBox>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setClosureSv(null)} style={{ padding: '9px 16px', background: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button className="nx-btn nx-btn-md nx-btn-success" onClick={recordClosure} disabled={saving} style={{ padding: '9px 16px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Record Closure'}</button>
            </div>
          </ModalCard>
        </Overlay>
      )}
    </div>
  );
}

export default function SiteVisitsPage() {
  return <SiteVisitsContent />;
}

function Overlay({ children, onClose }) {
  return (
    <div className="nx-modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {children}
    </div>
  );
}

function ModalCard({ title, children, onClose }) {
  return (
    <div className="nx-card" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, width: '92%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(var(--ink-rgb),0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--surface-2)' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{title}</span>
        <button className="nx-btn nx-btn-lg nx-icon-btn nx-btn-ghost" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--faint)', cursor: 'pointer' }}><Icon name="x" /></button>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function ErrBox({ children }) {
  return <div style={{ backgroundColor: 'var(--danger-soft)', border: '1px solid var(--danger-2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--danger)', wordBreak: 'break-word' }}>{children}</div>;
}
