'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter, notFound } from 'next/navigation';
import { AR_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import { Building2, Filter } from 'lucide-react';
import Dropdown from '../../../../components/Dropdown';
import { rupee, inrShort, AGE_LABELS, ISSUES, hasIssue, worstBucket } from '../_ar';

// AR Register — the old workbook's "Plot Master": one row per approved booking.
export default function ARRegisterPage({ params, searchParams }) {
  if (params.module !== 'ar') notFound();
  const router = useRouter();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [rows, setRows] = useState(null);
  const [asOf, setAsOf] = useState('');
  const [err, setErr] = useState('');
  const [project, setProject] = useState(searchParams?.project || '');
  const [q, setQ] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(searchParams?.overdue === '1');
  const [showAgeing, setShowAgeing] = useState(false);
  // '' | 'any' | one of ISSUES — the dashboard links here with ?issue=…
  const [issue, setIssue] = useState(searchParams?.issue || '');

  useEffect(() => {
    let alive = true;
    setRows(null); setErr('');
    apiFetch(AR_ENDPOINTS.accounts + (companyId ? `?company_id=${companyId}` : ''))
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) { setErr(d.detail || 'Could not load the register.'); setRows([]); return; }
        setRows(d.results || []); setAsOf(d.as_of || '');
      })
      .catch(() => { if (alive) { setErr('Could not load the register. Check your connection.'); setRows([]); } });
    return () => { alive = false; };
  }, [companyId]);

  const projects = useMemo(() => {
    const m = new Map();
    (rows || []).forEach((r) => { if (r.project_id) m.set(r.project_id, r.project); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows || []).filter((r) =>
      (!project || String(r.project_id) === project)
      && (!overdueOnly || r.overdue > 0)
      && (!issue || (issue === 'any' ? hasIssue(r) : ISSUES.find((i) => i.value === issue)?.test(r)))
      && (!needle || r.client_name.toLowerCase().includes(needle) || (r.phone || '').includes(needle)
        || String(r.plots).toLowerCase().includes(needle)));
  }, [rows, project, q, overdueOnly, issue]);

  const totals = useMemo(() => shown.reduce((t, r) => ({
    collectable: t.collectable + r.collectable, received: t.received + r.received,
    outstanding: t.outstanding + r.outstanding, overdue: t.overdue + r.overdue,
    net_interest: t.net_interest + r.net_interest, os_with_interest: t.os_with_interest + r.os_with_interest,
  }), { collectable: 0, received: 0, outstanding: 0, overdue: 0, net_interest: 0, os_with_interest: 0 }), [shown]);

  return (
    <div className="nx-page">
      <div className="ar-head">
        <div>
          <h1 className="nx-page-title">AR Register</h1>
          <p className="nx-page-sub">Every booking approved by Sales and Accounts{asOf ? ` · as of ${asOf.split('-').reverse().join('/')}` : ''}</p>
        </div>
      </div>

      {rows === null ? <Loader label="Calculating accounts…" /> : (
        <>
          {err && <div className="nx-note bad">{err}</div>}
          <div className="ar-stats">
            <div className="nx-card ar-stat"><div className="ar-stat-label">Collectable</div><div className="ar-stat-value" title={rupee(totals.collectable)}>{inrShort(totals.collectable)}</div></div>
            <div className="nx-card ar-stat good"><div className="ar-stat-label">Received</div><div className="ar-stat-value" title={rupee(totals.received)}>{inrShort(totals.received)}</div></div>
            <div className="nx-card ar-stat"><div className="ar-stat-label">Outstanding</div><div className="ar-stat-value" title={rupee(totals.outstanding)}>{inrShort(totals.outstanding)}</div></div>
            <div className="nx-card ar-stat warn"><div className="ar-stat-label">Overdue</div><div className="ar-stat-value" title={rupee(totals.overdue)}>{inrShort(totals.overdue)}</div></div>
            <div className="nx-card ar-stat"><div className="ar-stat-label">Net interest</div><div className="ar-stat-value" title={rupee(totals.net_interest)}>{inrShort(totals.net_interest)}</div></div>
            <div className="nx-card ar-stat warn"><div className="ar-stat-label">O/s with interest</div><div className="ar-stat-value" title={rupee(totals.os_with_interest)}>{inrShort(totals.os_with_interest)}</div></div>
          </div>

          <div className="ar-filters">
            <Dropdown value={project} onChange={setProject} searchable ariaLabel="Project" icon={<Building2 size={15} />}
              options={[{ value: '', label: 'All projects' }, ...projects.map(([id, name]) => ({ value: String(id), label: name }))]} />
            <input className="nx-input nx-input-sm ar-search" placeholder="Search client, phone or plot…" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className={`nx-check${overdueOnly ? ' is-on' : ''}`}>
              <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue only
            </label>
            <Dropdown value={issue} onChange={setIssue} ariaLabel="Account health" icon={<Filter size={15} />}
              options={[{ value: '', label: 'All accounts' }, { value: 'any', label: 'Needs attention', hint: (rows || []).filter(hasIssue).length },
                ...ISSUES.map((i) => ({ value: i.value, label: i.label, hint: (rows || []).filter(i.test).length }))]} />
            <label className={`nx-check${showAgeing ? ' is-on' : ''}`}>
              <input type="checkbox" checked={showAgeing} onChange={(e) => setShowAgeing(e.target.checked)} /> Show ageing
            </label>
          </div>

          <div className="nx-card ar-card">
            {shown.length === 0 ? (
              <div className="ar-empty">
                {(rows || []).length === 0
                  ? 'No bookings are fully approved yet. An account appears here once Sales and Accounts have both approved a booking.'
                  : 'No accounts match these filters.'}
              </div>
            ) : (
              <div className="ar-scroll">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>Project</th><th>Plot</th><th>Client</th>
                      <th className="num">Total deal</th><th className="num">Collectable</th><th className="num">Received</th>
                      <th className="num">%</th><th className="num">Outstanding</th><th className="num">Overdue</th>
                      <th className="num">Not due</th><th className="num">Interest</th><th className="num">O/s + interest</th>
                      {showAgeing ? AGE_LABELS.map((a) => <th key={a} className="num">{a}</th>) : <th>Oldest</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id} className="ar-row-link" onClick={() => router.push(`/m/ar/ledger/${r.id}`)}>
                        <td>{r.project}</td>
                        <td>{r.plots}</td>
                        <td>
                          <div className="ar-client">{r.client_name || '—'}</div>
                          <div className="ar-client-sub">
                            {r.phone}{r.status === 'frozen' ? ' · Cancelled' : ''}
                          </div>
                          {hasIssue(r) && (
                            <div className="ar-badges">
                              {ISSUES.filter((i) => i.test(r)).map((i) => <span key={i.value} className={`nx-status ${i.tone}`}>{i.label}</span>)}
                            </div>
                          )}
                        </td>
                        <td className="num">{rupee(r.total_deal)}</td>
                        <td className="num">{rupee(r.collectable)}</td>
                        <td className="num">{rupee(r.received)}</td>
                        <td className="num muted">{r.pct_realised}%</td>
                        <td className={`num${r.outstanding < 0 ? ' ar-neg' : ''}`}>{rupee(r.outstanding)}</td>
                        <td className={`num${r.overdue > 0 ? ' ar-pos-bad' : ' muted'}`}>{rupee(r.overdue)}</td>
                        <td className="num muted">{rupee(r.not_due)}</td>
                        <td className="num">{rupee(r.net_interest)}</td>
                        <td className="num"><b>{rupee(r.os_with_interest)}</b></td>
                        {showAgeing
                          ? AGE_LABELS.map((a) => <td key={a} className="num muted">{r.ageing[a] ? rupee(r.ageing[a]) : '—'}</td>)
                          : <td>{worstBucket(r.ageing) ? <span className="nx-status bad">{worstBucket(r.ageing)} days</span> : <span className="muted">—</span>}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
