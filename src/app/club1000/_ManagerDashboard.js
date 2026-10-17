'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, PartyPopper, Users, Building2, Clock, CalendarClock, ClipboardList, AlarmClock, Gift, Layers, Trophy, Settings2, Plus } from 'lucide-react';
import { CLUB1000_ENDPOINTS } from '../../constants/api';
import { apiFetch } from '../../utils/apiFetch';
import { rupee, inrShort, pct } from '../../lib/inr';
import { DashHero, DashKpi, DashAlerts, DashCard, DashGrid, DashBars, DashRank } from '../../components/Dash';
import AddInvestorModal from './_AddInvestorModal';
import DateFilter from '../sales/_DateFilter';
import Loader from '../../components/Loader';
import MultiSelect from '../../components/MultiSelect';
import { STATUS_ROWS } from './_DashboardWidgets';
import PayoutsAhead from './_PayoutsAhead';

// Club 1000 manager home — same layout as the AR dashboard: the book at a glance,
// then what needs a decision, then where the money sits.

// Pending payouts by month — the same chart AR calls "Falling due", reusing its
// markup and ard-* classes so the two dashboards read identically. The columns
// come from the API (see club1000.views._payout_forecast), which builds them
// from today's date, so they move with the calendar on their own.
function PayoutForecast({ rows }) {
  // AR's "Falling due" columns, in a half-width card as on the AR dashboard, so the
  // columns sit close together. A column keeps a small stub when its month has any
  // money, and its value sits above it, so a ₹15 L month still reads next to ₹19 Cr.
  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const max = Math.max(1, ...rows.map((r) => Number(r.amount) || 0));
  return (
    <DashCard title="Falling due" sub="Payouts not yet due, by month" icon={CalendarClock}
      total={inrShort(total)} totalTitle={rupee(total)}>
      <div className="ard-cols club-due">
        {rows.map((m) => {
          const amount = Number(m.amount) || 0;
          return (
            <div key={m.label} className="ard-col" title={`${m.label} · ${rupee(amount)}`}>
              <span className="ard-col-value">{amount ? inrShort(amount) : '—'}</span>
              <span className="ard-col-track">
                <span className={`ard-col-bar${m.label === 'No date' ? ' muted' : ''}`}
                  style={{ height: `${amount ? Math.max(6, (amount / max) * 100) : 0}%` }} />{/* inline-ok: column height from data */}
              </span>
              <span className="ard-col-label">{m.label}</span>
            </div>
          );
        })}
      </div>
    </DashCard>
  );
}

export default function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  // Scheme filter: every figure below for just these schemes (names here, ids to the API).
  const [schemeSel, setSchemeSel] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('date_from', dateRange.from);
      if (dateRange.to) params.set('date_to', dateRange.to);
      const ids = schemes.filter((sc) => schemeSel.includes(sc.name)).map((sc) => sc.id);
      if (ids.length) params.set('scheme', ids.join(','));
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

  useEffect(() => { load(); }, [dateRange.from, dateRange.to, schemeSel.join('|')]);

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
        <div className="ard-filters">
          {schemes.length > 1 && (
            <MultiSelect allLabel="All Schemes" noun="schemes" value={schemeSel} onChange={setSchemeSel}
              options={schemes.map((sc) => ({ value: sc.name, label: sc.name }))} />
          )}
          <DateFilter onChange={setDateRange} />
        </div>
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
            { tone: 'warn', icon: AlarmClock, count: breakdown.due_for_renewal ?? 0, label: 'Due for renewal', text: 'Past maturity, awaiting a decision', href: '/club1000/investors?bucket=due_for_renewal' },
            { tone: 'info', icon: CalendarClock, count: s.upcoming_maturities_count ?? 0, label: 'Maturing in 30 days', text: rupee(s.upcoming_maturities_amount), href: '/club1000/investors?bucket=maturing_soon' },
            { tone: 'bad', icon: ClipboardList, count: s.pending_approval_count ?? 0, label: 'Pending approvals', text: 'Investors waiting for your sign-off', href: '/club1000/approvals' },
            { tone: 'bad', icon: Clock, count: s.followups_overdue ?? 0, label: 'Overdue follow-ups', text: 'Leads past their follow-up date', href: '/club1000/follow-ups' },
          ]} />

          {/* Money going out, side by side: what is owed and paid (payouts and referral
              rewards), and when the unpaid payouts fall due. */}
          <DashGrid>
            <DashCard title="Payouts" sub="To investors and referrers" icon={Gift}>
              <div className="ard-money-pair">
                <Link href="/club1000/payouts?status=pending" className="ard-money warn"><span>Pending payouts ({s.pending_payout_count ?? 0})</span><b title={rupee(s.pending_payout_amount)}>{inrShort(s.pending_payout_amount)}</b></Link>
                <Link href="/club1000/payouts?status=paid" className="ard-money good"><span>Paid payouts ({s.paid_payout_count ?? 0})</span><b title={rupee(s.paid_payout_amount)}>{inrShort(s.paid_payout_amount)}</b></Link>
              </div>
              <div className="ard-money-pair club-ref-pair">
                <Link href="/club1000/referral-rewards" className="ard-money warn"><span>Referral pending ({s.referral_pending_count ?? 0})</span><b title={rupee(s.referral_pending_amount)}>{inrShort(s.referral_pending_amount)}</b></Link>
                <Link href="/club1000/referral-rewards" className="ard-money good"><span>Referral paid</span><b title={rupee(s.referral_paid_amount)}>{inrShort(s.referral_paid_amount)}</b></Link>
              </div>
            </DashCard>
            {(s.payout_forecast || []).length > 0
              ? <PayoutForecast rows={s.payout_forecast} />
              : <DashCard title="Falling due" sub="Payouts not yet due, by month" icon={CalendarClock}><div className="ar-empty">No payouts falling due.</div></DashCard>}
          </DashGrid>

          <DashGrid>
            <DashCard title="Portfolio status" sub="Investors by status" icon={Layers} total={investors}>
              <DashBars rows={STATUS_ROWS.map((r) => ({ ...r, value: breakdown[r.key] || 0 }))} empty="No investors yet." />
            </DashCard>
            <DashCard title="By scheme" sub="Amount invested" icon={Building2} total={inrShort(s.total_invested)} totalTitle={rupee(s.total_invested)}>
              <DashBars empty="No investors yet."
                rows={(s.by_scheme || []).map((r) => ({ label: r.scheme, value: Number(r.amount) || 0, display: inrShort(r.amount), title: `${rupee(r.amount)} · ${r.investors} investors`, tone: 'info' }))} />
            </DashCard>
          </DashGrid>

          {/* Who holds the most, beside what has to be paid out and when. */}
          <DashGrid>
          <DashCard title="Top investors" sub="By amount invested" icon={Trophy} action={<Link href="/club1000/investors" className="ard-link">View all →</Link>}>
              <DashRank tone="good" empty="No investors yet."
                rows={(s.top_investors || []).map((inv, i) => ({ key: `${inv.name}-${i}`, name: inv.name, sub: `${inv.scheme} · ${inv.status}`, value: Number(inv.amount) || 0, display: inrShort(inv.amount), title: rupee(inv.amount) }))} />
            </DashCard>
            <PayoutsAhead schemeSel={schemeSel} />
          </DashGrid>
        </>
      )}

      {showAdd && (
        <AddInvestorModal schemes={schemes} onClose={() => setShowAdd(false)} onCreated={() => load()} />
      )}
    </div>
  );
}
