'use client';
// Club 1000 Payouts — AR Collections turned around. AR chases money owed BY
// clients; here the company owes interest and principal TO investors. So the
// screen is one card per investor (not one row per payout): what is overdue to
// them, what falls due next, what they have been paid, and a Pay button that
// settles any of their pending payouts in one go.
import { settledTo, settledRemark } from '../../../lib/c1Settled';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { AlarmClock, CalendarClock, Wallet, CircleCheckBig, Layers, Phone, FileText } from 'lucide-react';
import { CLUB1000_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { isClub1000Manager, can } from '../../../lib/moduleAccess';
import { formatDMY } from '../../../lib/dateFormat';
import { rupee, inrShort } from '../../../lib/inr';
import { DashKpi } from '../../../components/Dash';
import MultiSelect from '../../../components/MultiSelect';
import Loader from '../../../components/Loader';
import { notify, confirmDialog } from '../../../lib/notify';
import { errText } from '../../../lib/apiError';
import LedgerModal from '../_LedgerModal';
import { C1Modal, C1Section, C1Error } from '../_Form';
import DateFilter from '../../sales/_DateFilter';

const TYPE_LABELS = { interest: 'Interest', maturity: 'Principal', premature_redemption: 'Premature redemption' };
// An at-maturity payout is principal AND the term's interest in one payment.
const typeLabel = (p) => (p.maturity_split
  ? `Principal + interest · ${rupee(p.maturity_split.principal)} + ${rupee(p.maturity_split.interest)}`
  : (TYPE_LABELS[p.payout_type] || p.payout_type));
const DUE_SOON_DAYS = 30;
const iso = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// One row per investor, built from their payouts.
function byInvestor(payouts, today, soon) {
  const map = new Map();
  for (const p of payouts) {
    let r = map.get(p.investor);
    if (!r) {
      r = { id: p.investor, name: p.investor_name, phone: p.investor_phone, loi_no: p.investor_loi_no,
        scheme: p.scheme_name, pending: [], paid: [] };
      map.set(p.investor, r);
    }
    (p.status === 'paid' ? r.paid : r.pending).push(p);
  }
  for (const r of map.values()) {
    // By due date; on the same day interest comes before the principal it is paid with.
    const order = (a, b) => String(a.due_date).localeCompare(String(b.due_date))
      || (a.payout_type === 'maturity') - (b.payout_type === 'maturity');
    r.pending.sort(order);
    r.schedulePaid = [...r.paid].sort(order);
    r.paid.sort((a, b) => String(b.paid_date || '').localeCompare(String(a.paid_date || '')));
    r.overdue = r.pending.filter((p) => p.due_date < today);
    r.overdueAmt = r.overdue.reduce((t, p) => t + (Number(p.amount_due) || 0), 0);
    r.next = r.pending.find((p) => p.due_date >= today) || null;
    r.dueSoon = r.pending.filter((p) => p.due_date >= today && p.due_date <= soon);
    r.dueSoonAmt = r.dueSoon.reduce((t, p) => t + (Number(p.amount_due) || 0), 0);
    r.pendingAmt = r.pending.reduce((t, p) => t + (Number(p.amount_due) || 0), 0);
    r.paidAmt = r.paid.reduce((t, p) => t + (Number(p.paid_amount ?? p.amount_due) || 0), 0);
    r.daysLate = r.overdue.length
      ? Math.round((new Date(`${today}T00:00:00`) - new Date(`${r.overdue[0].due_date}T00:00:00`)) / 86400000) : 0;
  }
  return [...map.values()];
}

export default function PayoutsPage() {
  const user = useSelector((s) => s.auth.user);
  const router = useRouter();
  const manager = isClub1000Manager(user);
  const canPay = can(user, 'club.payout.mark_paid');
  const [payouts, setPayouts] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [tab, setTab] = useState('overdue');
  const [schemeSel, setSchemeSel] = useState([]);
  const [q, setQ] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });   // Year / Month / Quarter / dates
  const [kind, setKind] = useState('both');   // interest / principal / both
  const [onlyInv, setOnlyInv] = useState(null);   // ?investor=<id> — one investor, from their card
  const [paying, setPaying] = useState(null);     // the investor row being paid
  const [paidFor, setPaidFor] = useState(null);   // the investor whose paid payouts are listed
  const [ledgerFor, setLedgerFor] = useState(null);

  useEffect(() => { if (user && !manager) router.replace('/club1000'); }, [user]);
  // The dashboard's Pending / Paid tiles deep-link here (?status=pending|paid).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get('status');
    if (s === 'paid') setTab('paid');
    else if (s === 'pending') setTab('pending');
    // The Payout button on an investor's card opens here on just that investment.
    if (sp.get('investor')) { setOnlyInv(Number(sp.get('investor'))); setTab('pending'); }
  }, []);

  const reqRef = useRef(0);
  async function load() {
    const ticket = ++reqRef.current;
    const res = await apiFetch(CLUB1000_ENDPOINTS.payouts).catch(() => null);
    const rows = res && res.ok ? await res.json() : [];
    if (ticket === reqRef.current) setPayouts(Array.isArray(rows) ? rows : []);
  }
  useEffect(() => {
    if (!manager) return;
    load();
    apiFetch(CLUB1000_ENDPOINTS.schemes).then((r) => (r.ok ? r.json() : [])).then((d) => setSchemes(Array.isArray(d) ? d : [])).catch(() => {});
  }, [manager]);

  const today = iso(new Date());
  const soon = iso(new Date(Date.now() + DUE_SOON_DAYS * 86400000));
  // The period picked above: unpaid payouts by their due date, paid ones by the day
  // they were paid. Every figure, tab and card below follows it.
  const inPeriod = (p) => {
    const d = String((p.status === 'paid' ? p.paid_date : p.due_date) || '').slice(0, 10);
    return (!range.from || d >= range.from) && (!range.to || d <= range.to)
      && (kind === 'both' || (kind === 'interest' ? p.payout_type === 'interest' : p.payout_type !== 'interest'));
  };
  const investors = useMemo(() => byInvestor((payouts || []).filter(inPeriod), today, soon),
    [payouts, today, soon, range.from, range.to, kind]);
  const scoped = investors.filter((r) => (!onlyInv || r.id === onlyInv) && (!schemeSel.length || schemeSel.includes(r.scheme))
    && (!q.trim() || `${r.name} ${r.phone} ${r.loi_no}`.toLowerCase().includes(q.trim().toLowerCase())));
  const lists = {
    overdue: scoped.filter((r) => r.overdue.length).sort((a, b) => b.daysLate - a.daysLate || b.overdueAmt - a.overdueAmt),
    upcoming: scoped.filter((r) => r.dueSoon.length).sort((a, b) => String(a.dueSoon[0].due_date).localeCompare(String(b.dueSoon[0].due_date))),
    pending: scoped.filter((r) => r.pending.length).sort((a, b) => b.pendingAmt - a.pendingAmt),
    paid: scoped.filter((r) => r.paid.length).sort((a, b) => String(b.paid[0].paid_date || '').localeCompare(String(a.paid[0].paid_date || ''))),
  };
  const rows = lists[tab];
  const sum = (list, k) => list.reduce((t, r) => t + r[k], 0);

  if (!manager) return null;

  return (
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Payouts</h1>
          <p className="nx-page-sub">Interest and principal owed to investors — who is due, what is late, and what has been paid · as of {formatDMY(today)}</p>
        </div>
        <div className="ard-filters">
          {schemes.length > 1 && (
            <MultiSelect allLabel="All Schemes" noun="schemes" value={schemeSel} onChange={setSchemeSel}
              options={schemes.map((s) => ({ value: s.name, label: s.name }))} />
          )}
        </div>
      </div>

      <div className="c1-datebar">
        <DateFilter onChange={setRange} />
        <div className="c1pa-seg" role="tablist" aria-label="What to show">
          {[['both', 'Interest + Principal'], ['interest', 'Interest'], ['principal', 'Principal']].map(([k, label]) => (
            <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
      </div>

      {payouts === null ? <Loader label="Working out who is owed what…" /> : (
        <>
          <div className="col-kpis">
            <DashKpi icon={AlarmClock} tone="bad" label="Overdue to pay" value={inrShort(sum(lists.overdue, 'overdueAmt'))} valueTitle={rupee(sum(lists.overdue, 'overdueAmt'))} sub={`${lists.overdue.length} investors waiting`} />
            <DashKpi icon={CalendarClock} tone="warn" label={`Due in ${DUE_SOON_DAYS} days`} value={inrShort(sum(lists.upcoming, 'dueSoonAmt'))} valueTitle={rupee(sum(lists.upcoming, 'dueSoonAmt'))} sub={`${lists.upcoming.length} investors`} />
            <DashKpi icon={Wallet} tone="info" label="All pending" value={inrShort(sum(lists.pending, 'pendingAmt'))} valueTitle={rupee(sum(lists.pending, 'pendingAmt'))} sub={`${lists.pending.length} investors`} />
            <DashKpi icon={CircleCheckBig} tone="good" label="Paid out" value={inrShort(sum(lists.paid, 'paidAmt'))} valueTitle={rupee(sum(lists.paid, 'paidAmt'))} sub={`${lists.paid.length} investors`} />
          </div>

          <div className="nx-filters col-tabs">
            {[['overdue', `Overdue · ${lists.overdue.length}`], ['upcoming', `Due in ${DUE_SOON_DAYS} days · ${lists.upcoming.length}`],
              ['pending', `All pending · ${lists.pending.length}`], ['paid', `Paid · ${lists.paid.length}`]].map(([k, label]) => (
              <button type="button" key={k} className={`nx-btn nx-btn-md nx-toggle${tab === k ? ' is-on' : ''}`} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>

          <div className="ar-filters">
            <input className="nx-input nx-input-sm ar-search" placeholder="Search investor, phone or LOI no…" value={q} onChange={(e) => setQ(e.target.value)} />
            {onlyInv && (
              <button type="button" className="club-bucket" onClick={() => { setOnlyInv(null); router.replace('/club1000/payouts'); }}>
                Only {investors.find((r) => r.id === onlyInv)?.name || 'this investor'}{investors.find((r) => r.id === onlyInv)?.loi_no ? ` · ${investors.find((r) => r.id === onlyInv).loi_no}` : ''}
                <span className="club-bucket-x">×</span>
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="nx-card ar-card"><div className="ar-empty">
              {tab === 'overdue' ? 'Nobody is waiting on a late payout.' : tab === 'upcoming' ? `Nothing falls due in the next ${DUE_SOON_DAYS} days.`
                : tab === 'paid' ? 'No payouts have been made yet.' : 'No payouts pending.'}
            </div></div>
          ) : (
            <div className="coll-grid">
              {rows.map((r) => (
                <article key={r.id} className={`nx-card coll-card${tab === 'overdue' && r.daysLate > 90 ? ' is-late' : ''}`}>
                  <header className="coll-head">
                    <div className="coll-who">
                      <h3 title={r.name}>{r.name || '—'}</h3>
                      <div className="coll-meta">
                        <span className="coll-chip"><Layers size={12} /> {r.scheme}</span>
                        {r.loi_no ? <span className="coll-chip"><FileText size={12} /> {r.loi_no}</span> : null}
                        {r.phone ? <span className="coll-chip"><Phone size={12} /> {r.phone}</span> : null}
                      </div>
                    </div>
                    {r.overdue.length
                      ? <span className={`coll-age ${r.daysLate > 90 ? 'bad' : 'warn'}`}><b>{r.daysLate}</b><span>days late</span></span>
                      : r.pending.length
                        ? <span className="coll-age info"><b>{r.pending.length}</b><span>pending</span></span>
                        : <span className="coll-age info"><b>{r.paid.length}</b><span>paid</span></span>}
                  </header>

                  <div className="coll-figs">
                    <div className={`coll-fig${r.overdueAmt ? ' bad' : ''}`}>
                      <span>Overdue</span><b title={rupee(r.overdueAmt)}>{r.overdueAmt ? rupee(r.overdueAmt) : '—'}</b>
                      <small>{r.overdue.length ? `${r.overdue.length} payout${r.overdue.length === 1 ? '' : 's'} · since ${formatDMY(r.overdue[0].due_date)}` : 'Nothing late'}</small>
                    </div>
                    <div className="coll-fig">
                      <span>Next payout</span><b>{r.next ? rupee(r.next.amount_due) : '—'}</b>
                      <small>{r.next ? `${formatDMY(r.next.due_date)} · ${typeLabel(r.next)}` : 'None scheduled'}</small>
                    </div>
                    <div className="coll-fig">
                      <span>Paid so far</span><b>{r.paidAmt ? rupee(r.paidAmt) : '—'}</b>
                      <small>{r.paid.length ? `Last ${formatDMY(r.paid[0].paid_date)}` : 'Nothing paid yet'}</small>
                    </div>
                  </div>

                  <footer className="coll-foot">
                    <div className="coll-fu">
                      <span className={`nx-status ${r.overdue.length ? 'bad' : r.pending.length ? 'ok' : 'off'}`}>
                        {r.pending.length ? `${rupee(r.pendingAmt)} still to pay · ${r.pending.length} payout${r.pending.length === 1 ? '' : 's'}` : 'All paid'}
                      </span>
                    </div>
                    <div className="coll-actions">
                      <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setLedgerFor(r.id)}>Ledger</button>
                      {r.paid.length > 0 && (
                        <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => setPaidFor(r.id)}>Paid ({r.paid.length})</button>
                      )}
                      {canPay && r.pending.length > 0 && (
                        <button type="button" className="nx-btn nx-btn-sm nx-btn-primary" onClick={() => setPaying(r)}><Wallet size={13} /> Pay</button>
                      )}
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {paying && <PayModal row={paying} today={today} onClose={() => setPaying(null)} onDone={() => { setPaying(null); load(); }} />}
      {paidFor && investors.find((x) => x.id === paidFor) && (
        <PaidModal row={investors.find((x) => x.id === paidFor)} canUndo={canPay && manager} onClose={() => setPaidFor(null)} onChanged={load} />
      )}
      {ledgerFor && <LedgerModal investorId={ledgerFor} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}

// Settle any of one investor's pending payouts. Each row carries its own target
// (what was due), the amount actually paid (the target unless changed), the date it
// was paid (today unless changed) and its own remarks. Late ones start ticked.
function PayModal({ row, today, onClose, onDone }) {
  const [lines, setLines] = useState(() => Object.fromEntries(row.pending.map((p) => [p.id, {
    on: p.due_date < today, amount: String(Number(p.amount_due) || 0),
      // A redemption is handed over on its redemption date, not the day it is recorded.
      date: p.payout_type === 'premature_redemption' && p.due_date && p.due_date <= today ? p.due_date : today, notes: '',
  }])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const setLine = (id, patch) => setLines((l) => ({ ...l, [id]: { ...l[id], ...patch } }));
  const picked = row.pending.filter((p) => lines[p.id]?.on);
  const total = picked.reduce((t, p) => t + (Number(lines[p.id].amount) || 0), 0);
  const target = picked.reduce((t, p) => t + (Number(p.amount_due) || 0), 0);

  async function pay(e) {
    e.preventDefault();
    if (!picked.length) { setErr('Tick at least one payout.'); return; }
    const bad = picked.find((p) => !lines[p.id].date || lines[p.id].date > today);
    if (bad) { setErr('Each paid date must be today or earlier.'); return; }
    setBusy(true); setErr('');
    let done = 0;
    for (const p of picked) {
      const l = lines[p.id];
      const res = await apiFetch(CLUB1000_ENDPOINTS.payoutMarkPaid(p.id), {
        method: 'POST', body: JSON.stringify({ amount: l.amount, paid_date: l.date, notes: l.notes }),
      }).catch(() => null);
      if (!res || !res.ok) {
        const d = res ? await res.json().catch(() => ({})) : {};
        setErr(`${done} of ${picked.length} paid — ${errText(d, 'the next one could not be saved.')}`);
        setBusy(false);
        if (done) onDone();
        return;
      }
      done += 1;
    }
    notify(`${done} payout${done === 1 ? '' : 's'} marked paid · ${rupee(total)}`, 'success');
    onDone();
  }

  return (
    <C1Modal wide title="Pay investor" sub={`${row.name} · ${row.scheme}${row.loi_no ? ` · ${row.loi_no}` : ''}`} onClose={onClose} onSubmit={pay}
      footer={<>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="nx-btn nx-btn-md nx-btn-success" disabled={busy || !picked.length}>
          {busy ? 'Saving…' : `Mark ${picked.length || ''} paid · ${rupee(total)}`}
        </button>
      </>}>
      <C1Section title="Pending payouts">
        <div className="c1p-grid">
          <div className="c1p-grid-head">
            <span />
            <span>Payout</span>
            <span className="num">Target</span>
            <span>Actual paid (₹)</span>
            <span>Paid on</span>
            <span>Remarks</span>
          </div>
          {row.pending.map((p, i) => {
            const l = lines[p.id];
            const head = p.term_label && (i === 0 || row.pending[i - 1].term_label !== p.term_label);
            const inTerm = head ? row.pending.filter((x) => x.term_label === p.term_label) : [];
            return (
              <Fragment key={p.id}>
                {head && (
                  <label className="c1p-termhead">
                    <input type="checkbox" checked={inTerm.every((x) => lines[x.id]?.on)} aria-label={`Pay all of ${p.term_label}`}
                      onChange={(e) => inTerm.forEach((x) => setLine(x.id, { on: e.target.checked }))} />
                    <b>{p.term_label}</b>
                    <span>{inTerm.length} payout{inTerm.length === 1 ? '' : 's'} · {rupee(inTerm.reduce((t, x) => t + (Number(x.amount_due) || 0), 0))}</span>
                  </label>
                )}
                {payRow(p, l)}
              </Fragment>
            );
          })}
        </div>
        <div className="c1p-total">
          <span>To pay now{picked.length ? ` · ${picked.length} payout${picked.length === 1 ? '' : 's'}` : ''}</span>
          <span>{rupee(total)}{total !== target && picked.length ? <small className="c1p-diff"> of {rupee(target)} due</small> : null}</span>
        </div>
      </C1Section>
      <C1Error>{err}</C1Error>
    </C1Modal>
  );

  function payRow(p, l) {
            const late = p.due_date < today;
            const diff = l.on && Number(l.amount) !== Number(p.amount_due);
            return (
              <div key={p.id} className={`c1p-grid-row${l.on ? '' : ' off'}`}>
                <input type="checkbox" checked={l.on} onChange={(e) => setLine(p.id, { on: e.target.checked })} aria-label="Pay this one" />
                <span className="c1p-pay-what">
                  <b>{typeLabel(p)}{p.period ? ` · ${p.period.label}` : ''}</b>
                  <span className={`c1p-pay-when${late ? ' late' : ''}`}>Due {formatDMY(p.due_date)}{late ? ' · late' : ''}</span>
                  {p.period && <span className="c1p-why">{formatDMY(p.period.from)} – {formatDMY(p.period.to)} · {p.period.days} days × ₹{Number(p.period.per_day).toLocaleString('en-IN')}/day</span>}
                </span>
                <span className="num c1p-target">{rupee(p.amount_due)}</span>
                <span className="c1p-cell">
                  <input className="nx-input" type="text" inputMode="decimal" value={l.amount} disabled={!l.on}
                    onChange={(e) => setLine(p.id, { amount: e.target.value })} />
                  {diff && <small className="c1p-diff">{Number(l.amount) < Number(p.amount_due)
                    ? `₹${(Number(p.amount_due) - Number(l.amount)).toLocaleString('en-IN', { maximumFractionDigits: 2 })} stays due as a balance`
                    : `More by ${rupee(Number(l.amount) - Number(p.amount_due))}`}</small>}
                </span>
                <input className="nx-input" type="date" max={today} value={l.date} disabled={!l.on}
                  onChange={(e) => setLine(p.id, { date: e.target.value })} />
                <input className="nx-input" value={l.notes} disabled={!l.on} placeholder="UTR / cheque no."
                  onChange={(e) => setLine(p.id, { notes: e.target.value })} />
              </div>
            );
  }
}

// What has been paid to one investor, in schedule order — each with what went out,
// when and the remarks. Like an AR receipt, a payment can be edited (amount, date,
// remarks) or deleted (the payout goes back to pending).
function PaidModal({ row, canUndo, onClose, onChanged }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);   // { id, amount, date, notes }
  const [err, setErr] = useState('');

  async function save() {
    const e = editing;
    if (e.amount === '' || Number.isNaN(Number(e.amount)) || Number(e.amount) < 0) { setErr('Enter the amount paid.'); return; }
    if (!e.date || e.date > today) { setErr('The paid date must be today or earlier.'); return; }
    setBusyId(e.id); setErr('');
    const res = await apiFetch(CLUB1000_ENDPOINTS.payoutPayment(e.id), { method: 'PATCH', body: JSON.stringify({ amount: e.amount, paid_date: e.date, notes: e.notes }) }).catch(() => null);
    setBusyId(null);
    if (!res || !res.ok) { setErr(errText(res ? await res.json().catch(() => ({})) : {}, 'Could not save the payment.')); return; }
    notify('Payment updated', 'success');
    setEditing(null); onChanged();
  }

  async function remove(p) {
    if (!(await confirmDialog(`Delete the ${rupee(p.paid_amount ?? p.amount_due)} payment of ${formatDMY(p.paid_date)}? ${typeLabel(p)}${p.period ? ` · ${p.period.label}` : ''} goes back to pending.`,
      { title: 'Delete payment?', confirmText: 'Delete', tone: 'danger' }))) return;
    setBusyId(p.id);
    const res = await apiFetch(CLUB1000_ENDPOINTS.payoutPayment(p.id), { method: 'DELETE' }).catch(() => null);
    setBusyId(null);
    if (!res || !res.ok) { notify(errText(res ? await res.json().catch(() => ({})) : {}, 'Could not delete the payment.'), 'error'); return; }
    notify('Payment deleted — back to pending', 'success');
    onChanged();
  }

  const list = row.schedulePaid || row.paid;
  return (
    <C1Modal wide title="Paid payouts" sub={`${row.name} · ${row.scheme}${row.loi_no ? ` · ${row.loi_no}` : ''}`} onClose={onClose}
      footer={<button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Close</button>}>
      <C1Section title={`Paid · ${rupee(row.paidAmt)}`}>
        <div className="c1pp">
          <div className="c1pp-head">
            <span>Payout</span>
            <span className="num">Target</span>
            <span className="num">Paid</span>
            <span>Paid on</span>
            <span />
          </div>
          {list.map((p, i) => {
            const ed = editing && editing.id === p.id ? editing : null;
            const head = p.term_label && (i === 0 || list[i - 1].term_label !== p.term_label);
            const inTerm = head ? list.filter((x) => x.term_label === p.term_label) : [];
            const paidAmt = Number(p.paid_amount ?? p.amount_due) || 0;
            const short = paidAmt !== (Number(p.amount_due) || 0);
            return (
              <Fragment key={p.id}>
              {head && (
                <div className="c1p-termhead is-static">
                  <b>{p.term_label}</b>
                  <span>{inTerm.length} paid · {rupee(inTerm.reduce((t, x) => t + (Number(x.paid_amount ?? x.amount_due) || 0), 0))}</span>
                </div>
              )}
              <div className={`c1pp-row${ed ? ' editing' : ''}`}>
                <div className="c1pp-main">
                  <div className="c1pp-what">
                    <b>{typeLabel(p)}{p.period ? ` · ${p.period.label}` : ''}</b>
                    {p.term_label ? <span className="c1p-term">{p.term_label}</span> : null}
                    <small>Due {formatDMY(p.due_date)}{p.period ? ` · ${p.period.days} days × ₹${Number(p.period.per_day).toLocaleString('en-IN')}` : ''}</small>
                    {(settledTo(p.notes) ? settledRemark(p.notes) : p.notes) ? <small className="c1pp-notes">Remarks: {settledTo(p.notes) ? settledRemark(p.notes) : p.notes}</small> : null}
                  </div>
                  <span className="num c1pp-muted">{rupee(p.amount_due)}</span>
                  <span className={`num c1pp-paid${short ? ' short' : ''}`}>{rupee(paidAmt)}</span>
                  <span className="c1pp-date">{p.paid_date ? formatDMY(p.paid_date) : '—'}{settledTo(p.notes) ? <small className="c1pp-settled">{settledTo(p.notes)}</small> : null}</span>
                  <span className="c1pp-acts">
                    {canUndo && !ed && <>
                      <button type="button" className="nx-btn nx-btn-sm nx-btn-secondary" disabled={busyId === p.id || !!editing}
                        onClick={() => { setErr(''); setEditing({ id: p.id, amount: String(paidAmt), date: p.paid_date || today, notes: p.notes || '' }); }}>Edit</button>
                      <button type="button" className="nx-btn nx-btn-sm nx-btn-danger-soft" disabled={busyId === p.id || !!editing} onClick={() => remove(p)}>
                        {busyId === p.id ? <><span className="nx-spin" aria-hidden="true" /> Deleting…</> : 'Delete'}
                      </button>
                    </>}
                  </span>
                </div>
                {ed && (
                  <div className="c1pp-edit">
                    <label><span>Actual paid (₹)</span>
                      <input className="nx-input" type="text" inputMode="decimal" value={ed.amount} autoFocus onChange={(e) => setEditing({ ...ed, amount: e.target.value })} /></label>
                    <label><span>Paid on</span>
                      <input className="nx-input" type="date" max={today} value={ed.date} onChange={(e) => setEditing({ ...ed, date: e.target.value })} /></label>
                    <label className="wide"><span>Remarks</span>
                      <input className="nx-input" value={ed.notes} placeholder="UTR / cheque no." onChange={(e) => setEditing({ ...ed, notes: e.target.value })} /></label>
                    <span className="c1pp-edit-acts">
                      <button type="button" className="nx-btn nx-btn-sm nx-btn-ghost" disabled={busyId === p.id} onClick={() => { setEditing(null); setErr(''); }}>Cancel</button>
                      <button type="button" className="nx-btn nx-btn-sm nx-btn-success" disabled={busyId === p.id} onClick={save}>{busyId === p.id ? <><span className="nx-spin" aria-hidden="true" /> Saving…</> : 'Save'}</button>
                    </span>
                  </div>
                )}
              </div>
              </Fragment>
            );
          })}
        </div>
        <C1Error>{err}</C1Error>
      </C1Section>
    </C1Modal>
  );
}
