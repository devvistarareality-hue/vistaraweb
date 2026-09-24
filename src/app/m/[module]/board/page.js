'use client';
import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { notFound } from 'next/navigation';
import { Plus } from 'lucide-react';
import { TASK_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import TaskModal from '../_TaskModal';
import { STATUSES, PRIORITIES, PRIORITY_LABEL, fmtDate, isOverdue, companyParam } from '../_execution';

// Kanban board: one column per status, native HTML5 drag-and-drop to move a
// task between columns (no new dependency — see the plan's note on this).
export default function TaskBoardPage({ params }) {
  if (params.module !== 'execution') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);

  const [lists, setLists] = useState([]);
  const [tasks, setTasks] = useState(null);
  const [listFilter, setListFilter] = useState('');
  const [openTaskId, setOpenTaskId] = useState(undefined);
  const [dragOverCol, setDragOverCol] = useState('');
  const [draggingId, setDraggingId] = useState(null);

  useEffect(() => {
    const q = companyParam(companyId);
    apiFetch(`${TASK_ENDPOINTS.lists}${q ? `?${q}` : ''}`).then((r) => r.json()).then((d) => setLists(d.results || [])).catch(() => {});
  }, [companyId]);

  const loadTasks = useCallback(() => {
    const params = new URLSearchParams();
    if (companyId) params.set('company_id', companyId);
    if (listFilter) params.set('task_list_id', listFilter);
    params.set('include_archived', 'false');
    apiFetch(`${TASK_ENDPOINTS.tasks}?${params}`).then((r) => r.json()).then((d) => setTasks(d.results || [])).catch(() => setTasks([]));
  }, [companyId, listFilter]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function moveTo(taskId, status) {
    setTasks((list) => list.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try { await apiFetch(TASK_ENDPOINTS.task(taskId), { method: 'PATCH', body: JSON.stringify({ status }) }); }
    catch (_) {} finally { loadTasks(); }
  }

  if (tasks === null) return <div className="nx-page"><Loader label="Loading board…" /></div>;

  return (
    <div className="nx-page">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Board</h1>
          <p className="nx-page-sub">Drag a card to move it between statuses.</p>
        </div>
        <div className="nx-seg">
          <select className="nx-input nx-input-sm nx-filter-sel" value={listFilter} onChange={(e) => setListFilter(e.target.value)}>
            <option value="">All Task Lists</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button className="nx-btn nx-btn-md nx-btn-primary" onClick={() => setOpenTaskId(null)}><Plus size={15} /> New Task</button>
        </div>
      </div>

      <div className="nx-board">
        {STATUSES.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.value);
          return (
            <div key={col.value} className={`nx-board-col${dragOverCol === col.value ? ' is-drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.value); }}
              onDragLeave={() => setDragOverCol((c) => (c === col.value ? '' : c))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverCol('');
                const id = Number(e.dataTransfer.getData('text/plain'));
                if (id) moveTo(id, col.value);
              }}>
              <div className="nx-board-col-head">
                <span className={`nx-board-col-title tone-${col.tone}`}>{col.label}</span>
                <span className="nx-board-col-count">{colTasks.length}</span>
              </div>
              <div className="nx-board-col-body">
                {colTasks.map((t) => (
                  <div key={t.id} draggable className={`nx-task-card${isOverdue(t) ? ' is-overdue' : ''}${draggingId === t.id ? ' is-dragging' : ''}`}
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(t.id)); setDraggingId(t.id); }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => setOpenTaskId(t.id)}>
                    <div className="nx-task-title">{t.title}</div>
                    <div className="nx-task-meta-row">
                      <span className={`nx-badge tone-${PRIORITIES.find((p) => p.value === t.priority)?.tone || 'info'}`}>{PRIORITY_LABEL[t.priority]}</span>
                      {t.due_date && <span className={`nx-task-due${isOverdue(t) ? ' is-overdue' : ''}`}>{fmtDate(t.due_date)}</span>}
                      {t.checklist_total > 0 && <span className="nx-task-checklist-badge">✓ {t.checklist_done}/{t.checklist_total}</span>}
                    </div>
                    {t.assignees.length > 0 && (
                      <div className="nx-task-avatars">
                        {t.assignees.slice(0, 4).map((a) => <span key={a.id} className="nx-task-avatar" title={a.name}>{initials(a.name)}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

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
