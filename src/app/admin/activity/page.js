'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Filter, Layers, User } from 'lucide-react';
import { ACTIVITY_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import Loader from '../../../components/Loader';
import Dropdown from '../../../components/Dropdown';
import { ActivityRows } from '../../../components/ActivityHistory';

const ACTIONS = [
  { value: '', label: 'Any action' },
  { value: 'created', label: 'Created' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'updated', label: 'Edited' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'deleted', label: 'Deleted' },
];

// Every change anyone made, newest first — who, in which module, to what.
export default function ActivityLogPage() {
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [f, setF] = useState({ module: '', actor: '', action: '', from: '', to: '', q: '' });
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({ modules: [], actors: [], can_see_all: false });
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState('');

  // Typing searches after a pause, not on every key.
  useEffect(() => { const t = setTimeout(() => setF((x) => ({ ...x, q })), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [f, companyId]);

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ page: String(page) });
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v); });
    if (companyId) qs.set('company_id', companyId);
    if (page === 1) setRows(null);
    setErr('');
    apiFetch(`${ACTIVITY_ENDPOINTS.log}?${qs}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) { setErr(d.detail || 'Could not load the activity log.'); setRows([]); return; }
        setRows((prev) => (page === 1 ? d.results : [...(prev || []), ...d.results]));
        setMore(!!d.has_more);
        if (page === 1) setMeta({ modules: d.modules || [], actors: d.actors || [], can_see_all: d.can_see_all });
      })
      .catch(() => { if (alive) { setErr('Could not load the activity log. Check your connection.'); setRows([]); } });
    return () => { alive = false; };
  }, [f, page, companyId]);

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="nx-page">
      <h1 className="nx-page-title">Activity Log</h1>
      <p className="nx-page-sub">
        {meta.can_see_all ? 'Every change made in Nexora — who did it, where and when.' : 'Everything you have changed in Nexora.'}
      </p>

      <div className="ar-filters">
        <Dropdown value={f.module} onChange={set('module')} ariaLabel="Module" icon={<Layers size={15} />}
          options={[{ value: '', label: 'All modules' }, ...meta.modules.map((m) => ({ value: m, label: m }))]} />
        {meta.can_see_all && (
          <Dropdown value={f.actor} onChange={set('actor')} searchable ariaLabel="Person" icon={<User size={15} />}
            options={[{ value: '', label: 'Everyone' }, ...meta.actors.map((a) => ({ value: String(a.id), label: a.name || '—' }))]} />
        )}
        <Dropdown value={f.action} onChange={set('action')} ariaLabel="Action" icon={<Filter size={15} />} options={ACTIONS} />
        <input type="date" className="nx-input nx-input-sm" aria-label="From" value={f.from} onChange={(e) => set('from')(e.target.value)} />
        <input type="date" className="nx-input nx-input-sm" aria-label="To" value={f.to} onChange={(e) => set('to')(e.target.value)} />
        <input className="nx-input nx-input-sm ar-search" placeholder="Search — client, plot, person…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="nx-card act-card">
        {err && <div className="nx-note bad">{err}</div>}
        {rows === null ? <Loader label="Loading…" /> : <ActivityRows rows={rows} />}
        {more && (
          <div className="act-more">
            <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setPage((p) => p + 1)}>Load more</button>
          </div>
        )}
      </div>
    </div>
  );
}
