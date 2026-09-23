'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter, notFound } from 'next/navigation';
import { AR_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import { Building2, Filter, Wallet, CircleCheckBig, Hourglass, AlarmClock, Percent, Receipt } from 'lucide-react';
import { DashKpi } from '../../../../components/Dash';
import Dropdown from '../../../../components/Dropdown';
import { rupee, inrShort, AGE_LABELS, ISSUES, hasIssue, worstBucket } from '../_ar';

// Plot number search: "25" finds plot 25 (not 125 or 250), "Ananda" finds Ananda1…,
// and "EOI-1" finds EOI-1 — any plot of a multi-plot booking counts.
function plotMatches(plots, query) {
  const want = query.trim().toUpperCase();
  if (!want) return true;
  return String(plots || '').split(',').map((p) => p.trim().toUpperCase()).some((p) =>
    (/^\d+$/.test(want) ? (p === want || p.replace(/^[A-Z-]*/, '') === want) : p.startsWith(want)));
}

const initials = (name) => {
  const parts = String(name || '').replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '—';
};

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
  const [plotQ, setPlotQ] = useState('');
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
        || String(r.plots).toLowerCase().includes(needle))
      && plotMatches(r.plots, plotQ));
  }, [rows, project, q, plotQ, overdueOnly, issue]);

  const totals = useMemo(() => shown.reduce((t, r) => ({
    collectable: t.collectable + r.collectable, received: t.received + r.received,
    outstanding: t.outstanding + r.outstanding, overdue: t.overdue + r.overdue,
    net_interest: t.net_interest + r.net_interest, os_with_interest: t.os_with_interest + r.os_with_interest,
  }), { collectable: 0, received: 0, outstanding: 0, overdue: 0, net_interest: 0, os_with_interest: 0 }), [shown]);

  const pctRealised = totals.collectable ? Math.round((totals.received / totals.collectable) * 1000) / 10 : 0;
  const overdueCount = shown.filter((r) => r.overdue > 0).length;

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
          <div className="col-kpis">
            <DashKpi icon={Wallet} tone="info" label="Collectable" value={inrShort(totals.collectable)} valueTitle={rupee(totals.collectable)} sub={`${shown.length} account${shown.length === 1 ? '' : 's'}`} />
            <DashKpi icon={CircleCheckBig} tone="good" label="Received" value={inrShort(totals.received)} valueTitle={rupee(totals.received)} sub={`${pctRealised}% realised`} />
            <DashKpi icon={Hourglass} tone="muted" label="Outstanding" value={inrShort(totals.outstanding)} valueTitle={rupee(totals.outstanding)} sub="Still to collect" />
            <DashKpi icon={AlarmClock} tone="bad" label="Overdue" value={inrShort(totals.overdue)} valueTitle={rupee(totals.overdue)} sub={`${overdueCount} not paid`} />
            <DashKpi icon={Percent} tone="warn" label="Net interest" value={inrShort(totals.net_interest)} valueTitle={rupee(totals.net_interest)} sub="Late less early credit" />
            <DashKpi icon={Receipt} tone="bad" label="O/s with interest" value={inrShort(totals.os_with_interest)} valueTitle={rupee(totals.os_with_interest)} sub="What customers owe" />
          </div>

          <div className="ar-filters">
            <Dropdown value={project} onChange={setProject} searchable ariaLabel="Project" icon={<Building2 size={15} />}
              options={[{ value: '', label: 'All projects' }, ...projects.map(([id, name]) => ({ value: String(id), label: name }))]} />
            <input className="nx-input nx-input-sm ar-plot-search" placeholder="Plot no." aria-label="Plot number" value={plotQ} onChange={(e) => setPlotQ(e.target.value)} />
            <input className="nx-input nx-input-sm ar-search" placeholder="Search client or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
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
              <div className="ar-scroll reg-scroll">
                <table className="ar-table reg-table">
                  <thead>
                    <tr>
                      <th className="reg-unit">Unit &amp; client</th>
                      <th className="num">Total deal</th><th className="num">Collectable</th><th className="reg-prog">Received</th>
                      <th className="num">Outstanding</th><th className="num">Overdue</th>
                      <th className="num">Not due</th><th className="num">Interest</th><th className="num">O/s + interest</th>
                      {showAgeing ? AGE_LABELS.map((a) => <th key={a} className="num">{a}</th>) : <th>Oldest</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id} className="ar-row-link" onClick={() => router.push(`/m/ar/ledger/${r.id}`)}>
                        <td className="reg-unit">
                          <div className="reg-id">
                            <span className="reg-avatar" aria-hidden="true">{initials(r.client_name)}</span>
                            <div className="reg-id-text">
                              <div className="reg-name" title={r.client_name}>{r.client_name || '—'}</div>
                              <div className="reg-sub">
                                <span className="reg-unit-chip">{r.project} · {r.plots}</span>
                                {r.phone ? <span>{r.phone}</span> : null}
                                {r.status === 'frozen' ? <span className="nx-status off">Cancelled</span> : null}
                              </div>
                              {hasIssue(r) && (
                                <div className="ar-badges">
                                  {ISSUES.filter((i) => i.test(r)).map((i) => <span key={i.value} className={`nx-status ${i.tone}`}>{i.label}</span>)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="num">{rupee(r.total_deal)}</td>
                        <td className="num">{rupee(r.collectable)}</td>
                        <td className="reg-prog">
                          <div className="reg-prog-top"><b>{rupee(r.received)}</b><span>{r.pct_realised}%</span></div>
                          <span className="reg-bar"><span className={r.pct_realised >= 100 ? 'is-full' : ''} style={{ width: `${Math.min(100, Math.max(0, r.pct_realised))}%` }} /></span>{/* inline-ok: share realised, from data */}
                        </td>
                        <td className={`num${r.outstanding < 0 ? ' ar-neg' : ''}`}>{rupee(r.outstanding)}</td>
                        <td className={`num${r.overdue > 0 ? ' ar-pos-bad' : ' muted'}`}>{rupee(r.overdue)}</td>
                        <td className="num muted">{rupee(r.not_due)}</td>
                        <td className="num">{rupee(r.net_interest)}</td>
                        <td className="num reg-total"><b>{rupee(r.os_with_interest)}</b></td>
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
