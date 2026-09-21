'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { fmtMoney } from './_StatCard';
import { KpiCard, SectionCard, StatusDonut } from './_DashboardWidgets';
import AddInvestorModal from './_AddInvestorModal';
import DateFilter from '../sales/_DateFilter';
import Loader from '../../components/Loader';

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

  const dueForRenewal = stats?.investor_status_breakdown?.due_for_renewal ?? 0;
  const upcomingMaturities = stats?.upcoming_maturities_count ?? 0;
  const overdueFollowUps = stats?.followups_overdue ?? 0;
  const hasAttentionItems = dueForRenewal + upcomingMaturities + overdueFollowUps > 0;

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="nx-hero nx-c1k-hero">
        <div>
          <div className="nx-c1k-hero-eyebrow">Club 1000</div>
          <div className="nx-c1k-hero-title">My Investors</div>
          <div className="nx-c1k-hero-sub">Your investors and personal totals</div>
        </div>
        <div className="nx-c1k-hero-actions">
          <div className="nx-c1k-hero-btns">
            <button className="nx-btn nx-btn-md nx-btn-success" onClick={() => setShowAdd(true)} disabled={!schemes.length}>+ Add Investor</button>
          </div>
          <div className="nx-c1k-hero-stat">
            <span className="nx-c1k-hero-stat-num">{fmtMoney(stats?.total_invested)}</span>
            <span className="nx-c1k-hero-stat-label">Total Invested</span>
          </div>
          {!loading && !schemes.length && (
            <div className="nx-c1k-hero-warn">No schemes yet — ask your manager to create one.</div>
          )}
        </div>
      </div>

      <DateFilter onChange={setDateRange} />

      {loading ? (
        <Loader label="Loading…" style={{ padding: '28px 0' }} />
      ) : (
        <>
          <div className="nx-kpi-row nx-mt-20">
            <KpiCard icon="phone" label="My Leads" value={stats?.leads_count ?? 0} href="/club1000/leads" accent="var(--accent)" />
            <KpiCard icon="party" label="Converted" value={stats?.converted_count ?? 0} href="/club1000/leads?status=converted" accent="var(--success)" />
            <KpiCard icon="users" label="My Investors" value={stats?.investor_count ?? 0} href="/club1000/investors" accent="var(--accent-deep)" />
            <KpiCard icon="clock" label="Pending Payouts" value={stats?.pending_payout_count ?? 0} sub={fmtMoney(stats?.pending_payout_amount)} accent="var(--warning-2)" />
            <KpiCard icon="check-circle" label="Paid Payouts" value={stats?.paid_payout_count ?? 0} sub={fmtMoney(stats?.paid_payout_amount)} accent="var(--success)" />
          </div>

          {hasAttentionItems && (
            <div className="nx-mt-28">
              <div className="nx-c1k-section-title">Needs Attention</div>
              <div className="nx-kpi-row">
                {dueForRenewal > 0 && (
                  <KpiCard icon="alert" label="Due for Renewal" value={dueForRenewal} sub="Past maturity, awaiting a decision" href="/club1000/investors" accent="var(--warning-2)" />
                )}
                {upcomingMaturities > 0 && (
                  <KpiCard icon="calendar" label="Maturing in 30 Days" value={upcomingMaturities} sub={fmtMoney(stats?.upcoming_maturities_amount)} href="/club1000/investors" accent="var(--accent)" />
                )}
                {overdueFollowUps > 0 && (
                  <KpiCard icon="clock" label="Overdue Follow-Ups" value={overdueFollowUps} href="/club1000/follow-ups" accent="var(--danger)" />
                )}
              </div>
            </div>
          )}

          <div className="nx-c1k-grid-2 nx-mt-28">
            <SectionCard title="My Portfolio Status">
              <StatusDonut breakdown={stats?.investor_status_breakdown} />
            </SectionCard>
            <SectionCard title="My Referral Rewards" action={<Link href="/club1000/referral-rewards" className="nx-c1k-section-link">View all →</Link>}>
              <div className="nx-c1k-money-row">
                <div className="nx-c1k-money-tile pending">
                  <div className="nx-c1k-money-label">Pending ({stats?.referral_pending_count ?? 0})</div>
                  <div className="nx-c1k-money-value">{fmtMoney(stats?.referral_pending_amount)}</div>
                </div>
                <div className="nx-c1k-money-tile paid">
                  <div className="nx-c1k-money-label">Paid</div>
                  <div className="nx-c1k-money-value">{fmtMoney(stats?.referral_paid_amount)}</div>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="nx-c1k-section-head nx-mt-28">
            <div className="nx-c1k-section-head-title">My Recent Investors</div>
            <Link href="/club1000/investors" className="nx-c1k-section-link">View all →</Link>
          </div>
          <div className="nx-c1k-card-full" style={{ padding: 0, overflow: 'hidden' }}> {/* inline-ok: table needs the card's rounded corners without its usual inner padding */}
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
                  <tr><td colSpan={4} className="nx-c1k-empty">You haven't added any investors yet.</td></tr>
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
