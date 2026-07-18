'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { isClub1000Manager } from '../../../lib/moduleAccess';
import { formatDMY } from '../../../lib/dateFormat';
import { fmtMoney } from '../_StatCard';

const TEAL = '#00838F';
const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid #F5F6FA', color: '#1A1A2E' };

const TYPE_LABELS = { interest: 'Interest', maturity: 'Maturity', premature_redemption: 'Premature Redemption' };

export default function PayoutsPage() {
  const user = useSelector((s) => s.auth.user);
  const router = useRouter();
  const manager = isClub1000Manager(user);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
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

  async function markPaid(id) {
    if (!confirm('Mark this payout as paid?')) return;
    const res = await apiFetch(CLUB1000_ENDPOINTS.payoutMarkPaid(id), { method: 'POST' });
    if (res.ok) load();
  }

  if (!manager) return null;

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>Payouts</h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginTop: 4 }}>Interest, maturity, and premature-redemption ledger</p>

      <div style={{ marginTop: 18 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid #C6D0DB', fontSize: 12 }}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div style={{ marginTop: 18, background: '#fff', borderRadius: 16, border: '1px solid #EDF1F7', overflow: 'hidden', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
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
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#8492A6' }}>Loading…</td></tr>
            ) : payouts.length === 0 ? (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#8492A6' }}>No payouts.</td></tr>
            ) : payouts.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.investor_name}</td>
                <td style={td}>{p.scheme_name}</td>
                <td style={td}>{TYPE_LABELS[p.payout_type] || p.payout_type}</td>
                <td style={td}>{formatDMY(p.due_date)}</td>
                <td style={td}>{fmtMoney(p.amount_due)}</td>
                <td style={td}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: p.status === 'paid' ? '#E8F5E9' : '#FFF3E0', color: p.status === 'paid' ? '#2E7D32' : '#E65100' }}>
                    {p.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </td>
                <td style={td}>
                  {p.status === 'pending' && (
                    <button onClick={() => markPaid(p.id)} style={{ padding: '5px 10px', background: TEAL, color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Mark Paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
