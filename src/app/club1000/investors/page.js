'use client';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import {isClub1000Manager, can} from '../../../lib/moduleAccess';
import { formatDMY } from '../../../lib/dateFormat';
import { onlyPresent } from '../../../lib/presentOptions';
import DateFilter from '../../sales/_DateFilter';
import { fmtMoney } from '../_StatCard';
import AddInvestorModal from '../_AddInvestorModal';
import RenewInvestorModal from '../_RenewInvestorModal';
import LedgerModal from '../_LedgerModal';

import Icon from '../../../components/Icon';
import { confirmDialog, notify } from '../../../lib/notify';
import Loader from '../../../components/Loader';
import { errText } from '../../../lib/apiError';

// The Status filter's choices (narrowed to those present, see onlyPresent).
const PAYOUT_OPTIONS = [
  { value: 'quarterly', label: 'Quarterly' }, { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' }, { value: 'maturity', label: 'At maturity' },
];
const INVESTOR_STATUSES = [
  { value: 'active', label: 'Active' }, { value: 'matured', label: 'Matured' },
  { value: 'redeemed', label: 'Redeemed' }, { value: 'premature_redeemed', label: 'Premature Redeemed' },
];
const TEAL = 'var(--success)';
const PURPLE = 'var(--accent)';
const AMBER = 'var(--warning)';
const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid var(--surface-2)', color: 'var(--text)' };

const STATUS_COLORS = {
  active: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  matured: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  redeemed: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  premature_redeemed: { bg: 'var(--warning-soft)', fg: 'var(--warning-2)' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' };
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: c.bg, color: c.fg, textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</span>;
}

export default function InvestorsPage() {
  const user = useSelector((s) => s.auth.user);
  const manager = isClub1000Manager(user);
  const [investors, setInvestors] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [revising, setRevising] = useState(null);
  const [renewing, setRenewing] = useState(null);
  const [ledgerFor, setLedgerFor] = useState(null);
  // Opened from an investor notification (?investor=<id>): that investor's ledger.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('investor');
    if (id && /^\d+$/.test(id)) setLedgerFor(Number(id));
  }, []);
  const [schemeFilter, setSchemeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // The dashboard narrows its figures by investment date, by who added them and
  // (through the Payout column) by how interest comes back. Same three here, so
  // a tile's number has a list that matches it.
  const [range, setRange] = useState({ from: '', to: '' });
  const [payoutFilter, setPayoutFilter] = useState('');
  const [addedByFilter, setAddedByFilter] = useState('');
  // The dashboard's "Due for renewal" and "Maturing in 30 days" count something
  // no stored status holds — active past maturity, and a 30-day window — so the
  // tiles arrive with ?bucket=, which the server applies with the same
  // conditions it counted them by. Shown as a removable chip: landing on a
  // filtered list with no way to see the rest is its own kind of broken.
  //
  // Read from window rather than useSearchParams: that hook forces the page into
  // a Suspense boundary at build time, and the two other pages here that use it
  // carry one for exactly that reason. This is the same approach My Conversions
  // takes for its ?tab, and it keeps this page a plain client component.
  const [bucket, setBucket] = useState('');
  // `ready` gates the first fetch. Without it the list loaded once unfiltered —
  // bucket is '' on the first render — and again once this effect had read the
  // URL, and whichever response happened to land last won. That is why the same
  // link showed 8 sometimes and all 42 others.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setBucket(new URLSearchParams(window.location.search).get('bucket') || '');
    setReady(true);
  }, []);
  // Only the values these rows hold (?facets=1) — see lib/presentOptions.
  const [facets, setFacets] = useState(null);
  useEffect(() => {
    let alive = true;
    apiFetch(`${CLUB1000_ENDPOINTS.investors}?facets=1&approval_status=approved`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setFacets(d); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const fx = (key) => facets?.[key] ?? null;
  const [search, setSearch] = useState('');
  // Search box is debounced: typing updates `searchText` instantly (responsive UI)
  // but only commits to `search` (which triggers the fetch) after a pause.
  const [searchText, setSearchText] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText), 400);
    return () => clearTimeout(t);
  }, [searchText]);

  const narrowed = !!(bucket || schemeFilter || statusFilter || search
    || payoutFilter || addedByFilter || range.from || range.to);

  // Every fetch takes a ticket; only the newest one is allowed to write to state.
  // Filters change faster than the network answers — type in the search box and
  // an earlier, slower response would otherwise land last and win.
  const reqRef = useRef(0);

  async function load() {
    const ticket = ++reqRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (schemeFilter) params.set('scheme_id', schemeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      if (bucket) params.set('bucket', bucket);
      if (payoutFilter) params.set('interest_payout', payoutFilter);
      if (addedByFilter) params.set('added_by', addedByFilter);
      if (range.from) params.set('date_from', range.from);
      if (range.to) params.set('date_to', range.to);
      // The approved portfolio only — pending/rejected submissions live on the
      // dedicated Approvals page (managers) until they're actioned.
      params.set('approval_status', 'approved');
      const qs = `?${params.toString()}`;
      const [invRes, schemesRes] = await Promise.all([
        apiFetch(`${CLUB1000_ENDPOINTS.investors}${qs}`),
        apiFetch(CLUB1000_ENDPOINTS.schemes),
      ]);
      const inv = invRes.ok ? await invRes.json() : null;
      const sch = schemesRes.ok ? await schemesRes.json() : null;
      if (ticket !== reqRef.current) return;   // a newer request has overtaken this one
      if (inv) setInvestors(inv);
      if (sch) setSchemes(sch);
    } finally {
      if (ticket === reqRef.current) setLoading(false);
    }
  }

  useEffect(() => { if (ready) load(); },
    [ready, schemeFilter, statusFilter, search, bucket, payoutFilter, addedByFilter, range.from, range.to]);

  async function openLoi(id) {
    const res = await apiFetch(CLUB1000_ENDPOINTS.investorLoiUrl(id));
    const data = await res.json();
    if (res.ok && data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    else notify(errText(data, 'Could not open the LOI.'));
  }

  async function redeem(id) {
    if (!(await confirmDialog('Redeem this investment now? This applies the premature-redemption rate for the elapsed period.'))) return;
    const res = await apiFetch(CLUB1000_ENDPOINTS.investorRedeem(id), { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      notify(errText(data, 'Could not redeem.'));
      return;
    }
    load();
  }

  async function maturePayout(id) {
    if (!(await confirmDialog('Pay out this matured investment now? The investor will be marked redeemed — mark the scheduled maturity payout paid separately from the Payouts screen.'))) return;
    const res = await apiFetch(CLUB1000_ENDPOINTS.investorMaturePayout(id), { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      notify(errText(data, 'Could not process the payout.'));
      return;
    }
    load();
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Investors</h1>
          {/* Says what is on screen, not what the page is for. "All approved
              investors across Club 1000" above eight filtered rows reads as the
              whole book, which is how a working filter looks broken. */}
          <p className="club-inv-sub">
            {narrowed
              ? `${investors.length} investor${investors.length === 1 ? '' : 's'}`
                + (bucket === 'due_for_renewal' ? ' due for renewal'
                  : bucket === 'maturing_soon' ? ' maturing in 30 days' : ' matching')
              : (manager ? 'All approved investors across Club 1000' : 'Your approved investors')}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {can(user, 'club.investor.manage') && <button className="nx-btn nx-btn-md nx-btn-success" onClick={() => setShowAdd(true)} disabled={!schemes.length}>+ Add Investor</button>}
          {!loading && !schemes.length && (
            <div style={{ fontSize: 11, color: 'var(--warning-2)' }}>{manager ? 'Create a scheme first.' : 'No schemes yet — ask your manager to create one.'}</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, position: 'relative', maxWidth: 360 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--muted)' }}><Icon name="search" /></span>
        <input className="nx-input" value={searchText} onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search name, phone, email, investor no.…"
          style={{ width: '100%', height: 38, padding: '0 12px 0 36px', borderRadius: 8, border: '1.5px solid var(--border-strong)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
        {searchText && (
          <button className="nx-btn nx-btn-md nx-icon-btn nx-btn-ghost" onClick={() => setSearchText('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}><Icon name="x" /></button>
        )}
      </div>

      {/* The same date control the dashboard carries, so a period means the
          same thing on both. Dated by investment date, as the dashboard is. */}
      <div className="club-inv-dates"><DateFilter onChange={setRange} /></div>

      <div className="club-inv-filters">
        <select className="nx-input" value={schemeFilter} onChange={(e) => setSchemeFilter(e.target.value)} style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--border-strong)', fontSize: 12 }}>
          <option value="">All Schemes</option>
          {onlyPresent(schemes.map((s) => ({ value: String(s.id), label: s.name })), fx('scheme_ids'), schemeFilter).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="nx-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--border-strong)', fontSize: 12 }}>
          <option value="">All Statuses</option>
          {onlyPresent(INVESTOR_STATUSES, fx('statuses'), statusFilter).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="nx-input club-inv-sel" value={payoutFilter} onChange={(e) => setPayoutFilter(e.target.value)}>
          <option value="">All Payouts</option>
          {onlyPresent(PAYOUT_OPTIONS, fx('payouts'), payoutFilter).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {(fx('added_by') || []).length > 1 && (
          <select className="nx-input club-inv-sel" value={addedByFilter} onChange={(e) => setAddedByFilter(e.target.value)}>
            <option value="">Added by anyone</option>
            {(fx('added_by') || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        {bucket && (
          <button type="button" className="club-bucket" onClick={() => setBucket('')}>
            {bucket === 'due_for_renewal' ? 'Due for renewal' : 'Maturing in 30 days'}
            <span className="club-bucket-x">×</span>
          </button>
        )}
      </div>

      <div className="nx-card" style={{ marginTop: 18, background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface-3)', overflow: 'hidden', overflowX: 'auto' }}>
        <table className="nx-table club-inv-tbl">
          <thead>
            <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              <th style={th}>Name</th>
              <th style={th}>Mobile</th>
              <th style={th}>Scheme</th>
              <th style={th}>Reference</th>
              <th style={th}>Amount</th>
              <th style={th}>Return %</th>
              <th style={th}>Payout</th>
              <th style={th}>Invested</th>
              <th style={th}>Matures</th>
              <th style={th}>Documents</th>
              <th style={th}>Status</th>
              {manager && <th style={th}>Added By</th>}
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} className="club-empty-cell"><Loader size="sm" /></td></tr>
            ) : investors.length === 0 ? (
              <tr><td colSpan={13} className="club-empty-cell">{search ? 'No investors match your search.' : 'No investors yet.'}</td></tr>
            ) : investors.map((inv) => (
              <tr key={inv.id}>
                <td style={td}>
                  {inv.name}
                  {inv.revision_no > 0 && <span className="nx-badge" style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: PURPLE, background: 'var(--accent-soft)', padding: '2px 7px', borderRadius: 20 }}>R{inv.revision_no}</span>}
                  {inv.is_matured && <span className="nx-badge" style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: AMBER, background: 'var(--warning-soft)', padding: '2px 7px', borderRadius: 20 }}>MATURED</span>}
                </td>
                <td style={td}>{inv.phone || '—'}</td>
                <td style={td}>{inv.scheme_name}</td>
                <td style={td}>{inv.reference_name ? `${inv.reference_name}${inv.reference_phone ? ` — ${inv.reference_phone}` : ''}` : '—'}</td>
                <td style={td}>{fmtMoney(inv.amount_invested)}</td>
                <td style={td}>{inv.total_return_pct}%</td>
                <td style={td}>{inv.interest_payout === 'monthly' ? 'Monthly' : inv.interest_payout === 'quarterly' ? 'Quarterly' : 'Maturity'}</td>
                <td style={td}>{formatDMY(inv.investment_date)}</td>
                <td style={td}>{formatDMY(inv.maturity_date)}</td>
                <td style={td}>
                  <div className="club-inv-docs">
                    {inv.loi_document_url && <button className="nx-btn nx-btn-sm nx-btn-ghost club-inv-doc" onClick={() => openLoi(inv.id)}>View LOI</button>}
                    {inv.document_url && <a className="club-inv-doc" href={inv.document_url} target="_blank" rel="noreferrer">KYC</a>}
                    {!inv.loi_document_url && !inv.document_url && '—'}
                  </div>
                </td>
                <td style={td}><StatusBadge status={inv.status} /></td>
                {manager && <td style={td}>{inv.added_by_name || '—'}</td>}
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="nx-btn nx-btn-sm nx-btn-success-soft" onClick={() => setLedgerFor(inv.id)} style={{ padding: '5px 10px', background: 'var(--success-soft)', color: TEAL, border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}><Icon name="book" /> Ledger</button>
                    {can(user, 'club.investor.manage') && <button className="nx-btn nx-btn-sm nx-btn-soft" onClick={() => setRevising(inv)}>↻ Revise LOI</button>}
                    {inv.is_matured ? (can(user, 'club.investor.manage') && (
                      <>
                        <button onClick={() => setRenewing(inv)} style={{ padding: '5px 10px', background: 'var(--warning-soft)', color: AMBER, border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↻ Renew</button>
                        {manager && (
                          <button onClick={() => maturePayout(inv.id)} style={{ padding: '5px 10px', background: 'var(--warning-soft)', color: 'var(--warning-2)', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Payout</button>
                        )}
                      </>
                    )) : (
                      manager && inv.status === 'active' && can(user, 'club.investor.manage') && (
                        <button onClick={() => redeem(inv.id)} style={{ padding: '5px 10px', background: 'var(--warning-soft)', color: 'var(--warning-2)', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Redeem</button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddInvestorModal schemes={schemes} onClose={() => setShowAdd(false)} onCreated={() => load()} />
      )}
      {revising && (
        // Revise LOI is the Add Investor form, prefilled — every field can change.
        <AddInvestorModal schemes={schemes} revise={revising}
          onClose={() => setRevising(null)} onCreated={() => load()} />
      )}
      {renewing && (
        <RenewInvestorModal
          investor={renewing}
          scheme={schemes.find((s) => String(s.id) === String(renewing.scheme))}
          onClose={() => setRenewing(null)}
          onSaved={() => load()}
        />
      )}
      {ledgerFor && (
        <LedgerModal investorId={ledgerFor} onClose={() => setLedgerFor(null)} />
      )}
    </div>
  );
}
