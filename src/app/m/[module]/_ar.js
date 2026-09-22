// Shared bits for the Accounts Receivable pages.
// Money formatting is shared with the other dashboards (lib/inr.js).
import { rupee, inrShort } from '../../../lib/inr';

export { rupee, inrShort };

export const MODES = [
  { value: 'bank', label: 'Bank' },
  { value: 'nbfc', label: 'NBFC' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];

export const AGE_LABELS = ['0-15', '16-30', '31-60', '61-90', '91-120', '121-180', '>180'];

export const STATUS = {
  completed: { cls: 'ok', label: 'Completed' },
  partial:   { cls: 'warn', label: 'Partial' },
  pending:   { cls: 'off', label: 'Pending' },
};

export const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Worst ageing bucket that holds money — the register's one-glance "how late".
export function worstBucket(ageing) {
  for (let i = AGE_LABELS.length - 1; i >= 0; i -= 1) {
    if ((ageing?.[AGE_LABELS[i]] || 0) > 0) return AGE_LABELS[i];
  }
  return '';
}

// Account-health flags, one list for the register filter, the dashboard's
// "Needs attention" card and the badges.
export const ISSUES = [
  { value: 'no_schedule', label: 'No schedule', tone: 'warn', test: (r) => r.no_schedule },
  { value: 'plan_mismatch', label: 'Plan mismatch', tone: 'warn', test: (r) => !!r.plan_mismatch },
];
export const hasIssue = (r) => ISSUES.some((i) => i.test(r));

// The statement is print-ready HTML from the server; the browser's print dialog
// saves it as a PDF. The window opens before the fetch so pop-up blockers allow it.
export async function printStatement(url, apiFetch) {
  const w = window.open('', '_blank');
  if (!w) return 'Allow pop-ups for this site to print the statement.';
  w.document.write('<p>Preparing statement…</p>');
  try {
    const r = await apiFetch(url);
    if (!r.ok) { w.close(); return 'Could not prepare the statement.'; }
    const html = await r.text();
    w.document.open(); w.document.write(html); w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
    return '';
  } catch {
    w.close();
    return 'Could not prepare the statement. Check your connection.';
  }
}
