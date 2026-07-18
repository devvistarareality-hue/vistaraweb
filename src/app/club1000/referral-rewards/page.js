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
  const router = useRouter();
  const manager = isClub1000Manager(user);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  useEffect(() => {
    if (user && !manager) router.replace('/club1000');
  }, [user]);

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

  useEffect(() => { if (manager) load(); }, [manager, statusFilter]);

  async function markPaid(id) {
    if (!confirm('Mark this referral reward as paid?')) return;
    const res = await apiFetch(CLUB1000_ENDPOINTS.referralRewardMarkPaid(id), { method: 'POST' });
    if (res.ok) load();
  }

  if (!manager) return null;

  const referrers = groupByReferrer(rewards);

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>Referral Rewards</h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginTop: 4 }}>0.5% of each referred investor&apos;s investment, owed to their referrer</p>

      {referrers.length > 0 && (
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {referrers.map((g) => (
            <div key={g.reference_phone || g.reference_name} style={{ background: '#fff', borderRadius: 14, border: '1px solid #EDF1F7', padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{g.reference_name || '—'}</div>
              {g.reference_phone && <div style={{ fontSize: 11, color: '#8492A6', marginTop: 2 }}>{g.reference_phone}</div>}
              <div style={{ fontSize: 18, fontWeight: 800, color: TEAL, marginTop: 8 }}>{fmtMoney(g.total)}</div>
              <div style={{ fontSize: 11, color: '#8492A6', marginTop: 3 }}>
                {g.count} referral{g.count === 1 ? '' : 's'} · {fmtMoney(g.pending)} pending
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
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
              <th style={th}>Reference</th>
              <th style={th}>Referred Investor</th>
              <th style={th}>Reward</th>
              <th style={th}>Earned</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#8492A6' }}>Loading…</td></tr>
            ) : rewards.length === 0 ? (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#8492A6' }}>No referral rewards yet.</td></tr>
            ) : rewards.map((r) => (
              <tr key={r.id}>
                <td style={td}>{r.reference_name}{r.reference_phone ? ` — ${r.reference_phone}` : ''}</td>
                <td style={td}>{r.investor_name}</td>
                <td style={td}>{fmtMoney(r.amount)}</td>
                <td style={td}>{formatDMY(r.created_at?.slice(0, 10))}</td>
                <td style={td}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: r.status === 'paid' ? '#E8F5E9' : '#FFF3E0', color: r.status === 'paid' ? '#2E7D32' : '#E65100' }}>
                    {r.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </td>
                <td style={td}>
                  {r.status === 'pending' && (
                    <button onClick={() => markPaid(r.id)} style={{ padding: '5px 10px', background: TEAL, color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Mark Paid</button>
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
