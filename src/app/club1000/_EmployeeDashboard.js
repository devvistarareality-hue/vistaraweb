'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, PartyPopper, Users, Clock, CircleCheckBig, CalendarClock, AlarmClock, Gift, Layers, Trophy, Plus } from 'lucide-react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { rupee, inrShort, pct } from '../../lib/inr';
import { DashHero, DashKpi, DashKpiGrid, DashAlerts, DashCard, DashGrid, DashBars, DashRank, DashSectionTitle } from '../../components/Dash';
import AddInvestorModal from './_AddInvestorModal';
import DateFilter from '../sales/_DateFilter';
import Loader from '../../components/Loader';
import { STATUS_ROWS } from './_DashboardWidgets';

// Club 1000 employee home — the same layout as the manager's, for one person's book.
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

  const s = stats || {};
  const breakdown = s.investor_status_breakdown || {};
  const count = s.investor_count ?? 0;

  return (
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">My Club 1000</h1>
          <p className="nx-page-sub">Your investors and personal totals</p>
        </div>
        <div className="ard-filters"><DateFilter onChange={setDateRange} /></div>
      </div>

      {loading && !stats ? <Loader label="Loading…" /> : (
        <>
          <div className="ard-top">
            <DashHero
              eyebrow="My total invested"
              value={inrShort(s.total_invested)} valueTitle={rupee(s.total_invested)}
              splits={[
                { label: 'My investors', value: count },
                { label: 'Pending payouts', value: inrShort(s.pending_payout_amount), title: rupee(s.pending_payout_amount) },
              ]}
              ring={{ pct: pct(s.converted_count || 0, s.leads_count || 0), label: 'converted', caption: `${s.converted_count ?? 0} of ${s.leads_count ?? 0} leads` }}
              actions={<button type="button" className="ard-hbtn solid" onClick={() => setShowAdd(true)} disabled={!schemes.length}><Plus size={16} /> Add investor</button>}
              note={!schemes.length ? 'No schemes yet — ask your manager to create one.' : null}
            />
            <div className="ard-kpis">
              <DashKpi icon={Phone} tone="info" label="My leads" value={s.leads_count ?? 0} href="/club1000/leads" />
              <DashKpi icon={PartyPopper} tone="good" label="Converted" value={s.converted_count ?? 0} href="/club1000/leads?status=converted" />
              <DashKpi icon={Clock} tone="warn" label="Pending payouts" value={inrShort(s.pending_payout_amount)} valueTitle={rupee(s.pending_payout_amount)} sub={`${s.pending_payout_count ?? 0} payouts`} />
              <DashKpi icon={CircleCheckBig} tone="good" label="Paid payouts" value={inrShort(s.paid_payout_amount)} valueTitle={rupee(s.paid_payout_amount)} sub={`${s.paid_payout_count ?? 0} payouts`} />
            </div>
          </div>

          <DashAlerts items={[
            { tone: 'warn', icon: AlarmClock, count: breakdown.due_for_renewal ?? 0, label: 'Due for renewal', text: 'Past maturity, awaiting a decision', href: '/club1000/investors' },
            { tone: 'info', icon: CalendarClock, count: s.upcoming_maturities_count ?? 0, label: 'Maturing in 30 days', text: rupee(s.upcoming_maturities_amount), href: '/club1000/investors' },
            { tone: 'bad', icon: Clock, count: s.followups_overdue ?? 0, label: 'Overdue follow-ups', text: 'Leads past their follow-up date', href: '/club1000/follow-ups' },
          ]} />

          <DashGrid>
            <DashCard title="My portfolio status" sub="Investors by status" icon={Layers} total={count}>
              <DashBars rows={STATUS_ROWS.map((r) => ({ ...r, value: breakdown[r.key] || 0 }))} empty="You haven't added any investors yet." />
            </DashCard>
            <DashCard title="My referral rewards" icon={Gift} action={<Link href="/club1000/referral-rewards" className="ard-link">View all →</Link>}>
              <div className="ard-money-pair">
                <div className="ard-money warn"><span>Pending ({s.referral_pending_count ?? 0})</span><b title={rupee(s.referral_pending_amount)}>{inrShort(s.referral_pending_amount)}</b></div>
                <div className="ard-money good"><span>Paid</span><b title={rupee(s.referral_paid_amount)}>{inrShort(s.referral_paid_amount)}</b></div>
              </div>
            </DashCard>
          </DashGrid>

          <DashSectionTitle sub="Your latest additions">My recent investors</DashSectionTitle>
          <DashCard title="Recent investors" icon={Trophy} action={<Link href="/club1000/investors" className="ard-link">View all →</Link>}>
            <DashRank tone="good" empty="You haven't added any investors yet."
              rows={investors.map((inv) => ({ key: inv.id, name: inv.name, sub: `${inv.scheme_name} · ${inv.status}`, value: Number(inv.amount_invested) || 0, display: inrShort(inv.amount_invested), title: rupee(inv.amount_invested), href: '/club1000/investors' }))} />
          </DashCard>
        </>
      )}

      {showAdd && (
        <AddInvestorModal schemes={schemes} onClose={() => setShowAdd(false)} onCreated={() => load()} />
      )}
    </div>
  );
}
