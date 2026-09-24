'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { notFound } from 'next/navigation';
import { Plus, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { TASK_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import { companyParam } from '../_execution';

// Manage the containers tasks live in — create, rename, archive/restore, delete
// (delete is blocked server-side while a list still has tasks in it).
export default function TaskListsPage({ params }) {
  if (params.module !== 'execution') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [lists, setLists] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (companyId) params.set('company_id', companyId);
    if (showArchived) params.set('include_archived', 'true');
    apiFetch(`${TASK_ENDPOINTS.lists}?${params}`).then((r) => r.json()).then((d) => setLists(d.results || [])).catch(() => setLists([]));
  }, [companyId, showArchived]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true); setErr('');
    try {
      const r = await apiFetch(TASK_ENDPOINTS.lists, { method: 'POST', body: JSON.stringify({ name }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.detail || 'Could not create the list.'); setCreating(false); return; }
      setNewName('');
      load();
    } catch (_) { setErr('Could not create the list.'); }
    setCreating(false);
  }

  async function toggleArchive(list) {
    await apiFetch(TASK_ENDPOINTS.list(list.id), { method: 'PATCH', body: JSON.stringify({ archived: !list.archived }) });
    load();
  }

  async function remove(list) {
    if (!window.confirm(`Delete "${list.name}"?`)) return;
    const r = await apiFetch(TASK_ENDPOINTS.list(list.id), { method: 'DELETE' });
    if (r.status === 400) {
      const d = await r.json().catch(() => ({}));
      window.alert(d.detail || 'Could not delete this list.');
      return;
    }
    load();
  }

  return (
    <div className="nx-page">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Task Lists</h1>
          <p className="nx-page-sub">The containers tasks are organised into.</p>
        </div>
        <label className={`nx-check${showArchived ? ' is-on' : ''}`}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      <div className="nx-card ard-card">
        <div className="ard-card-head">
          <div className="ard-card-title">New list</div>
        </div>
        {err && <div className="nx-note bad">{err}</div>}
        <div className="nx-checklist-add">
          <input className="nx-input" value={newName} placeholder="e.g. Marketing, Onboarding, Q4 Launch…"
            onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <button className="nx-btn nx-btn-sm nx-btn-primary" disabled={creating} onClick={create}><Plus size={14} /> Add</button>
        </div>
      </div>

      {lists === null ? <Loader label="Loading task lists…" /> : lists.length === 0 ? (
        <div className="ar-empty">No task lists yet — add one above.</div>
      ) : lists.map((l) => (
        <div key={l.id} className="nx-task-list-row">
          <div>
            <div className="nx-task-title">{l.name}{l.archived && <span className="nx-badge tone-muted"> Archived</span>}</div>
            <div className="nx-task-due">Created by {l.created_by || '—'}</div>
          </div>
          <div className="nx-seg">
            <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => toggleArchive(l)}>
              {l.archived ? <><ArchiveRestore size={14} /> Restore</> : <><Archive size={14} /> Archive</>}
            </button>
            <button className="nx-btn nx-btn-sm nx-btn-danger-soft" onClick={() => remove(l)}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
