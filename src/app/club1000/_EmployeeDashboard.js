'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import StatCard, { fmtMoney } from './_StatCard';
import AddInvestorModal from './_AddInvestorModal';
import DateFilter from '../sales/_DateFilter';

const TEAL = '#00838F';

export default function EmployeeDashboard() {
  const [stats, setStats] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('date_from', dateRange.from);
      if (dateRange.to) params.set('date_to', dateRange.to);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const [statsRes, schemesRes, investorsRes] = await Promise.all([
        apiFetch(`${CLUB1000_ENDPOINTS.stats}${qs}`),
        apiFetch(CLUB1000_ENDPOINTS.schemes),
        apiFetch(CLUB1000_ENDPOINTS.investors),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (schemesRes.ok) setSchemes(await schemesRes.json());
      if (investorsRes.ok) setInvestors((await investorsRes.json()).slice(0, 8));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [dateRange.from, dateRange.to]);

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A2E' }}>Club 1000</h1>
          <p style={{ fontSize: 13, color: '#8492A6', marginTop: 4 }}>Your investors and personal totals</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button onClick={() => setShowAdd(true)} disabled={!schemes.length} style={{ padding: '10px 18px', background: TEAL, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: schemes.length ? 'pointer' : 'default', opacity: schemes.length ? 1 : 0.6 }}>+ Add Investor</button>
          {!loading && !schemes.length && (
            <div style={{ fontSize: 11, color: '#E65100' }}>No schemes yet — ask your manager to create one.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <DateFilter onChange={setDateRange} />
      </div>

      {loading ? (
        <div style={{ marginTop: 40, textAlign: 'center', color: '#8492A6', fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <StatCard label="My Investors" value={stats?.investor_count ?? 0} href="/club1000/investors" />
            <StatCard label="Total Invested" value={fmtMoney(stats?.total_invested)} href="/club1000/investors" />
            <StatCard label="Pending Payouts" value={`${stats?.pending_payout_count ?? 0} · ${fmtMoney(stats?.pending_payout_amount)}`} accent="#E65100" />
            <StatCard label="Paid Payouts" value={`${stats?.paid_payout_count ?? 0} · ${fmtMoney(stats?.paid_payout_amount)}`} accent="#2E7D32" />
          </div>

          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>My Recent Investors</div>
            <Link href="/club1000/investors" style={{ fontSize: 12, fontWeight: 700, color: TEAL, textDecoration: 'none' }}>View all →</Link>
          </div>
          <div style={{ marginTop: 12, background: '#fff', borderRadius: 16, border: '1px solid #EDF1F7', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                  <th style={th}>Name</th>
                  <th style={th}>Scheme</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {investors.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#8492A6' }}>You haven't added any investors yet.</td></tr>
                ) : investors.map((inv) => (
                  <tr key={inv.id}>
                    <td style={td}>{inv.name}</td>
                    <td style={td}>{inv.scheme_name}</td>
                    <td style={td}>{fmtMoney(inv.amount_invested)}</td>
                    <td style={td}>{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showAdd && (
        <AddInvestorModal
          schemes={schemes}
          onClose={() => setShowAdd(false)}
          onCreated={() => load()}
        />
      )}
    </div>
  );
}

const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid #F5F6FA', color: '#1A1A2E' };
