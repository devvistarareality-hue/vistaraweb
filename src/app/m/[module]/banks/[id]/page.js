'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { notFound } from 'next/navigation';
import { AR_ENDPOINTS } from '../../../../../constants/api';
import { apiFetch } from '../../../../../utils/apiFetch';
import Loader from '../../../../../components/Loader';
import { formatDMY } from '../../../../../lib/dateFormat';
import { rupee } from '../../_ar';

// A bank's statement, ledger style: opening (or brought-forward) balance, then every
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

  const bank = data?.bank;
  const ranged = !!(from || to);

  return (
    <div className="nx-page">
      <Link href={`/m/${params.module}/banks`} className="arb-back">← Bank Master</Link>
      <div className="arb-head">
        <div>
          <h1 className="nx-page-title">{bank ? bank.name : 'Bank statement'}</h1>
          <p className="nx-page-sub">
            {bank?.account_no ? `A/c ${bank.account_no} · ` : ''}Loan payments received into this bank, with a running balance.
          </p>
        </div>
        <div className="arb-range">
          <label className="arb-range-field">From<input type="date" className="nx-input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="arb-range-field">To<input type="date" className="nx-input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
          {ranged && <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => { setFrom(''); setTo(''); }}>Clear</button>}
          <button className="nx-btn nx-btn-sm nx-btn-secondary" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {err && <div className="nx-note bad">{err}</div>}
      {data === null ? <Loader label="Loading statement…" /> : !err && (
        <>
          <div className="arb-sum">
            <div className="nx-card arb-sum-card"><span>{ranged && from ? `Balance on ${formatDMY(from)}` : 'Opening balance'}</span><b>{rupee(data.brought_forward)}</b></div>
            <div className="nx-card arb-sum-card"><span>Received{ranged ? ' in range' : ''}</span><b className="arb-in">+ {rupee(data.total_in)}</b></div>
            <div className="nx-card arb-sum-card"><span>{ranged && to ? `Balance on ${formatDMY(to)}` : 'Closing balance'}</span><b className="arb-balance">{rupee(data.closing_balance)}</b></div>
          </div>

          <div className="nx-card arb-card">
            <div className="arb-scroll">
              <table className="nx-table arb-table">
                <thead>
                  <tr><th>Date</th><th>Particulars</th><th>Remarks</th><th className="num">Received</th><th className="num">Balance</th></tr>
                </thead>
                <tbody>
                  <tr className="arb-ob">
                    <td>{from ? formatDMY(from) : '—'}</td>
                    <td>{from ? 'Balance brought forward' : 'Opening balance'}</td>
                    <td />
                    <td className="num" />
                    <td className="num arb-balance">{rupee(data.brought_forward)}</td>
                  </tr>
                  {(data.rows || []).map((r) => (
                    <tr key={r.id}>
                      <td>{formatDMY(r.date)}</td>
                      <td>
                        <Link href={`/m/${params.module}/ledger/${r.account_id}`} className="arb-link">{r.client || '—'}</Link>
                        <div className="arb-sub">{r.project}{r.plots ? ` · Plot ${r.plots}` : ''}{r.recorded_by ? ` · by ${r.recorded_by}` : ''}</div>
                      </td>
                      <td className="arb-remarks">{r.remarks || '—'}</td>
                      <td className="num arb-in">{rupee(r.amount)}</td>
                      <td className="num arb-balance">{rupee(r.balance)}</td>
                    </tr>
                  ))}
                  {!(data.rows || []).length && (
                    <tr><td colSpan={5} className="arb-empty">No Loan payments into this bank{ranged ? ' in this range' : ' yet'}.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3}>Closing balance</td><td className="num arb-in">{rupee(data.total_in)}</td><td className="num arb-balance">{rupee(data.closing_balance)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
