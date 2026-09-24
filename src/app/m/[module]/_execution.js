// Shared bits for the Task Allocation ("execution" slug) pages.
export const STATUSES = [
  { value: 'todo', label: 'To Do', tone: 'muted' },
  { value: 'in_progress', label: 'In Progress', tone: 'info' },
  { value: 'in_review', label: 'In Review', tone: 'warn' },
  { value: 'done', label: 'Done', tone: 'good' },
  { value: 'blocked', label: 'Blocked', tone: 'bad' },
];
export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));
export const STATUS_TONE = Object.fromEntries(STATUSES.map((s) => [s.value, s.tone]));

export const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', tone: 'bad' },
  { value: 'high', label: 'High', tone: 'warn' },
  { value: 'normal', label: 'Normal', tone: 'info' },
  { value: 'low', label: 'Low', tone: 'muted' },
];
export const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.label]));
export const PRIORITY_TONE = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.tone]));

export const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function isOverdue(task) {
  return !!task.due_date && task.status !== 'done' && task.due_date < today();
}

export function companyParam(companyId) {
  return companyId ? `company_id=${companyId}` : '';
}
