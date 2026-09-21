'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AR_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import { rupee, AGE_LABELS, ISSUES, today } from '../_ar';

// AR Dashboard — the whole receivables book at a glance: what is owed, how late,
// what falls due month by month, who owes the most, and which accounts cannot be
// trusted until their booking data is fixed.
export default function ARDashboardPage({ params }) {
  if (params.module !== 'ar') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [project, setProject] = useState('');
  const [asOf, setAsOf] = useState(today());
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null); setErr('');
    const p = [`as_of=${asOf}`];
    if (project) p.push(`project=${project}`);
    if (companyId) p.push(`company_id=${companyId}`);
    apiFetch(`${AR_ENDPOINTS.dashboard}?${p.join('&')}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) { setErr(d.detail || 'Could not load the dashboard.'); setData({}); return; }
        setData(d);
      })
      .catch(() => { if (alive) { setErr('Could not load the dashboard. Check your connection.'); setData({}); } });
    return () => { alive = false; };
  }, [asOf, project, companyId]);

  const t = data?.totals;
  const ageMax = Math.max(1, ...AGE_LABELS.map((a) => data?.ageing?.[a] || 0));
  const fcMax = Math.max(1, ...(data?.month_forecast || []).map((m) => m.amount));
  const issueCount = data?.issues ? ISSUES.reduce((n, i) => n + (data.issues[i.value] || 0), 0) : 0;

  return (
    <div className="nx-page">
      <div className="ar-head">
        <div>
          <h1 className="nx-page-title">AR Dashboard</h1>
          <p className="nx-page-sub">{data?.accounts != null ? `${data.accounts} active accounts` : 'Accounts receivable'} · as of {asOf.split('-').reverse().join('/')}</p>
        </div>
        <div className="ar-head-actions">
          <select className="nx-input nx-input-sm nx-filter-sel" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">All projects</option>
            {(data?.projects || []).map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
          <input type="date" aria-label="As of" className="nx-input nx-input-sm" value={asOf} onChange={(e) => setAsOf(e.target.value || today())} />
        </div>
      </div>

      {data === null ? <Loader label="Calculating the receivables book…" /> : err ? <div className="nx-note bad">{err}</div> : (
        <>
          <div className="ar-stats">
            <div className="nx-card ar-stat"><div className="ar-stat-label">Collectable</div><div className="ar-stat-value">{rupee(t.collectable)}</div></div>
            <div className="nx-card ar-stat good"><div className="ar-stat-label">Received</div><div className="ar-stat-value">{rupee(t.received)}</div><div className="ar-stat-sub">{data.pct_realised}% realised</div></div>
            <div className="nx-card ar-stat"><div className="ar-stat-label">Outstanding</div><div className="ar-stat-value">{rupee(t.outstanding)}</div><div className="ar-stat-sub">{rupee(t.not_due)} not yet due</div></div>
            <div className="nx-card ar-stat warn"><div className="ar-stat-label">Overdue</div><div className="ar-stat-value">{rupee(t.overdue)}</div><div className="ar-stat-sub">{data.overdue_accounts} account{data.overdue_accounts === 1 ? '' : 's'}</div></div>
            <div className="nx-card ar-stat"><div className="ar-stat-label">Net interest</div><div className="ar-stat-value">{rupee(t.net_interest)}</div></div>
            <div className="nx-card ar-stat warn"><div className="ar-stat-label">O/s with interest</div><div className="ar-stat-value">{rupee(t.os_with_interest)}</div></div>
          </div>

          {issueCount > 0 && (
            <div className="nx-card ar-card">
              <div className="ar-card-head">
                <div><div className="ar-card-title">Needs attention</div>
                  <div className="ar-card-sub">These accounts can&apos;t show correct dues until their data is fixed</div></div>
              </div>
              <div className="ar-issues">
                {ISSUES.filter((i) => data.issues[i.value]).map((i) => (
                  <Link key={i.value} href={`/m/ar/register?issue=${i.value}`} className="ar-issue">
                    <span className={`nx-status ${i.tone}`}>{i.label}</span>
                    <span className="ar-issue-n">{data.issues[i.value]}</span>
                    <span className="ar-issue-go">View →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="ar-grid-2">
            <div className="nx-card ar-card">
              <div className="ar-card-head"><div><div className="ar-card-title">Overdue by age</div><div className="ar-card-sub">Days past the due date</div></div></div>
              <div className="ar-card-body ar-bars">
                {AGE_LABELS.map((a) => (
                  <div key={a} className="ar-bar-row">
                    <div className="ar-bar-label">{a}</div>
                    <div className="ar-bar-track">{data.ageing[a] > 0 && <div className={`ar-bar${a === '>180' || a === '121-180' ? ' bad' : ''}`} style={{ width: `${(data.ageing[a] / ageMax) * 100}%` }} />}</div>{/* inline-ok: bar length from data */}
                    <div className="ar-bar-value">{data.ageing[a] ? rupee(data.ageing[a]) : '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="nx-card ar-card">
              <div className="ar-card-head"><div><div className="ar-card-title">Falling due</div><div className="ar-card-sub">Installments not yet due, by month</div></div></div>
              <div className="ar-card-body ar-bars">
                {data.month_forecast.map((m) => (
                  <div key={m.label} className="ar-bar-row">
                    <div className="ar-bar-label">{m.label}</div>
                    <div className="ar-bar-track">{m.amount > 0 && <div className="ar-bar good" style={{ width: `${(m.amount / fcMax) * 100}%` }} />}</div>{/* inline-ok: bar length from data */}
                    <div className="ar-bar-value">{m.amount ? rupee(m.amount) : '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ar-grid-2">
            <TopList title="Most overdue" sub="Largest overdue amounts" rows={data.top_overdue} empty="Nothing is overdue." />
            <TopList title="Overdue over 180 days" sub="Oldest money still unpaid" rows={data.top_over_180} empty="Nothing is more than 180 days overdue." />
          </div>
        </>
      )}
    </div>
  );
}

function TopList({ title, sub, rows, empty }) {
  return (
    <div className="nx-card ar-card">
      <div className="ar-card-head"><div><div className="ar-card-title">{title}</div><div className="ar-card-sub">{sub}</div></div></div>
      {rows.length === 0 ? <div className="ar-empty">{empty}</div> : (
        <table className="ar-table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/m/ar/ledger/${r.id}`} className="ar-client ar-link">{r.client}</Link>
                  <div className="ar-client-sub">{r.project} · Plot {r.plots}</div>
                </td>
                <td className="num ar-pos-bad">{rupee(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
