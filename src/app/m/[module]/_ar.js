// Shared bits for the Accounts Receivable pages.
// Money formatting is shared with the other dashboards (lib/inr.js).
import { rupee, inrShort } from '../../../lib/inr';

export { rupee, inrShort };

export const MODES = [
  { value: 'loan', label: 'Loan' },
  { value: 'nbfc', label: 'NBFC' },
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
];
// A payment is recorded as Loan or NBFC only. MODES above keeps Bank / Cash / Cheque so
// older receipts still read correctly; an edit of one of those keeps its own mode
// on offer (see recordModes) rather than silently switching it.
export const RECORD_MODES = MODES.filter((m) => m.value === 'loan' || m.value === 'nbfc');
export const recordModes = (current) => (RECORD_MODES.some((m) => m.value === current)
  ? RECORD_MODES : [...RECORD_MODES, ...MODES.filter((m) => m.value === current)]);

// Amount typed into a money field: keep only digits and one decimal point (max 2
// places), and show it with Indian grouping — "5000000" reads "50,00,000". The
// raw string is what gets saved; only the display is grouped.
export const cleanAmount = (v) => {
  const s = String(v ?? '').replace(/[^0-9.]/g, '');
  const [int, ...rest] = s.split('.');
  return rest.length ? `${int}.${rest.join('').slice(0, 2)}` : int;
};
export const groupINR = (raw) => {
  if (raw === '' || raw == null) return '';
  const [int, dec] = String(raw).split('.');
  const n = int.replace(/^0+(?=\d)/, '');
  const last3 = n.slice(-3);
  const head = n.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (head ? `${head},${last3}` : last3) + (dec !== undefined ? `.${dec}` : '');
};
// What a bank's balance becomes once this receipt is saved. An edit of a receipt
// already in that bank takes its old amount out first, so it is not counted twice.
export const balanceAfter = (bank, form) => {
  if (!bank) return 0;
  const same = form.orig_bank && String(form.orig_bank) === String(bank.id);
  return (bank.balance || 0) - (same ? Number(form.orig_amount) || 0 : 0) + (Number(form.amount) || 0);
};

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
  { value: 'bad_dates', label: 'Check due dates', tone: 'bad', test: (r) => !!r.bad_dates },
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
