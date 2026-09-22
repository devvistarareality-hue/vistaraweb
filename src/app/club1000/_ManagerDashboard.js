'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, PartyPopper, Users, Building2, Clock, CircleCheckBig, CalendarClock, ClipboardList, AlarmClock, Gift, Layers, Trophy, Settings2, Plus } from 'lucide-react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { rupee, inrShort, pct } from '../../lib/inr';
import { DashHero, DashKpi, DashKpiGrid, DashAlerts, DashCard, DashGrid, DashBars, DashRank, DashSectionTitle } from '../../components/Dash';
import AddInvestorModal from './_AddInvestorModal';
import DateFilter from '../sales/_DateFilter';
import Loader from '../../components/Loader';
import { STATUS_ROWS } from './_DashboardWidgets';

// Club 1000 manager home — same layout as the AR dashboard: the book at a glance,
// then what needs a decision, then where the money sits.
export default function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [schemes, setSchemes] = useState([]);
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
      const [statsRes, schemesRes] = await Promise.all([
        apiFetch(`${CLUB1000_ENDPOINTS.stats}${qs}`),
        apiFetch(CLUB1000_ENDPOINTS.schemes),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (schemesRes.ok) setSchemes(await schemesRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [dateRange.from, dateRange.to]);

  const s = stats || {};
  const breakdown = s.investor_status_breakdown || {};
  const investors = s.investor_count ?? 0;

  return (
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Club 1000</h1>
          <p className="nx-page-sub">Manager view · investment portfolio and returns</p>
        </div>
        <div className="ard-filters"><DateFilter onChange={setDateRange} /></div>
      </div>

      {loading && !stats ? <Loader label="Loading…" /> : (
        <>
          <div className="ard-top">
            <DashHero
              eyebrow="Total invested"
              value={inrShort(s.total_invested)} valueTitle={rupee(s.total_invested)}
              splits={[
                { label: 'Investors', value: investors },
                { label: 'Pending payouts', value: inrShort(s.pending_payout_amount), title: rupee(s.pending_payout_amount) },
                { label: 'Paid out', value: inrShort(s.paid_payout_amount), title: rupee(s.paid_payout_amount) },
              ]}
              ring={{ pct: pct(breakdown.active || 0, investors), label: 'active', caption: `${breakdown.active || 0} of ${investors} investors` }}
              actions={(
                <>
                  <Link href="/club1000/schemes" className="ard-hbtn"><Settings2 size={16} /> Manage schemes</Link>
                  <button type="button" className="ard-hbtn solid" onClick={() => setShowAdd(true)} disabled={!schemes.length}><Plus size={16} /> Add investor</button>
                </>
              )}
              note={!schemes.length ? 'Create a scheme first — Add investor unlocks once one exists.' : null}
            />
            <div className="ard-kpis">
              <DashKpi icon={Phone} tone="info" label="Leads" value={s.leads_count ?? 0} href="/club1000/leads" />
              <DashKpi icon={PartyPopper} tone="good" label="Converted" value={s.converted_count ?? 0} sub={`${pct(s.converted_count || 0, s.leads_count || 0)}% of leads`} href="/club1000/leads?status=converted" />
              <DashKpi icon={Users} tone="info" label="Investors" value={investors} href="/club1000/investors" />
              <DashKpi icon={Building2} tone="warn" label="Active schemes" value={s.active_scheme_count ?? 0} href="/club1000/schemes" />
            </div>
          </div>

          <DashAlerts items={[
            { tone: 'warn', icon: AlarmClock, count: breakdown.due_for_renewal ?? 0, label: 'Due for renewal', text: 'Past maturity, awaiting a decision', href: '/club1000/investors' },
            { tone: 'info', icon: CalendarClock, count: s.upcoming_maturities_count ?? 0, label: 'Maturing in 30 days', text: rupee(s.upcoming_maturities_amount), href: '/club1000/investors' },
            { tone: 'bad', icon: ClipboardList, count: s.pending_approval_count ?? 0, label: 'Pending approvals', text: 'Investors waiting for your sign-off', href: '/club1000/approvals' },
            { tone: 'bad', icon: Clock, count: s.followups_overdue ?? 0, label: 'Overdue follow-ups', text: 'Leads past their follow-up date', href: '/club1000/follow-ups' },
          ]} />

          <DashSectionTitle sub="Payouts to investors">Payouts</DashSectionTitle>
          <DashKpiGrid>
            <DashKpi icon={Clock} tone="warn" label="Pending payouts" value={inrShort(s.pending_payout_amount)} valueTitle={rupee(s.pending_payout_amount)} sub={`${s.pending_payout_count ?? 0} payouts`} href="/club1000/payouts?status=pending" />
            <DashKpi icon={CircleCheckBig} tone="good" label="Paid payouts" value={inrShort(s.paid_payout_amount)} valueTitle={rupee(s.paid_payout_amount)} sub={`${s.paid_payout_count ?? 0} payouts`} href="/club1000/payouts?status=paid" />
          </DashKpiGrid>

          <DashGrid>
            <DashCard title="Portfolio status" sub="Investors by status" icon={Layers} total={investors}>
              <DashBars rows={STATUS_ROWS.map((r) => ({ ...r, value: breakdown[r.key] || 0 }))} empty="No investors yet." />
            </DashCard>
            <DashCard title="By scheme" sub="Amount invested" icon={Building2} total={inrShort(s.total_invested)} totalTitle={rupee(s.total_invested)}>
              <DashBars empty="No investors yet."
                rows={(s.by_scheme || []).map((r) => ({ label: r.scheme, value: Number(r.amount) || 0, display: inrShort(r.amount), title: `${rupee(r.amount)} · ${r.investors} investors`, tone: 'info' }))} />
            </DashCard>
          </DashGrid>

          <DashGrid>
            <DashCard title="Top investors" icon={Trophy} action={<Link href="/club1000/investors" className="ard-link">View all →</Link>}>
              <DashRank tone="good" empty="No investors yet."
                rows={(s.top_investors || []).map((inv, i) => ({ key: `${inv.name}-${i}`, name: inv.name, sub: `${inv.scheme} · ${inv.status}`, value: Number(inv.amount) || 0, display: inrShort(inv.amount), title: rupee(inv.amount) }))} />
            </DashCard>
            <DashCard title="Referral rewards" icon={Gift} action={<Link href="/club1000/referral-rewards" className="ard-link">View all →</Link>}>
              <div className="ard-money-pair">
                <div className="ard-money warn"><span>Pending ({s.referral_pending_count ?? 0})</span><b title={rupee(s.referral_pending_amount)}>{inrShort(s.referral_pending_amount)}</b></div>
                <div className="ard-money good"><span>Paid</span><b title={rupee(s.referral_paid_amount)}>{inrShort(s.referral_paid_amount)}</b></div>
              </div>
            </DashCard>
          </DashGrid>
        </>
      )}

      {showAdd && (
        <AddInvestorModal schemes={schemes} onClose={() => setShowAdd(false)} onCreated={() => load()} />
      )}
    </div>
  );
}
