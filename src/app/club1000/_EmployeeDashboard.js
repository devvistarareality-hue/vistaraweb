'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import StatCard, { fmtMoney } from './_StatCard';
import AddInvestorModal from './_AddInvestorModal';
import DateFilter from '../sales/_DateFilter';
import Loader from '../../components/Loader';

const TEAL = 'var(--success)';

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
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Club 1000</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Your investors and personal totals</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button className="nx-btn nx-btn-md nx-btn-success" onClick={() => setShowAdd(true)} disabled={!schemes.length} style={{ padding: '10px 18px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: schemes.length ? 'pointer' : 'default', opacity: schemes.length ? 1 : 0.6 }}>+ Add Investor</button>
          {!loading && !schemes.length && (
            <div style={{ fontSize: 11, color: 'var(--warning-2)' }}>No schemes yet — ask your manager to create one.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <DateFilter onChange={setDateRange} />
      </div>

      {loading ? (
        <Loader label="Loading…" style={{ padding: '28px 0' }} />
      ) : (
        <>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <StatCard label="My Leads" value={stats?.leads_count ?? 0} href="/club1000/leads" />
            <StatCard label="Converted" value={stats?.converted_count ?? 0} href="/club1000/leads?status=converted" accent="var(--success)" />
            <StatCard label="My Investors" value={stats?.investor_count ?? 0} href="/club1000/investors" />
            <StatCard label="Total Invested" value={fmtMoney(stats?.total_invested)} href="/club1000/investors" />
            <StatCard label="Pending Payouts" value={`${stats?.pending_payout_count ?? 0} · ${fmtMoney(stats?.pending_payout_amount)}`} accent="var(--warning)" />
            <StatCard label="Paid Payouts" value={`${stats?.paid_payout_count ?? 0} · ${fmtMoney(stats?.paid_payout_amount)}`} accent="var(--success)" />
          </div>

          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>My Recent Investors</div>
            <Link href="/club1000/investors" style={{ fontSize: 12, fontWeight: 700, color: TEAL, textDecoration: 'none' }}>View all →</Link>
          </div>
          <div className="nx-card" style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface-3)', overflow: 'hidden' }}>
            <table className="nx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                  <th style={th}>Name</th>
                  <th style={th}>Scheme</th>
                  <th style={th}>Amount</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {investors.length === 0 ? (
                  <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}>You haven't added any investors yet.</td></tr>
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

const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid var(--surface-2)', color: 'var(--text)' };
