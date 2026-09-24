'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { notFound } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import { TASK_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import TaskModal from '../_TaskModal';
import { STATUSES, PRIORITIES, STATUS_LABEL, PRIORITY_LABEL, fmtDate, isOverdue, companyParam } from '../_execution';

const PAGE_STEP = 50;

// The filterable Task list — same filter-bar shape as the Sales Leads/Follow-Ups
// lists (search, then a row of dropdowns, then a Clear-all button).
export default function TaskListPage({ params }) {
  if (params.module !== 'execution') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);

  const [lists, setLists] = useState([]);
  const [people, setPeople] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(PAGE_STEP);

  const [searchText, setSearchText] = useState('');
  const [listFilter, setListFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [myTasks, setMyTasks] = useState(false);
  const [assignedByMe, setAssignedByMe] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [openTaskId, setOpenTaskId] = useState(undefined); // undefined = closed, null = create

  // Deep links from the dashboard KPI tiles.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('my_tasks') === 'true') setMyTasks(true);
    if (p.get('assigned_by_me') === 'true') setAssignedByMe(true);
    if (p.get('overdue') === 'true') setOverdueOnly(true);
  }, []);

  const loadMeta = useCallback(() => {
    const q = companyParam(companyId);
    apiFetch(`${TASK_ENDPOINTS.lists}${q ? `?${q}` : ''}`).then((r) => r.json()).then((d) => setLists(d.results || [])).catch(() => {});
    apiFetch(`${TASK_ENDPOINTS.assignees}${q ? `?${q}` : ''}`).then((r) => r.json()).then((d) => setPeople(d.results || [])).catch(() => {});
  }, [companyId]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const loadTasks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (companyId) params.set('company_id', companyId);
    if (listFilter) params.set('task_list_id', listFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (assigneeFilter) params.set('assignee_id', assigneeFilter);
    if (myTasks) params.set('my_tasks', 'true');
    if (assignedByMe) params.set('assigned_by_me', 'true');
    if (overdueOnly) params.set('overdue', 'true');
    if (searchText.trim()) params.set('search', searchText.trim());
    apiFetch(`${TASK_ENDPOINTS.tasks}?${params}`).then((r) => r.json())
      .then((d) => setTasks(d.results || []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [companyId, listFilter, statusFilter, priorityFilter, assigneeFilter, myTasks, assignedByMe, overdueOnly, searchText]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  const anyFilter = !!(searchText || listFilter || statusFilter || priorityFilter || assigneeFilter || myTasks || assignedByMe || overdueOnly);
  const clearAll = () => {
    setSearchText(''); setListFilter(''); setStatusFilter(''); setPriorityFilter('');
    setAssigneeFilter(''); setMyTasks(false); setAssignedByMe(false); setOverdueOnly(false);
  };

  const fSel = {
    height: 36, padding: '0 10px', borderRadius: 8,
    border: '1.5px solid var(--surface-3)', fontSize: 12, background: 'var(--surface-2)',
    cursor: 'pointer', outline: 'none', color: 'var(--text)', fontWeight: 500,
  };
  const activeSelStyle = (val) => val ? { ...fSel, borderColor: 'var(--accent)', background: 'var(--accent-softer)', color: 'var(--accent)', fontWeight: 600 } : fSel;

  return (
    <div className="nx-page">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Tasks</h1>
          <p className="nx-page-sub">{tasks.length} task{tasks.length === 1 ? '' : 's'}</p>
        </div>
        <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => setOpenTaskId(null)}><Plus size={15} /> New Task</button>
      </div>

      <div className="nx-card nx-fu-filterbar">
        <div className="nx-fu-filterbar-search">
          <div className="nx-search-wrap">
            <span className="nx-search-icon"><Search size={15} /></span>
            <input className="nx-input nx-search-input" value={searchText} onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search task title…" />
          </div>
        </div>
        <div className="nx-fu-filterbar-row">
          <select value={listFilter} onChange={(e) => setListFilter(e.target.value)} style={activeSelStyle(listFilter)}>
            <option value="">All Task Lists</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={activeSelStyle(statusFilter)}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={activeSelStyle(priorityFilter)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} style={activeSelStyle(assigneeFilter)}>
            <option value="">All Assignees</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {anyFilter && (
            <button className="nx-btn nx-btn-sm nx-btn-danger-soft nx-ml-auto" onClick={clearAll}><X size={13} /> Clear all</button>
          )}
        </div>
        <div className="nx-fu-filterbar-row">
          <label className={`nx-check${myTasks ? ' is-on' : ''}`}>
            <input type="checkbox" checked={myTasks} onChange={(e) => setMyTasks(e.target.checked)} />
            My tasks
          </label>
          <label className={`nx-check${assignedByMe ? ' is-on' : ''}`}>
            <input type="checkbox" checked={assignedByMe} onChange={(e) => setAssignedByMe(e.target.checked)} />
            Assigned by me
          </label>
          <label className={`nx-check${overdueOnly ? ' is-on' : ''}`}>
            <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
            Overdue only
          </label>
        </div>
      </div>

      {loading ? <Loader label="Loading tasks…" /> : tasks.length === 0 ? (
        <div className="ar-empty">{anyFilter ? 'No tasks match these filters.' : 'No tasks yet — create the first one.'}</div>
      ) : (
        <div className="nx-fu-list">
          {tasks.slice(0, shown).map((t) => (
            <div key={t.id} className={`nx-task-card${isOverdue(t) ? ' is-overdue' : ''}`} onClick={() => setOpenTaskId(t.id)}>
              <div className="nx-task-title">{t.title}</div>
              <div className="nx-task-meta-row">
                <span className={`nx-status ${t.status === 'done' ? 'ok' : t.status === 'blocked' ? 'off' : 'warn'}`}>{STATUS_LABEL[t.status]}</span>
                <span className={`tone-${PRIORITIES.find((p) => p.value === t.priority)?.tone || 'info'} nx-badge`}>{PRIORITY_LABEL[t.priority]}</span>
                <span className="nx-task-due">{t.task_list_name}</span>
                {t.due_date && <span className={`nx-task-due${isOverdue(t) ? ' is-overdue' : ''}`}>Due {fmtDate(t.due_date)}</span>}
                {t.checklist_total > 0 && <span className="nx-task-checklist-badge">✓ {t.checklist_done}/{t.checklist_total}</span>}
                {t.assignees.length > 0 && (
                  <span className="nx-task-avatars">
                    {t.assignees.slice(0, 4).map((a) => <span key={a.id} className="nx-task-avatar" title={a.name}>{initials(a.name)}</span>)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {tasks.length > shown && (
        <div className="nx-more">
          <span className="nx-more-count">Showing {shown} of {tasks.length}</span>
          <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setShown((n) => n + PAGE_STEP)}>Show more</button>
        </div>
      )}

      {openTaskId !== undefined && (
        <TaskModal taskId={openTaskId} lists={lists} defaultListId={listFilter || lists[0]?.id}
          onClose={() => setOpenTaskId(undefined)}
          onSaved={loadTasks}
          onDeleted={loadTasks} />
      )}
    </div>
  );
}

function initials(name) {
  const parts = String(name || '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '—';
}
