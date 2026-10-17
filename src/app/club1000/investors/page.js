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
import { RedeemModal, MaturityPayoutModal } from '../_CloseInvestment';
import HistoryModal from '../_HistoryModal';
import PortfolioModal from '../_PortfolioModal';
import ImportInvestorsModal from '../_ImportInvestors';
import LedgerModal from '../_LedgerModal';

import Icon from '../../../components/Icon';
import { notify, confirmDialog } from '../../../lib/notify';
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

const STATUS_COLORS = {
  active: { bg: 'var(--success-soft)', fg: 'var(--success)' },
  matured: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  redeemed: { bg: 'var(--accent-soft)', fg: 'var(--accent-deep)' },
  premature_redeemed: { bg: 'var(--warning-soft)', fg: 'var(--warning-2)' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: 'var(--surface-2)', fg: 'var(--text-3)' };
  return <span className="c1l-badge" style={{ background: c.bg, color: c.fg }}>{status.replace(/_/g, ' ')}</span>;{/* inline-ok: colour per status */}
}

export default function InvestorsPage() {
  const user = useSelector((s) => s.auth.user);
  const manager = isClub1000Manager(user);
  const [investors, setInvestors] = useState([]);
  const [openInvGroup, setOpenInvGroup] = useState({});
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [revising, setRevising] = useState(null);
  const [renewing, setRenewing] = useState(null);
  const [redeeming, setRedeeming] = useState(null);      // Redeem dialog (before maturity)
  const [payingOut, setPayingOut] = useState(null);      // Payout dialog (at maturity)
  const [historyFor, setHistoryFor] = useState(null);    // History dialog
  const [portfolioFor, setPortfolioFor] = useState(null); // the person's whole portfolio
  const [selecting, setSelecting] = useState(false);     // pick several to delete at once
  const [picked, setPicked] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);    // investor being deleted
  const [showImport, setShowImport] = useState(false);   // Import from Excel
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

  // Delete an investment — managers only; the server refuses once money has moved.
  async function deleteInvestor(inv) {
    if (!(await confirmDialog(`Delete ${inv.name}${inv.loi_no ? ` (LOI ${inv.loi_no})` : ''} · ${fmtMoney(inv.amount_invested)} permanently? Its payout schedule and referral rewards are deleted with it. This can't be undone.`,
      { title: 'Delete investor?', confirmText: 'Delete', tone: 'danger' }))) return;
    setDeletingId(inv.id);
    const r = await apiFetch(CLUB1000_ENDPOINTS.investor(inv.id), { method: 'DELETE' }).catch(() => null);
    setDeletingId(null);
    if (!r || !(r.ok || r.status === 204)) { notify(errText(r ? await r.json().catch(() => ({})) : {}, 'Could not delete the investor.'), 'error'); return; }
    notify('Investor deleted', 'success');
    load();
  }

  const togglePick = (ids, on) => setPicked((prev) => {
    const next = new Set(prev);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    return next;
  });
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };

  // Delete every picked investment; any with money already paid are kept and named.
  async function bulkDelete() {
    const list = investors.filter((i) => picked.has(i.id));
    if (!list.length) return;
    const sum = list.reduce((t, i) => t + (Number(i.amount_invested) || 0), 0);
    if (!(await confirmDialog(`Delete ${list.length} investor${list.length === 1 ? '' : 's'} · ${fmtMoney(sum)} permanently? Their payout schedules and referral rewards go with them, and their leads will read Investor Deleted. Any with a payment already made are kept. This can't be undone.`,
      { title: `Delete ${list.length} investor${list.length === 1 ? '' : 's'}?`, confirmText: 'Delete', tone: 'danger' }))) return;
    setBulkBusy(true);
    const r = await apiFetch(CLUB1000_ENDPOINTS.investorBulkDelete, { method: 'POST', body: JSON.stringify({ ids: list.map((i) => i.id) }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBulkBusy(false);
    if (!r || !r.ok) { notify(errText(d, 'Could not delete the investors.'), 'error'); return; }
    const kept = d.refused || [];
    if (d.deleted?.length) notify(`${d.deleted.length} investor${d.deleted.length === 1 ? '' : 's'} deleted`, 'success');
    if (kept.length) notify(`${kept.length} not deleted — ${kept.map((k) => k.name || `#${k.id}`).join(', ')}: a payment is already made. Undo it first, or close with Redeem / Payout.`, 'error', { duration: 9000 });
    setPicked(new Set(kept.map((k) => k.id)));
    if (!kept.length) setSelecting(false);
    load();
  }

  // Scheme groups and the total, as on Approvals (and Sales' approvals).
  const invGroups = {};
  investors.forEach((i) => { const k = i.scheme_name || '—'; (invGroups[k] = invGroups[k] || []).push(i); });
  const invGroupNames = Object.keys(invGroups).sort();
  const invTotal = investors.reduce((t, i) => t + (Number(i.amount_invested) || 0), 0);
  const isInvOpen = (g) => (openInvGroup[g] === undefined ? true : openInvGroup[g]);

  return (
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Investors</h1>
          {/* Says what is on screen, not what the page is for. "All approved
              investors across Club 1000" above eight filtered rows reads as the
              whole book, which is how a working filter looks broken. */}
          <p className="club-inv-sub">
            {loading ? (manager ? 'All approved investors across Club 1000' : 'Your approved investors')
              : `${investors.length} investor${investors.length === 1 ? '' : 's'}`
                + (bucket === 'due_for_renewal' ? ' due for renewal'
                  : bucket === 'maturing_soon' ? ' maturing in 30 days'
                  : narrowed ? ' matching' : (manager ? ' · all approved, across Club 1000' : ' · your approved investors'))}
          </p>
        </div>
        <div className="c1-head-actions">
          <div className="c1-head-acts">
            {manager && can(user, 'club.investor.manage') && (
              <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setShowImport(true)} disabled={!schemes.length}><Icon name="upload" /> Import</button>
            )}
            {manager && investors.length > 0 && (
              <button className={`nx-btn nx-btn-md ${selecting ? 'nx-btn-primary' : 'nx-btn-secondary'}`} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
                <Icon name={selecting ? 'x' : 'check-circle'} /> {selecting ? 'Cancel' : 'Select'}
              </button>
            )}
            {can(user, 'club.investor.manage') && <button className="nx-btn nx-btn-md nx-btn-success" onClick={() => setShowAdd(true)} disabled={!schemes.length}>+ Add Investor</button>}
          </div>
          {!loading && !schemes.length && (
            <div className="c1-warn-note">{manager ? 'Create a scheme first.' : 'No schemes yet — ask your manager to create one.'}</div>
          )}
        </div>
      </div>

      <div className="nx-search-wrap c1-search">
        <span className="nx-search-icon"><Icon name="search" /></span>
        <input className="nx-input nx-search-input" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search name, phone, email, investor no.…" />
      </div>

      {/* The same date control the dashboard carries, so a period means the
          same thing on both. Dated by investment date, as the dashboard is. */}
      <div className="club-inv-dates"><DateFilter onChange={setRange} /></div>

      <div className="club-inv-filters">
        <select className={`nx-input club-inv-sel${schemeFilter ? ' is-on' : ''}`} value={schemeFilter} onChange={(e) => setSchemeFilter(e.target.value)}>
          <option value="">All Schemes</option>
          {onlyPresent(schemes.map((s) => ({ value: String(s.id), label: s.name })), fx('scheme_ids'), schemeFilter).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className={`nx-input club-inv-sel${statusFilter ? ' is-on' : ''}`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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

      {/* The book on screen: how many investors and how much, like the approvals banner. */}
      {!loading && investors.length > 0 && (
        <div className="c1a-total">
          <div className="c1a-total-label">
            {narrowed ? 'Matching' : 'Total'} · {investors.length} investor{investors.length === 1 ? '' : 's'} · {invGroupNames.length} scheme{invGroupNames.length === 1 ? '' : 's'}
          </div>
          <div className="c1a-total-amt">{fmtMoney(invTotal)}</div>
        </div>
      )}

      {loading ? <div className="c1a-loading"><Loader label="Loading…" /></div> : investors.length === 0 ? (
        <div className="nx-card c1a-empty">{search ? 'No investors match your search.' : narrowed ? 'No investors match these filters.' : 'No investors yet.'}</div>
      ) : invGroupNames.map((gn) => (
        <div key={gn} className="c1a-group">
          <div className={`nx-card c1a-group-head${isInvOpen(gn) ? ' is-open' : ''}`} onClick={() => setOpenInvGroup((o) => ({ ...o, [gn]: !isInvOpen(gn) }))}>
            <div className="c1a-group-name">
              {selecting && (
                <input type="checkbox" className="c1-pick" aria-label={`Select all in ${gn}`}
                  checked={invGroups[gn].every((i) => picked.has(i.id))}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => togglePick(invGroups[gn].map((i) => i.id), e.target.checked)} />
              )}
              <Icon name="folder" /> {gn} <span className="c1a-group-count">· {invGroups[gn].length} investor{invGroups[gn].length === 1 ? '' : 's'}</span>
            </div>
            <div className="c1a-group-right">
              <span className="c1a-group-amt">{fmtMoney(invGroups[gn].reduce((t, i) => t + (Number(i.amount_invested) || 0), 0))}</span>
              <span className={`c1a-chev${isInvOpen(gn) ? ' is-open' : ''}`}>›</span>
            </div>
          </div>
          {isInvOpen(gn) && (
            <div className="c1a-cards">
              {invGroups[gn].map((inv) => (
                <div className={`nx-card c1a-card${selecting && picked.has(inv.id) ? ' is-picked' : ''}`} key={inv.id}>
                  <div className="c1a-card-top">
                    {selecting && (
                      <input type="checkbox" className="c1-pick" aria-label={`Select ${inv.name}`}
                        checked={picked.has(inv.id)} onChange={(e) => togglePick([inv.id], e.target.checked)} />
                    )}
                    <div className="c1a-card-main">
                      <div className="c1a-name">
                        {inv.name}
                        {inv.revision_no > 0 && <span className="c1a-rev">R{inv.revision_no}</span>}
                        {inv.is_matured && <span className="c1a-rev renew">MATURED</span>}
                        {inv.renewal_count > 0 && <span className="c1a-rev">RENEWED {inv.renewal_count}×</span>}
                      </div>
                      <div className="c1a-sub">{inv.phone || '—'}{inv.loi_no ? ` · LOI ${inv.loi_no}` : ''}{inv.reference_name ? ` · Ref ${inv.reference_name}${inv.reference_phone ? ` (${inv.reference_phone})` : ''}` : ''}</div>
                      <div className="c1a-sub2">
                        {inv.total_return_pct}% · {inv.interest_payout === 'monthly' ? 'Monthly' : inv.interest_payout === 'quarterly' ? 'Quarterly' : 'At maturity'}
                        {' · '}Invested {formatDMY(inv.investment_date)} → Matures {formatDMY(inv.maturity_date)}
                        {manager && inv.added_by_name ? ` · Added by ${inv.added_by_name}` : ''}
                      </div>
                    </div>
                    <div className="c1a-card-side">
                      <div className="c1a-amt">{fmtMoney(inv.amount_invested)}</div>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                  <div className="c1a-actions">
                    <button className="nx-btn nx-btn-sm nx-btn-success-soft" onClick={() => setLedgerFor(inv.id)}><Icon name="book" /> Ledger</button>
                    <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setHistoryFor(inv)}><Icon name="clock" /> History</button>
                    <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setPortfolioFor(inv.id)}><Icon name="users" /> Portfolio</button>
                    {inv.loi_document_url && <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => openLoi(inv.id)}><Icon name="file" /> Signed LOI</button>}
                    {inv.document_url && <a className="nx-btn nx-btn-sm nx-btn-secondary" href={inv.document_url} target="_blank" rel="noreferrer"><Icon name="clip" /> KYC</a>}
                    {/* Viewing on the left; what changes the investment on the right. */}
                    <span className="c1a-actions-gap" />
                    {can(user, 'club.investor.manage') && <button className="nx-btn nx-btn-sm nx-btn-soft" onClick={() => setRevising(inv)}>↻ Revise LOI</button>}
                    {inv.is_matured ? (can(user, 'club.investor.manage') && <>
                      <button className="nx-btn nx-btn-sm c1-warn-btn" onClick={() => setRenewing(inv)}>↻ Renew</button>
                      {manager && <button className="nx-btn nx-btn-sm c1-warn-btn" onClick={() => setPayingOut(inv)}>Payout</button>}
                    </>) : (manager && inv.status === 'active' && can(user, 'club.investor.manage') && (
                      <button className="nx-btn nx-btn-sm c1-warn-btn" onClick={() => setRedeeming(inv)}>Redeem</button>
                    ))}
                    {manager && (
                      <button className="nx-btn nx-btn-sm nx-btn-danger-soft" onClick={() => deleteInvestor(inv)} disabled={deletingId === inv.id}>
                        {deletingId === inv.id ? <><span className="nx-spin" aria-hidden="true" /> Deleting…</> : <><Icon name="trash" /> Delete</>}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {showAdd && (
        <AddInvestorModal schemes={schemes} onClose={() => setShowAdd(false)} onCreated={() => load()} />
      )}
      {revising && (
        // Revise LOI is the Add Investor form, prefilled — every field can change.
        <AddInvestorModal schemes={schemes} revise={revising}
          onClose={() => setRevising(null)} onCreated={() => load()} />
      )}
      {showImport && <ImportInvestorsModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); }} />}
      {historyFor && <HistoryModal investor={historyFor} onClose={() => setHistoryFor(null)} />}
      {selecting && (
        <div className="c1-bulkbar">
          <span><b>{picked.size}</b> selected{picked.size ? ` · ${fmtMoney(investors.filter((i) => picked.has(i.id)).reduce((t, i) => t + (Number(i.amount_invested) || 0), 0))}` : ''}</span>
          <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => togglePick(investors.map((i) => i.id), picked.size !== investors.length)}>
            {picked.size === investors.length ? 'Clear all' : `Select all ${investors.length}`}
          </button>
          <button type="button" className="nx-btn nx-btn-sm nx-btn-danger" onClick={bulkDelete} disabled={!picked.size || bulkBusy}>
            {bulkBusy ? <span className="nx-spin" /> : <Icon name="trash" />} Delete {picked.size || ''}
          </button>
        </div>
      )}
      {portfolioFor && <PortfolioModal investorId={portfolioFor} onClose={() => setPortfolioFor(null)} />}
      {redeeming && <RedeemModal investor={redeeming} onClose={() => setRedeeming(null)} onDone={() => { setRedeeming(null); load(); }} />}
      {payingOut && <MaturityPayoutModal investor={payingOut} onClose={() => setPayingOut(null)} onDone={() => { setPayingOut(null); load(); }} />}
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
