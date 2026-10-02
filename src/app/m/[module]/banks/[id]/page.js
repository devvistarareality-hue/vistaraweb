'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { notFound } from 'next/navigation';
import { Landmark, Printer, ArrowDownLeft, ArrowUpRight, CalendarRange, Inbox } from 'lucide-react';
import { AR_ENDPOINTS } from '../../../../../constants/api';
import { apiFetch } from '../../../../../utils/apiFetch';
import Loader from '../../../../../components/Loader';
import { formatDMY } from '../../../../../lib/dateFormat';
import { rupee } from '../../_ar';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Quick ranges — Indian financial year runs April to March.
function presetRange(key) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (key === 'month') return [iso(new Date(y, m, 1)), iso(now)];
  if (key === 'last') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
  if (key === 'fy') return [iso(new Date(m >= 3 ? y : y - 1, 3, 1)), iso(now)];
  return ['', ''];
}
const PRESETS = [['all', 'All time'], ['month', 'This month'], ['last', 'Last month'], ['fy', 'This financial year']];

const initials = (name) => {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '—';
};
const dayBlock = (isoDate) => {
  const d = new Date(`${isoDate}T00:00:00`);
  return { day: d.getDate(), mon: d.toLocaleDateString('en-IN', { month: 'short' }), yr: d.getFullYear() };
};

// A bank's statement, passbook style: opening (or brought-forward) balance, then every
// Loan payment received into it in date order with a running balance. The closing
// figure is the same balance Bank Master shows.
export default function ARBankStatementPage({ params }) {
  if (params.module !== 'ar') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null); setErr('');
    const q = [from && `from=${from}`, to && `to=${to}`, companyId && `company_id=${companyId}`].filter(Boolean).join('&');
    apiFetch(AR_ENDPOINTS.bankStatement(params.id) + (q ? `?${q}` : ''))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) { setErr(d.detail || 'Could not load the statement.'); setData({}); return; }
        setData(d);
      })
      .catch(() => { if (alive) { setErr('Could not load the statement. Check your connection.'); setData({}); } });
    return () => { alive = false; };
  }, [params.id, from, to, companyId]);

  const preset = useMemo(() => {
    const hit = PRESETS.find(([k]) => { const [f, t] = presetRange(k); return f === from && t === to; });
    return hit ? hit[0] : 'custom';
  }, [from, to]);
  const pick = (k) => { const [f, t] = presetRange(k); setFrom(f); setTo(t); };

  const bank = data?.bank;
  const rows = data?.rows || [];
  const ranged = !!(from || to);
  const periodText = ranged
    ? `${from ? formatDMY(from) : 'Start'} – ${to ? formatDMY(to) : 'Today'}`
    : 'All time';

  return (
    <div className="nx-page">
      <Link href={`/m/${params.module}/banks`} className="arb-back">← Bank Master</Link>

      {err && <div className="nx-note bad">{err}</div>}

      <div className="ard-hero bst-hero">
        <div className="ard-hero-main">
          <div className="bst-bank">
            <span className="bst-bank-icon"><Landmark size={20} /></span>
            <div>
              <div className="bst-bank-name">{bank?.name || 'Bank statement'}</div>
              <div className="bst-bank-sub">{bank?.account_no ? `A/c ${bank.account_no} · ` : ''}{periodText}</div>
            </div>
          </div>
          <div className="ard-hero-label bst-gap">{ranged && to ? `Balance on ${formatDMY(to)}` : 'Closing balance'}</div>
          <div className="ard-hero-value">{data ? rupee(data.closing_balance) : '—'}</div>
          <div className="ard-hero-split">
            <div><span>{ranged && from ? `Brought forward (${formatDMY(from)})` : 'Opening balance'}</span><b>{data ? rupee(data.brought_forward) : '—'}</b></div>
            <div><span>Received{ranged ? ' in period' : ''}</span><b className="bst-in">+ {data ? rupee(data.total_in) : '—'}</b></div>
            {data?.total_out > 0 && <div><span>Refunds paid</span><b className="bst-out">− {rupee(data.total_out)}</b></div>}
            <div><span>Payments</span><b>{rows.length}</b></div>
          </div>
        </div>
        <div className="ard-hero-side bst-noprint">
          <button className="nx-btn nx-btn-md nx-btn-secondary" onClick={() => window.print()}><Printer size={15} /> Print</button>
        </div>
      </div>

      <div className="nx-card bst-tools bst-noprint">
        <div className="bst-chips">
          <CalendarRange size={16} className="bst-tools-icon" />
          {PRESETS.map(([k, label]) => (
            <button key={k} className={`bst-chip${preset === k ? ' is-on' : ''}`} onClick={() => pick(k)}>{label}</button>
          ))}
        </div>
        <div className="bst-dates">
          <label>From<input type="date" className="nx-input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To<input type="date" className="nx-input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </div>

      {data === null ? <Loader label="Loading statement…" /> : !err && (
        <div className="nx-card bst-card">
          <div className="bst-head">
            <span>Date</span><span>Particulars</span><span>Remarks</span><span className="num">Amount</span><span className="num">Balance</span>
          </div>

          <div className="bst-row bst-row-ob">
            <div className="bst-date">{from ? <DateBlock iso={from} /> : <span className="bst-dash">—</span>}</div>
            <div className="bst-part"><b>{from ? 'Balance brought forward' : 'Opening balance'}</b></div>
            <div className="bst-rem" />
            <div className="num" />
            <div className="num bst-bal">{rupee(data.brought_forward)}</div>
          </div>

          {rows.length === 0 ? (
            <div className="bst-empty">
              <Inbox size={34} />
              <b>No entries{ranged ? ' in this period' : ' yet'}</b>
              <span>Record a payment with mode Loan and pick this bank — it will show up here.</span>
            </div>
          ) : rows.map((r) => (
            <div key={r.id} className={`bst-row${r.kind === 'out' ? ' is-out' : ''}`}>
              <div className="bst-date"><DateBlock iso={r.date} /></div>
              <div className="bst-part">
                <span className="bst-avatar">{initials(r.client)}</span>
                <div className="bst-who">
                  <Link href={`/m/${params.module}/ledger/${r.account_id}`} className="arb-link">{r.client || '—'}</Link>
                  <div className="bst-tags">
                    {r.project && <span className="bst-tag">{r.project}</span>}
                    {r.plots && <span className="bst-tag">Plot {r.plots}</span>}
                    {r.recorded_by && <span className="bst-by">by {r.recorded_by}</span>}
                  </div>
                </div>
              </div>
              <div className="bst-rem">{r.remarks || <span className="bst-dash">—</span>}</div>
              <div className="num">
                {r.kind === 'out'
                  ? <span className="bst-amt bst-amt-out"><ArrowUpRight size={13} />{rupee(r.amount)}</span>
                  : <span className="bst-amt"><ArrowDownLeft size={13} />{rupee(r.amount)}</span>}
              </div>
              <div className="num bst-bal">{rupee(r.balance)}</div>
            </div>
          ))}

          <div className="bst-row bst-row-close">
            <div className="bst-date" />
            <div className="bst-part"><b>Closing balance</b></div>
            <div className="bst-rem" />
            <div className="num bst-in">+ {rupee(data.total_in)}{data.total_out > 0 && <div className="bst-out">− {rupee(data.total_out)}</div>}</div>
            <div className="num bst-bal">{rupee(data.closing_balance)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function DateBlock({ iso: d }) {
  const b = dayBlock(d);
  return (
    <span className="bst-dblock"><b>{b.day}</b><span>{b.mon} {b.yr}</span></span>
  );
}
