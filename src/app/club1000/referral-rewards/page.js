'use client';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import {isClub1000Manager, can} from '../../../lib/moduleAccess';
import { formatDMY } from '../../../lib/dateFormat';
import { onlyPresent } from '../../../lib/presentOptions';
import DateFilter from '../../sales/_DateFilter';
import Icon from '../../../components/Icon';
import { fmtMoney } from '../_StatCard';
import { confirmDialog } from '../../../lib/notify';
import Loader from '../../../components/Loader';


// The rate a reward was locked in at is the only record of what earned it.
const PCT_OPTIONS = [
  { value: '0.50', label: 'New investment (0.5%)' },
  { value: '0.25', label: 'Renewal (0.25%)' },
];
const STATUS_OPTIONS = [{ value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }];
// One referrer is one person however their number was typed: 8866339595 and
// +91 88663 39595 are the same card, the same filter, the same total. The last
// ten digits are what the server matches on too — group or compare on anything
// else and the same person appears twice.
const phoneKey = (v) => String(v || '').replace(/\D/g, '').slice(-10);

function groupByReferrer(rewards) {
  const groups = new Map();
  for (const r of rewards) {
    const key = phoneKey(r.reference_phone) || (r.reference_name || '').trim().toLowerCase();
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
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [schemeFilter, setSchemeFilter] = useState('');
  const [pctFilter, setPctFilter] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [dateKey, setDateKey] = useState(0);
  // Which referrer's rewards to show. Held by phone, not name: the name is
  // free-typed and drifts ("SM" vs "S M"), the number does not.
  const [referrer, setReferrer] = useState('');
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText), 400);
    return () => clearTimeout(t);
  }, [searchText]);
  const [facets, setFacets] = useState(null);
  const fx = (key) => facets?.[key] ?? null;

  useEffect(() => {
    let alive = true;
    apiFetch(`${CLUB1000_ENDPOINTS.referralRewards}?facets=1`).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setFacets(d); }).catch(() => {});
    apiFetch(CLUB1000_ENDPOINTS.schemes).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setSchemes(d); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Only the newest request may write to state — filters change faster than
  // the network answers, and a slower earlier one would otherwise land last.
  const reqRef = useRef(0);

  async function load() {
    const ticket = ++reqRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (schemeFilter) params.set('scheme_id', schemeFilter);
      if (pctFilter) params.set('pct', pctFilter);
      if (search) params.set('search', search);
      if (range.from) params.set('date_from', range.from);
      if (range.to) params.set('date_to', range.to);
      // Deliberately NOT sending `reference`: the cards above the table are
      // the whole picture of who referred whom, and a server-side referrer
      // filter would collapse them to the one card already selected. The rows
      // are narrowed below instead, so picking a card never hides the others.
      const q = params.toString();
      const res = await apiFetch(`${CLUB1000_ENDPOINTS.referralRewards}${q ? `?${q}` : ''}`);
      const rows = res.ok ? await res.json() : null;
      if (ticket !== reqRef.current) return;
      if (rows) setRewards(rows);
    } finally {
      if (ticket === reqRef.current) setLoading(false);
    }
  }

  useEffect(() => { load(); },
    [statusFilter, schemeFilter, pctFilter, search, range.from, range.to]);

  const narrowed = !!(schemeFilter || pctFilter || search || referrer || range.from || range.to
    || (statusFilter && statusFilter !== 'pending'));

  function clearFilters() {
    setStatusFilter('pending'); setSchemeFilter(''); setPctFilter(''); setReferrer('');
    setSearchText(''); setSearch(''); setRange({ from: '', to: '' }); setDateKey((n) => n + 1);
  }

  async function markPaid(id) {
    if (!(await confirmDialog('Mark this referral reward as paid?'))) return;
    const res = await apiFetch(CLUB1000_ENDPOINTS.referralRewardMarkPaid(id), { method: 'POST' });
    if (res.ok) load();
  }

  // Cards are built from everything the filters allow, before the referrer
  // choice — so they stay the full picture and the chosen one reads as picked
  // out of a set rather than as the only one that exists.
  const referrers = groupByReferrer(rewards);
  const rows = referrer ? rewards.filter((r) => phoneKey(r.reference_phone) === referrer) : rewards;
  const listedTotal = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return (
    <div className="nx-page ard">
      <h1 className="nx-page-title">Referral Rewards</h1>
      {/* Says what is on screen once loaded. The standing description over a
          filtered list is how a working filter looks broken. */}
      <p className="club-inv-sub">
        {loading
          ? (manager
            ? 'Owed to whoever referred an investor: 0.5% on a new investment, 0.25% on a renewal at maturity'
            : 'Rewards earned from investors converted off your leads')
          : `${rows.length}${statusFilter ? ` ${statusFilter}` : ''} reward${rows.length === 1 ? '' : 's'} · ${fmtMoney(listedTotal)}`}
      </p>

      {referrers.length > 0 && (
        <div className="club-ref-cards">
          {referrers.map((g) => {
            const key = phoneKey(g.reference_phone);
            const on = !!key && referrer === key;
            return (
              /* A card is a filter, not an ornament: its figure counts rows the
                 table was not showing, which is the same disagreement the Club
                 1000 dashboard tiles had before they could be opened. */
              <button type="button" key={g.reference_phone || g.reference_name}
                className={`nx-card club-ref-card${on ? ' is-on' : ''}`}
                onClick={() => setReferrer(on ? '' : key)} disabled={!key}>
                <div className="club-ref-name">{g.reference_name || '—'}</div>
                {g.reference_phone && <div className="club-ref-phone">{g.reference_phone}</div>}
                <div className="club-ref-amt">{fmtMoney(g.total)}</div>
                <div className="club-ref-meta">
                  {g.count} referral{g.count === 1 ? '' : 's'} · {fmtMoney(g.pending)} pending
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="club-pay-search">
        <span className="club-pay-search-ico"><Icon name="search" /></span>
        <input className="nx-input" value={searchText} onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search referrer or referred investor…" />
        {searchText && (
          <button type="button" className="club-pay-clear" onClick={() => setSearchText('')}><Icon name="x" /></button>
        )}
      </div>

      {/* Dated by when the reward was earned — the column the table shows. */}
      <div className="club-inv-dates"><DateFilter key={dateKey} onChange={setRange} /></div>

      <div className="club-inv-filters">
        <select className="nx-input club-inv-sel" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {onlyPresent(STATUS_OPTIONS, fx('statuses'), statusFilter).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="nx-input club-inv-sel" value={pctFilter} onChange={(e) => setPctFilter(e.target.value)}>
          <option value="">New and renewal</option>
          {onlyPresent(PCT_OPTIONS, fx('pcts'), pctFilter).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="nx-input club-inv-sel" value={schemeFilter} onChange={(e) => setSchemeFilter(e.target.value)}>
          <option value="">All Schemes</option>
          {onlyPresent(schemes.map((s) => ({ value: String(s.id), label: s.name })), fx('scheme_ids'), schemeFilter).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="nx-input club-inv-sel" value={referrer} onChange={(e) => setReferrer(e.target.value)}>
          <option value="">All referrers</option>
          {(fx('referrers') || []).map((r) => (
            <option key={r.phone || r.name} value={phoneKey(r.phone)}>{r.name || r.phone}</option>
          ))}
        </select>
        {narrowed && <button type="button" className="club-pay-reset" onClick={clearFilters}>Clear filters</button>}
      </div>

      <div className="nx-card c1-tablecard c1-gap">
        <table className="nx-table c1-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Referred investor</th>
              <th>Reward</th>
              <th>Earned</th>
              <th>Status</th>
              {manager && <th></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={manager ? 6 : 5} className="club-empty-cell"><Loader size="sm" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={manager ? 6 : 5} className="club-empty-cell">
                {narrowed ? 'No referral rewards match these filters.' : 'No referral rewards yet.'}
              </td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>{r.reference_name}{r.reference_phone ? ` — ${r.reference_phone}` : ''}</td>
                <td className="c1-strong">{r.investor_name}</td>
                <td>{fmtMoney(r.amount)}</td>
                <td>{formatDMY(r.created_at?.slice(0, 10))}</td>
                <td><span className={`c1r-status ${r.status === 'paid' ? 'paid' : 'pending'}`}>{r.status === 'paid' ? 'Paid' : 'Pending'}</span></td>
                {manager && (
                  <td>
                    {r.status === 'pending' && can(user, 'club.payout.mark_paid') && (
                      <button type="button" className="nx-btn nx-btn-sm nx-btn-success" onClick={() => markPaid(r.id)}>Mark Paid</button>
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
