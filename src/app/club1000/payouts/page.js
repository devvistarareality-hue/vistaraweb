'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { isClub1000Manager } from '../../../lib/moduleAccess';
import { formatDMY } from '../../../lib/dateFormat';
import { fmtMoney } from '../_StatCard';
import Loader from '../../../components/Loader';

const TEAL = 'var(--success)';
const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid var(--surface-2)', color: 'var(--text)' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const inp = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--border-strong)', fontSize: 13, boxSizing: 'border-box' };

const TYPE_LABELS = { interest: 'Interest', maturity: 'Maturity', premature_redemption: 'Premature Redemption' };

export default function PayoutsPage() {
  const user = useSelector((s) => s.auth.user);
  const router = useRouter();
  const manager = isClub1000Manager(user);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [payingFor, setPayingFor] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // Seed the status filter from the URL so the dashboard's Pending/Paid Payouts
  // stat cards can deep-link into the matching tab (?status=pending|paid). Done
  // in an effect, not a lazy initializer, since window.location isn't committed
  // yet during Next client navigation when the initializer runs.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setStatusFilter(p.get('status') ?? 'pending');
    setSeeded(true);
  }, []);

  useEffect(() => {
    if (user && !manager) router.replace('/club1000');
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiFetch(`${CLUB1000_ENDPOINTS.payouts}${qs}`);
      if (res.ok) setPayouts(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (manager && seeded) load(); }, [manager, statusFilter, seeded]);

  function openMarkPaid(p) {
    setErr('');
    setPayForm({ amount: String(p.amount_due), notes: '' });
    setPayingFor(p);
  }

  async function submitMarkPaid() {
    if (!payForm.amount) { setErr('Amount is required.'); return; }
    setSaving(true); setErr('');
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.payoutMarkPaid(payingFor.id), {
        method: 'POST',
        body: JSON.stringify({ amount: payForm.amount, notes: payForm.notes }),
      });
      if (res.ok) {
        setPayingFor(null);
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        setErr(d?.detail || 'Could not mark this payout paid.');
      }
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  if (!manager) return null;

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Payouts</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Interest, maturity, and premature-redemption ledger</p>

      <div style={{ marginTop: 18 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--border-strong)', fontSize: 12 }}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div style={{ marginTop: 18, background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface-3)', overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              <th style={th}>Investor</th>
              <th style={th}>Scheme</th>
              <th style={th}>Type</th>
              <th style={th}>Due Date</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}><Loader size="sm" /></td></tr>
            ) : payouts.length === 0 ? (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}>No payouts.</td></tr>
            ) : payouts.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.investor_name}</td>
                <td style={td}>{p.scheme_name}</td>
                <td style={td}>{TYPE_LABELS[p.payout_type] || p.payout_type}</td>
                <td style={td}>{formatDMY(p.due_date)}</td>
                <td style={td}>
                  {fmtMoney(p.amount_due)}
                  {p.status === 'paid' && p.paid_amount != null && Number(p.paid_amount) !== Number(p.amount_due) && (
                    <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>Paid {fmtMoney(p.paid_amount)}</div>
                  )}
                </td>
                <td style={td}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: p.status === 'paid' ? 'var(--success-soft)' : 'var(--warning-soft)', color: p.status === 'paid' ? 'var(--success)' : 'var(--warning-2)' }}>
                    {p.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                  {p.status === 'paid' && p.notes && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>"{p.notes}"</div>}
                </td>
                <td style={td}>
                  {p.status === 'pending' && (
                    <button onClick={() => openMarkPaid(p)} style={{ padding: '5px 10px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Mark Paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payingFor && (
        <div onClick={() => setPayingFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(var(--ink-rgb),0.38)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '100%', background: 'var(--surface)', borderRadius: 18, boxShadow: '0 24px 80px rgba(var(--ink-rgb),0.22)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface-2)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Mark Payout Paid</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {payingFor.investor_name} · {TYPE_LABELS[payingFor.payout_type] || payingFor.payout_type} · Due {formatDMY(payingFor.due_date)}
              </div>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Amount Paid (₹)</label>
                <input style={inp} type="number" min="0" step="0.01" value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Scheduled: {fmtMoney(payingFor.amount_due)}</div>
              </div>
              <div>
                <label style={lbl}>Remarks</label>
                <textarea style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} rows={3}
                  value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  placeholder="e.g. paid via NEFT, rounded to nearest ₹10…" />
              </div>
              {err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setPayingFor(null)} style={{ padding: '9px 16px', background: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitMarkPaid} disabled={saving} style={{ padding: '9px 16px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Mark Paid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
