'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { X, Plus, Trash2, Send } from 'lucide-react';
import { TASK_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import Loader from '../../../components/Loader';
import { STATUSES, PRIORITIES, companyParam } from './_execution';

// Task detail / create modal — shared by the List and Board pages. `taskId`
// null means "create a new task in `defaultListId`"; otherwise it loads and
// edits that task in place (status/priority/dates save immediately on change,
// title/description on blur, checklist + comments are their own endpoints).
export default function TaskModal({ taskId, defaultListId, lists, onClose, onSaved, onDeleted }) {
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const isCreate = !taskId;
  const [loading, setLoading] = useState(!isCreate);
  const [task, setTask] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [taskListId, setTaskListId] = useState(defaultListId || (lists?.[0]?.id ?? ''));
  const [assignees, setAssignees] = useState([]); // [{id, name}]
  const [people, setPeople] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [checklist, setChecklist] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    apiFetch(`${TASK_ENDPOINTS.assignees}${companyId ? `?${companyParam(companyId)}` : ''}`)
      .then((r) => r.json()).then((d) => setPeople(d.results || [])).catch(() => {});
  }, [companyId]);

  useEffect(() => {
    if (isCreate) return;
    let alive = true;
    setLoading(true);
    apiFetch(TASK_ENDPOINTS.task(taskId)).then((r) => r.json()).then((d) => {
      if (!alive) return;
      setTask(d);
      setTitle(d.title || '');
      setDescription(d.description || '');
      setStatus(d.status || 'todo');
      setPriority(d.priority || 'normal');
      setDueDate(d.due_date || '');
      setStartDate(d.start_date || '');
      setTaskListId(d.task_list || '');
      setAssignees(d.assignees || []);
      setChecklist(d.checklist_items || []);
    }).finally(() => alive && setLoading(false));
    apiFetch(TASK_ENDPOINTS.comments(taskId)).then((r) => r.json()).then((d) => alive && setComments(d.results || [])).catch(() => {});
    return () => { alive = false; };
  }, [taskId, isCreate]);

  async function patch(body) {
    if (isCreate) return;
    try {
      const r = await apiFetch(TASK_ENDPOINTS.task(taskId), { method: 'PATCH', body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) { setTask(d); onSaved && onSaved(d); }
    } catch (_) {}
  }

  async function create() {
    if (!title.trim()) { setErr('Title is required.'); return; }
    if (!taskListId) { setErr('Pick a task list.'); return; }
    setSaving(true); setErr('');
    try {
      const r = await apiFetch(TASK_ENDPOINTS.tasks, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(), description: description.trim(), status, priority,
          due_date: dueDate || null, start_date: startDate || null, task_list: taskListId,
          assignee_ids: assignees.map((a) => a.id),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.detail || 'Could not create the task.'); setSaving(false); return; }
      onSaved && onSaved(d);
      onClose();
    } catch (_) { setErr('Could not create the task.'); }
    setSaving(false);
  }

  async function remove() {
    if (isCreate) return;
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await apiFetch(TASK_ENDPOINTS.task(taskId), { method: 'DELETE' });
      onDeleted && onDeleted(taskId);
      onClose();
    } catch (_) {}
  }

  function addAssignee(person) {
    if (assignees.some((a) => a.id === person.id)) return;
    const next = [...assignees, person];
    setAssignees(next);
    setPickerOpen(false);
    patch({ assignee_ids: next.map((a) => a.id) });
  }

  function removeAssignee(id) {
    const next = assignees.filter((a) => a.id !== id);
    setAssignees(next);
    patch({ assignee_ids: next.map((a) => a.id) });
  }

  async function addChecklistItem() {
    const text = newItem.trim();
    if (!text || isCreate) return;
    setNewItem('');
    try {
      const r = await apiFetch(TASK_ENDPOINTS.checklist(taskId), { method: 'POST', body: JSON.stringify({ text }) });
      const d = await r.json();
      if (r.ok) setChecklist((list) => [...list, d]);
    } catch (_) {}
  }

  async function toggleChecklistItem(item) {
    setChecklist((list) => list.map((i) => (i.id === item.id ? { ...i, is_done: !i.is_done } : i)));
    try {
      await apiFetch(TASK_ENDPOINTS.checklistItem(item.id), { method: 'PATCH', body: JSON.stringify({ is_done: !item.is_done }) });
    } catch (_) {}
  }

  async function deleteChecklistItem(item) {
    setChecklist((list) => list.filter((i) => i.id !== item.id));
    try { await apiFetch(TASK_ENDPOINTS.checklistItem(item.id), { method: 'DELETE' }); } catch (_) {}
  }

  async function postComment() {
    const body = newComment.trim();
    if (!body || isCreate) return;
    setNewComment('');
    try {
      const r = await apiFetch(TASK_ENDPOINTS.comments(taskId), { method: 'POST', body: JSON.stringify({ body }) });
      const d = await r.json();
      if (r.ok) setComments((list) => [...list, d]);
    } catch (_) {}
  }

  const checklistDone = checklist.filter((i) => i.is_done).length;

  return (
    <div className="nx-modal-backdrop" onClick={onClose}>
      <div className="nx-card nx-modal nx-task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nx-task-modal-head">
          <input className="nx-input nx-page-title-input" value={title}
            placeholder="Task title…" onChange={(e) => setTitle(e.target.value)}
            onBlur={() => !isCreate && title.trim() && patch({ title: title.trim() })} />
          <div className="nx-seg">
            {!isCreate && (
              <button className="nx-btn nx-btn-sm nx-btn-danger-soft" onClick={remove}><Trash2 size={14} /></button>
            )}
            <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={onClose}><X size={14} /></button>
          </div>
        </div>

        <div className="nx-task-modal-body">
          {loading ? <Loader label="Loading…" /> : (
            <>
              {err && <div className="nx-note bad">{err}</div>}

              <div className="nx-task-row">
                <div className="nx-field stack">
                  <span className="nx-field-label">Task list</span>
                  <select className="nx-input" value={taskListId} onChange={(e) => { setTaskListId(e.target.value); if (!isCreate) patch({ task_list: e.target.value }); }}>
                    {(lists || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="nx-field stack">
                  <span className="nx-field-label">Due date</span>
                  <input className="nx-input" type="date" value={dueDate}
                    onChange={(e) => { setDueDate(e.target.value); if (!isCreate) patch({ due_date: e.target.value || null }); }} />
                </div>
                <div className="nx-field stack">
                  <span className="nx-field-label">Start date</span>
                  <input className="nx-input" type="date" value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); if (!isCreate) patch({ start_date: e.target.value || null }); }} />
                </div>
              </div>

              <div className="nx-field stack">
                <span className="nx-field-label">Status</span>
                <div className="nx-pill-select">
                  {STATUSES.map((s) => (
                    <button key={s.value} className={`tone-${s.tone}${status === s.value ? ' is-on' : ''}`}
                      onClick={() => { setStatus(s.value); if (!isCreate) patch({ status: s.value }); }}>{s.label}</button>
                  ))}
                </div>
              </div>

              <div className="nx-field stack">
                <span className="nx-field-label">Priority</span>
                <div className="nx-pill-select">
                  {PRIORITIES.map((p) => (
                    <button key={p.value} className={`tone-${p.tone}${priority === p.value ? ' is-on' : ''}`}
                      onClick={() => { setPriority(p.value); if (!isCreate) patch({ priority: p.value }); }}>{p.label}</button>
                  ))}
                </div>
              </div>

              <div className="nx-field stack">
                <span className="nx-field-label">Assignees — anyone in the company</span>
                <div className="nx-assignee-chips">
                  {assignees.map((a) => (
                    <span key={a.id} className="nx-assignee-chip">{a.name}
                      <button onClick={() => removeAssignee(a.id)}><X size={12} /></button>
                    </span>
                  ))}
                  <div className="nx-assignee-add">
                    <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setPickerOpen((v) => !v)}><Plus size={13} /> Add</button>
                    {pickerOpen && (
                      <div className="nx-popover nx-assignee-picker-list">
                        {people.filter((p) => !assignees.some((a) => a.id === p.id)).length === 0 ? (
                          <div className="nx-assignee-picker-empty">Everyone's already on this task</div>
                        ) : people.filter((p) => !assignees.some((a) => a.id === p.id)).map((p) => (
                          <div key={p.id} className="nx-assignee-picker-row" onMouseDown={() => addAssignee(p)}>{p.name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="nx-field stack">
                <span className="nx-field-label">Description</span>
                <textarea className="nx-input" rows={3} value={description} placeholder="What needs to happen…"
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => !isCreate && patch({ description })} />
              </div>

              {isCreate ? (
                <button className="nx-btn nx-btn-md nx-btn-primary" disabled={saving} onClick={create}>
                  {saving ? 'Creating…' : 'Create Task'}
                </button>
              ) : (
                <>
                  <div className="nx-field stack">
                    <span className="nx-field-label">Checklist</span>
                    {checklist.length > 0 && (
                      <div className="nx-checklist-progress">{checklistDone} of {checklist.length} done</div>
                    )}
                    <div className="nx-checklist">
                      {checklist.map((item) => (
                        <div key={item.id} className="nx-checklist-row">
                          <input type="checkbox" checked={item.is_done} onChange={() => toggleChecklistItem(item)} />
                          <span className={`nx-checklist-text${item.is_done ? ' is-done' : ''}`}>{item.text}</span>
                          <button className="nx-checklist-del" onClick={() => deleteChecklistItem(item)}><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                    <div className="nx-checklist-add">
                      <input className="nx-input" value={newItem} placeholder="Add a checklist item…"
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()} />
                      <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={addChecklistItem}><Plus size={14} /></button>
                    </div>
                  </div>

                  <div className="nx-field stack">
                    <span className="nx-field-label">Comments</span>
                    <div className="nx-comment-list">
                      {comments.length === 0 ? <div className="nx-checklist-progress">No comments yet.</div> : comments.map((c) => (
                        <div key={c.id} className="nx-comment-row">
                          <span className="nx-comment-author">{c.author?.name || '—'}</span>
                          <span className="nx-comment-time">{fmtTime(c.created_at)}</span>
                          <div className="nx-comment-body">{c.body}</div>
                        </div>
                      ))}
                    </div>
                    <div className="nx-comment-add">
                      <input className="nx-input" value={newComment} placeholder="Write a comment…"
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && postComment()} />
                      <button className="nx-btn nx-btn-sm nx-btn-primary" onClick={postComment}><Send size={14} /></button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
