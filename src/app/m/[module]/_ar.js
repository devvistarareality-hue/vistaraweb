// Shared bits for the Accounts Receivable pages.
export const rupee = (n) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '−₹ ' : '₹ ') + Math.abs(v).toLocaleString('en-IN');
};

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
