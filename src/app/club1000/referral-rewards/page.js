'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { isClub1000Manager } from '../../../lib/moduleAccess';
import { formatDMY } from '../../../lib/dateFormat';
import { fmtMoney } from '../_StatCard';
import { confirmDialog } from '../../../lib/notify';
import Loader from '../../../components/Loader';

const TEAL = 'var(--success)';
const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid var(--surface-2)', color: 'var(--text)' };

function groupByReferrer(rewards) {
  const groups = new Map();
  for (const r of rewards) {
    const key = r.reference_phone || r.reference_name;
    if (!groups.has(key)) {
      groups.set(key, { reference_name: r.reference_name, reference_phone: r.reference_phone, total: 0, pending: 0, paid: 0, count: 0 });
    }
    const g = groups.get(key);
    const amount = Number(r.amount) || 0;
    g.total += amount;
    g.count += 1;
    if (r.status === 'paid') g.paid += amount; else g.pending += amount;
  }
  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

export default function ReferralRewardsPage() {
  const user = useSelector((s) => s.auth.user);
  const manager = isClub1000Manager(user);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  async function load() {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiFetch(`${CLUB1000_ENDPOINTS.referralRewards}${qs}`);
      if (res.ok) setRewards(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function markPaid(id) {
    if (!(await confirmDialog('Mark this referral reward as paid?'))) return;
    const res = await apiFetch(CLUB1000_ENDPOINTS.referralRewardMarkPaid(id), { method: 'POST' });
    if (res.ok) load();
  }

  const referrers = groupByReferrer(rewards);

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Referral Rewards</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
        {manager
          ? 'Owed to whoever referred an investor: 0.5% on a new investment, 0.25% on a renewal at maturity'
          : 'Rewards earned from investors converted off your leads'}
      </p>

      {referrers.length > 0 && (
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {referrers.map((g) => (
            <div key={g.reference_phone || g.reference_name} style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--surface-3)', padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{g.reference_name || '—'}</div>
              {g.reference_phone && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{g.reference_phone}</div>}
              <div style={{ fontSize: 18, fontWeight: 800, color: TEAL, marginTop: 8 }}>{fmtMoney(g.total)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                {g.count} referral{g.count === 1 ? '' : 's'} · {fmtMoney(g.pending)} pending
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
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
              <th style={th}>Reference</th>
              <th style={th}>Referred Investor</th>
              <th style={th}>Reward</th>
              <th style={th}>Earned</th>
              <th style={th}>Status</th>
              {manager && <th style={th}></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={manager ? 6 : 5} style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}><Loader size="sm" /></td></tr>
            ) : rewards.length === 0 ? (
              <tr><td colSpan={manager ? 6 : 5} style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}>No referral rewards yet.</td></tr>
            ) : rewards.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.reference_name}{r.reference_phone ? ` — ${r.reference_phone}` : ''}</td>
                <td style={td}>{r.investor_name}</td>
                <td style={td}>{fmtMoney(r.amount)}</td>
                <td style={td}>{formatDMY(r.created_at?.slice(0, 10))}</td>
                <td style={td}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: r.status === 'paid' ? 'var(--success-soft)' : 'var(--warning-soft)', color: r.status === 'paid' ? 'var(--success)' : 'var(--warning-2)' }}>
                    {r.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </td>
                {manager && (
                  <td style={td}>
                    {r.status === 'pending' && (
                      <button onClick={() => markPaid(r.id)} style={{ padding: '5px 10px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Mark Paid</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
