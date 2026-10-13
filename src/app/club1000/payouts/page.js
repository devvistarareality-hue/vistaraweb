'use client';
import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import {isClub1000Manager, can} from '../../../lib/moduleAccess';
import { formatDMY } from '../../../lib/dateFormat';
import { onlyPresent } from '../../../lib/presentOptions';
import DateFilter from '../../sales/_DateFilter';
import Icon from '../../../components/Icon';
import { fmtMoney } from '../_StatCard';
import Loader from '../../../components/Loader';
import { errText } from '../../../lib/apiError';

const TEAL = 'var(--success)';
const th = { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 };
const td = { padding: '12px 16px', borderTop: '1px solid var(--surface-2)', color: 'var(--text)' };
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 };
const inp = { width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1.5px solid var(--border-strong)', fontSize: 13, boxSizing: 'border-box' };

const TYPE_LABELS = { interest: 'Interest', maturity: 'Maturity', premature_redemption: 'Premature Redemption' };
const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = [{ value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }];

export default function PayoutsPage() {
  const user = useSelector((s) => s.auth.user);
  const router = useRouter();
  const manager = isClub1000Manager(user);
  const [payouts, setPayouts] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  // A payout ledger is read by due date, by what kind of payout it is, and by
  // which scheme it belongs to — the same cuts the dashboard's payout figures
  // are made along, so a tile's number has a list that matches it.
  const [typeFilter, setTypeFilter] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  // The two live questions no stored column answers: what has slipped past its
  // date, and what lands in the next 30 days. Both mean pending — something
  // already paid is not late however old it is.
  const [bucket, setBucket] = useState('');
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText), 400);
    return () => clearTimeout(t);
  }, [searchText]);
  // Only the values these rows hold (?facets=1) — a picker that lists a choice
  // returning nothing is worse than no picker.
  const [facets, setFacets] = useState(null);
  const fx = (key) => facets?.[key] ?? null;
  const [payingFor, setPayingFor] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // Seed the status filter from the URL so the dashboard's Pending/Paid Payouts
  // stat cards can deep-link into the matching tab (?status=pending|paid). Done
  // in an effect, not a lazy initializer, since window.location isn't committed
  // yet during Next client navigation when the initializer runs.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setStatusFilter(p.get('status') ?? 'pending');
    setBucket(p.get('bucket') || '');
    setSeeded(true);
  }, []);

  useEffect(() => {
    if (user && !manager) router.replace('/club1000');
  }, [user]);

  useEffect(() => {
    if (!manager) return;
    let alive = true;
    apiFetch(`${CLUB1000_ENDPOINTS.payouts}?facets=1`).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setFacets(d); }).catch(() => {});
    apiFetch(CLUB1000_ENDPOINTS.schemes).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setSchemes(d); }).catch(() => {});
    return () => { alive = false; };
  }, [manager]);

  // Every fetch takes a ticket; only the newest one writes to state. Filters
  // change faster than the network answers, and an earlier, slower response
  // landing last would otherwise win.
  const reqRef = useRef(0);

  async function load() {
    const ticket = ++reqRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('payout_type', typeFilter);
      if (schemeFilter) params.set('scheme_id', schemeFilter);
      if (bucket) params.set('bucket', bucket);
      if (search) params.set('search', search);
      if (range.from) params.set('date_from', range.from);
      if (range.to) params.set('date_to', range.to);
      const q = params.toString();
      const res = await apiFetch(`${CLUB1000_ENDPOINTS.payouts}${q ? `?${q}` : ''}`);
      const rows = res.ok ? await res.json() : null;
      if (ticket !== reqRef.current) return;   // a newer request has overtaken this one
      if (rows) setPayouts(rows);
    } finally {
      if (ticket === reqRef.current) setLoading(false);
    }
  }

  useEffect(() => { if (manager && seeded) load(); },
    [manager, seeded, statusFilter, typeFilter, schemeFilter, bucket, search, range.from, range.to]);

  // "Pending" is this screen's own default rather than a choice anyone made, so
  // it doesn't count as narrowing — otherwise the header would read as filtered
  // the moment the page opened.
  const narrowed = !!(typeFilter || schemeFilter || bucket || search || range.from || range.to
    || (statusFilter && statusFilter !== 'pending'));

  // DateFilter keeps its own period state and only reports changes, so clearing
  // `range` alone would leave it showing a period it is no longer applying.
  // Bumping its key remounts it back to "All".
  const [dateKey, setDateKey] = useState(0);

  function clearFilters() {
    setStatusFilter('pending'); setTypeFilter(''); setSchemeFilter('');
    setBucket(''); setSearchText(''); setSearch(''); setRange({ from: '', to: '' });
    setDateKey((n) => n + 1);
  }

  const listedTotal = payouts.reduce((sum, p) => sum + Number(p.amount_due || 0), 0);

  function openMarkPaid(p) {
    setErr('');
    setPayForm({ amount: String(p.amount_due), notes: '' });
    setPayingFor(p);
  }

  async function submitMarkPaid() {
    if (!payForm.amount) { setErr('Amount is required.'); return; }
    setSaving(true); setErr('');
    try {
      const res = await apiFetch(CLUB1000_ENDPOINTS.payoutMarkPaid(payingFor.id), {
        method: 'POST',
        body: JSON.stringify({ amount: payForm.amount, notes: payForm.notes }),
      });
      if (res.ok) {
        setPayingFor(null);
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        setErr(errText(d, 'Could not mark this payout paid.'));
      }
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  if (!manager) return null;

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>Payouts</h1>
      {/* Says what is on screen, not what the page is for — a stock description
          over a filtered list is how a working filter looks broken. */}
      <p className="club-inv-sub">
        {loading
          ? 'Interest, maturity, and premature-redemption ledger'
          : `${payouts.length}${statusFilter ? ` ${statusFilter}` : ''} payout${payouts.length === 1 ? '' : 's'} · ${fmtMoney(listedTotal)}`}
      </p>

      <div className="club-pay-search">
        <span className="club-pay-search-ico"><Icon name="search" /></span>
        <input className="nx-input" value={searchText} onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search investor name or phone…" />
        {searchText && (
          <button type="button" className="club-pay-clear" onClick={() => setSearchText('')}><Icon name="x" /></button>
        )}
      </div>

      {/* Dated by due date, which is the only date this ledger is read by. */}
      <div className="club-inv-dates"><DateFilter key={dateKey} onChange={setRange} /></div>

      <div className="club-inv-filters">
        <select className="nx-input club-inv-sel" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {onlyPresent(STATUS_OPTIONS, fx('statuses'), statusFilter).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="nx-input club-inv-sel" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {onlyPresent(TYPE_OPTIONS, fx('types'), typeFilter).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="nx-input club-inv-sel" value={schemeFilter} onChange={(e) => setSchemeFilter(e.target.value)}>
          <option value="">All Schemes</option>
          {onlyPresent(schemes.map((s) => ({ value: String(s.id), label: s.name })), fx('scheme_ids'), schemeFilter).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {/* Toggles rather than another dropdown: these two are what the screen
            is usually opened to apply. Each implies pending on its own, so
            picking one also moves the status picker — otherwise "Paid ·
            Overdue" shows an empty list and reads as a bug rather than as the
            contradiction it is. */}
        {[{ value: 'overdue', label: 'Overdue' }, { value: 'due_soon', label: 'Due in 30 days' }].map((b) => (
          <button key={b.value} type="button" className={`club-pay-pill${bucket === b.value ? ' is-on' : ''}`}
            onClick={() => { const on = bucket === b.value; setBucket(on ? '' : b.value); if (!on) setStatusFilter('pending'); }}>
            {b.label}
          </button>
        ))}
        {narrowed && (
          <button type="button" className="club-pay-reset" onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      <div className="nx-card" style={{ marginTop: 18, background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--surface-3)', overflow: 'hidden', overflowX: 'auto' }}>
        <table className="nx-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              <th style={th}>Investor</th>
              <th style={th}>Scheme</th>
              <th style={th}>Type</th>
              <th style={th}>Due Date</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--muted)' }}><Loader size="sm" /></td></tr>
            ) : payouts.length === 0 ? (
              <tr><td colSpan={7} className="club-pay-empty">
                {narrowed ? 'No payouts match these filters.' : 'No payouts.'}
              </td></tr>
            ) : payouts.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.investor_name}</td>
                <td style={td}>{p.scheme_name}</td>
                <td style={td}>{TYPE_LABELS[p.payout_type] || p.payout_type}</td>
                <td style={td}>{formatDMY(p.due_date)}</td>
                <td style={td}>
                  {fmtMoney(p.amount_due)}
                  {p.status === 'paid' && p.paid_amount != null && Number(p.paid_amount) !== Number(p.amount_due) && (
                    <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>Paid {fmtMoney(p.paid_amount)}</div>
                  )}
                </td>
                <td style={td}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: p.status === 'paid' ? 'var(--success-soft)' : 'var(--warning-soft)', color: p.status === 'paid' ? 'var(--success)' : 'var(--warning-2)' }}>
                    {p.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                  {p.status === 'paid' && p.notes && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>"{p.notes}"</div>}
                </td>
                <td style={td}>
                  {p.status === 'pending' && can(user, 'club.payout.mark_paid') && (
                    <button className="nx-btn nx-btn-sm nx-btn-success" onClick={() => openMarkPaid(p)} style={{ padding: '5px 10px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Mark Paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payingFor && (
        <div className="nx-modal-backdrop" onClick={() => setPayingFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(4,8,16,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="nx-modal" onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '100%', background: 'var(--surface)', borderRadius: 18, boxShadow: '0 24px 80px rgba(var(--ink-rgb),0.22)' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--surface-2)' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Mark Payout Paid</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                {payingFor.investor_name} · {TYPE_LABELS[payingFor.payout_type] || payingFor.payout_type} · Due {formatDMY(payingFor.due_date)}
              </div>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Amount Paid (₹)</label>
                <input className="nx-input" style={inp} type="number" min="0" step="0.01" value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Scheduled: {fmtMoney(payingFor.amount_due)}</div>
              </div>
              <div>
                <label style={lbl}>Remarks</label>
                <textarea className="nx-input" style={{ ...inp, height: 'auto', padding: '10px 12px', resize: 'vertical' }} rows={3}
                  value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  placeholder="e.g. paid via NEFT, rounded to nearest ₹10…" />
              </div>
              {err && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => setPayingFor(null)} style={{ padding: '9px 16px', background: 'var(--surface-2)', color: 'var(--text-3)', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button className="nx-btn nx-btn-md nx-btn-success" onClick={submitMarkPaid} disabled={saving} style={{ padding: '9px 16px', background: 'var(--success-solid)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Mark Paid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
