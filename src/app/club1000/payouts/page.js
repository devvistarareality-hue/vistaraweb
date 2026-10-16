'use client';
// Club 1000 Payouts — AR Collections turned around. AR chases money owed BY
// clients; here the company owes interest and principal TO investors. So the
// screen is one card per investor (not one row per payout): what is overdue to
// them, what falls due next, what they have been paid, and a Pay button that
// settles any of their pending payouts in one go.
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { notify } from '../../../lib/notify';
import { errText } from '../../../lib/apiError';
import LedgerModal from '../_LedgerModal';
import { C1Modal, C1Section, C1Field, C1Error } from '../_Form';

const TYPE_LABELS = { interest: 'Interest', maturity: 'Principal', premature_redemption: 'Premature redemption' };
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
    r.pending.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
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
  const [paying, setPaying] = useState(null);     // the investor row being paid
  const [ledgerFor, setLedgerFor] = useState(null);

  useEffect(() => { if (user && !manager) router.replace('/club1000'); }, [user]);
  // The dashboard's Pending / Paid tiles deep-link here (?status=pending|paid).
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (s === 'paid') setTab('paid');
    else if (s === 'pending') setTab('pending');
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
  const investors = useMemo(() => byInvestor(payouts || [], today, soon), [payouts, today, soon]);
  const scoped = investors.filter((r) => (!schemeSel.length || schemeSel.includes(r.scheme))
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
                      <small>{r.next ? `${formatDMY(r.next.due_date)} · ${TYPE_LABELS[r.next.payout_type] || r.next.payout_type}` : 'None scheduled'}</small>
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
      {ledgerFor && <LedgerModal investorId={ledgerFor} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}

// Settle any of one investor's pending payouts: the late ones are ticked to start
// with, each amount can be adjusted (rounding, a part payment), one note for all.
function PayModal({ row, today, onClose, onDone }) {
  const [sel, setSel] = useState(() => Object.fromEntries(row.pending.map((p) => [p.id, p.due_date < today])));
  const [amounts, setAmounts] = useState(() => Object.fromEntries(row.pending.map((p) => [p.id, String(Number(p.amount_due) || 0)])));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const picked = row.pending.filter((p) => sel[p.id]);
  const total = picked.reduce((t, p) => t + (Number(amounts[p.id]) || 0), 0);

  async function pay(e) {
    e.preventDefault();
    if (!picked.length) { setErr('Tick at least one payout.'); return; }
    setBusy(true); setErr('');
    let done = 0;
    for (const p of picked) {
      const res = await apiFetch(CLUB1000_ENDPOINTS.payoutMarkPaid(p.id), {
        method: 'POST', body: JSON.stringify({ amount: amounts[p.id], notes }),
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
    <C1Modal title="Pay investor" sub={`${row.name} · ${row.scheme}${row.loi_no ? ` · ${row.loi_no}` : ''}`} onClose={onClose} onSubmit={pay}
      footer={<>
        <button type="button" className="nx-btn nx-btn-md nx-btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="nx-btn nx-btn-md nx-btn-success" disabled={busy || !picked.length}>
          {busy ? 'Saving…' : `Mark ${picked.length || ''} paid · ${rupee(total)}`}
        </button>
      </>}>
      <C1Section title="Pending payouts">
        <div className="c1p-pay-list">
          {row.pending.map((p) => (
            <label key={p.id} className={`c1p-pay-row${p.due_date < today ? ' late' : ''}`}>
              <input type="checkbox" checked={!!sel[p.id]} onChange={(e) => setSel((s) => ({ ...s, [p.id]: e.target.checked }))} />
              <span className="c1p-pay-what">
                <b>{TYPE_LABELS[p.payout_type] || p.payout_type}</b>
                <span className="c1p-pay-when">Due {formatDMY(p.due_date)}{p.due_date < today ? ' · late' : ''}</span>
              </span>
              <input className="nx-input" type="text" inputMode="decimal" value={amounts[p.id]}
                onChange={(e) => setAmounts((a) => ({ ...a, [p.id]: e.target.value }))} disabled={!sel[p.id]} />
            </label>
          ))}
        </div>
        <div className="c1p-total"><span>To pay now</span><span>{rupee(total)}</span></div>
      </C1Section>
      <C1Section title="Payment">
        <C1Field label="Notes" hint="Cheque / UTR no., bank, anything to remember">
          <input className="nx-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. NEFT UTR 1234…" />
        </C1Field>
      </C1Section>
      <C1Error>{err}</C1Error>
    </C1Modal>
  );
}
