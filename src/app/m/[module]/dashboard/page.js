'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarDays, Wallet, CircleCheckBig, AlarmClock, Hourglass, Percent,
  CalendarClock, TriangleAlert, ArrowRight, ChevronRight, ListChecks, ClipboardList,
  ClipboardCheck, UserCheck,
} from 'lucide-react';
import { AR_ENDPOINTS, TASK_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import { DashHero, DashKpi, DashKpiGrid, DashAlerts, DashCard, DashGrid, DashBars } from '../../../../components/Dash';
import { rupee, inrShort, AGE_LABELS, ISSUES, today } from '../_ar';
import { STATUSES, PRIORITIES, companyParam } from '../_execution';
import { MODULE_META } from '../moduleMeta';
import ModuleDashboard from '../_ModuleDashboard';
import ChannelPartnerDashboard from '../_CpDashboard';
import DashboardRoleFilter from '../../../../components/DashboardRoleFilter';
import { dashboardFor } from '../../../../lib/moduleAccess';
import { DESIGNATION_ENDPOINTS } from '../../../../constants/api';
import MultiSelect from '../../../../components/MultiSelect';

const ISSUE_TEXT = {
  no_schedule: 'Booking has no installment schedule — Sales needs to add one',
  plan_mismatch: "LOI schedule doesn't add up to the deal",
  bad_dates: 'An installment date has an impossible year — Sales needs to correct it',
};

// Every module opens here, with the role filter on top: an admin flips between
// the dashboards built for each role level, and Designation Master → Permissions
// pins the one a designation opens. AR has its receivables dashboard; the other
// modules share one dashboard for every role until their own is written.
export default function ModuleDashboardPage({ params }) {
  const slug = params.module;
  const user = useSelector((s) => s.auth.user);
  const isAdmin = user?.role === 'Admin' || user?.is_staff;
  const [preview, setPreview] = useState('');
  const [options, setOptions] = useState([]);

  const moduleName = MODULE_NAME[slug];
  useEffect(() => {
    if (!moduleName) return;
    apiFetch(DESIGNATION_ENDPOINTS.capabilities)
      .then((r) => r.json())
      .then((d) => setOptions((d?.dashboards || [])
        .filter((x) => x.module === moduleName)
        .map((x) => ({ key: x.value, role: x.role, label: x.label }))))
      .catch(() => {});
  }, [moduleName]);

  if (!MODULE_META[slug]) notFound();
  const chosen = preview || dashboardFor(user, moduleName);
  // Every role opens the same dashboard in these modules for now; the filter is
  // how you see which one a role is pinned to.
  const body = slug === 'ar' ? <ARDashboard />
    : slug === 'cp' ? <ChannelPartnerDashboard chosen={chosen} user={user} />
      : slug === 'execution' ? <TaskDashboardPage />
        : <ModuleDashboard slug={slug} />;

  if (!isAdmin) return body;
  return (
    <>
      <DashboardRoleFilter options={options} value={chosen} onChange={setPreview} module={moduleName} />
      {body}
    </>
  );
}

// /m/<slug> → the module display name its dashboards are declared under.
const MODULE_NAME = {
  ar: 'AR', cp: 'Channel Partner', accounts: 'Accounts & Finance', hr: 'HR',
  execution: 'Task Allocation', purchase: 'Purchase', land: 'Land',
};

// AR Dashboard — the receivables book at a glance: what is owed, how late, what
// falls due month by month, who owes the most, and what data needs fixing.
function ARDashboard() {
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [project, setProject] = useState([]);   // [] = every project
  const [asOf, setAsOf] = useState(today());
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  // Overall or Project-wise — remembered per browser, a viewing preference only.
  const [view, setView] = useState('overall');
  useEffect(() => { try { const v = localStorage.getItem('ar_dash_view'); if (v === 'projects') setView(v); } catch {} }, []);
  const pickView = (v) => { setView(v); try { localStorage.setItem('ar_dash_view', v); } catch {} };

  useEffect(() => {
    let alive = true;
    setData(null); setErr('');
    const p = [`as_of=${asOf}`];
    if (project.length) p.push(`project=${project.join(',')}`);
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

  const [projects, setProjects] = useState([]);
  useEffect(() => { if (data?.projects) setProjects(data.projects); }, [data]);

  const t = data?.totals;
  const regQ = project.length ? `&project=${project.join(',')}` : '';


  return (
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Receivables</h1>
          <p className="nx-page-sub">
            {data?.accounts != null ? `${data.accounts} active accounts` : 'Accounts receivable'} · as of {asOf.split('-').reverse().join('/')}
          </p>
        </div>
        <div className="ard-filters">
          <div className="ard-view" role="tablist" aria-label="Dashboard view">
            {[['overall', 'Overall'], ['projects', 'Project-wise']].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={view === k} className={`ard-view-btn${view === k ? ' is-on' : ''}`} onClick={() => pickView(k)}>{label}</button>
            ))}
          </div>
          <MultiSelect allLabel="All projects" noun="projects" value={project} onChange={setProject} ariaLabel="Project"
            options={projects.map((p) => ({ value: String(p.id), label: p.name }))} />
          <label className="ard-date">
            <CalendarDays size={15} />
            <input type="date" aria-label="As of" value={asOf} max={today()} onChange={(e) => setAsOf(e.target.value || today())} />
          </label>
        </div>
      </div>

      {data === null ? <Loader label="Calculating the receivables book…" /> : err ? <div className="nx-note bad">{err}</div> : view === 'projects' ? (
        <ProjectWise data={data} module="ar" onOpen={(id) => { setProject([String(id)]); pickView('overall'); }} />
      ) : (
        <>
          <div className="ard-top">
            <div className="ard-hero">
              <div className="ard-hero-main">
                <div className="ard-hero-label">Total receivable</div>
                <div className="ard-hero-value" title={rupee(t.os_with_interest)}>{inrShort(t.os_with_interest)}</div>
                <div className="ard-hero-split">
                  <div><span>Principal outstanding</span><b title={rupee(t.outstanding)}>{inrShort(t.outstanding)}</b></div>
                  <div><span>Interest</span><b title={rupee(t.net_interest)}>{inrShort(t.net_interest)}</b></div>
                </div>
              </div>
              <Ring pct={data.pct_realised} received={t.received} collectable={t.collectable} />
            </div>

            <div className="ard-kpis">
              <Kpi icon={<Wallet size={18} />} tone="info" label="Collectable" value={t.collectable} sub="Deal less stamp & registration" />
              <Kpi icon={<CircleCheckBig size={18} />} tone="good" label="Received" value={t.received} sub={`${data.pct_realised}% realised`} />
              <Kpi icon={<AlarmClock size={18} />} tone="bad" label="Overdue" value={t.overdue}
                sub={`${data.overdue_accounts} account${data.overdue_accounts === 1 ? '' : 's'}`} href={`/m/ar/register?overdue=1${regQ}`} />
              <Kpi icon={<Hourglass size={18} />} tone="warn" label="Not yet due" value={t.not_due} sub="Scheduled for later" />
            </div>
          </div>

          {ISSUES.some((i) => data.issues[i.value]) && (
            <div className="ard-issues">
              {ISSUES.filter((i) => data.issues[i.value]).map((i) => (
                <Link key={i.value} href={`/m/ar/register?issue=${i.value}${regQ}`} className={`ard-issue ${i.tone}`}>
                  <span className="ard-issue-icon"><TriangleAlert size={17} /></span>
                  <span className="ard-issue-body">
                    <span className="ard-issue-n">{data.issues[i.value]} <small>{i.label}</small></span>
                    <span className="ard-issue-text">{ISSUE_TEXT[i.value]}</span>
                  </span>
                  <ArrowRight size={16} className="ard-issue-go" />
                </Link>
              ))}
            </div>
          )}

          <div className="ard-grid">
            <Ageing ageing={data.ageing} overdue={t.overdue} />
            <Forecast rows={data.month_forecast} total={t.not_due} />
          </div>

          <div className="ard-grid">
            <TopList title="Most overdue" icon={<Percent size={16} />} rows={data.top_overdue} empty="Nothing is overdue." />
            <TopList title="Overdue over 180 days" icon={<CalendarClock size={16} />} rows={data.top_over_180} empty="Nothing is more than 180 days overdue." />
          </div>
        </>
      )}
    </div>
  );
}

// Task Allocation Dashboard — open work at a glance: what's due, what's overdue,
// what closed this week, and how the open pile breaks down by status/priority.
function TaskDashboardPage() {
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null); setErr('');
    const q = companyParam(companyId);
    apiFetch(`${TASK_ENDPOINTS.stats}${q ? `?${q}` : ''}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) { setErr(d.detail || 'Could not load the dashboard.'); setData({}); return; }
        setData(d);
      })
      .catch(() => { if (alive) { setErr('Could not load the dashboard. Check your connection.'); setData({}); } });
    return () => { alive = false; };
  }, [companyId]);

  return (
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Task Allocation</h1>
          <p className="nx-page-sub">Assign, track and close out tasks across every team</p>
        </div>
      </div>

      {data === null ? <Loader label="Loading your tasks…" /> : err ? <div className="nx-note bad">{err}</div> : (
        <>
          <DashHero
            eyebrow="Open right now"
            value={data.total_open ?? 0}
            splits={[
              { label: 'My open tasks', value: data.my_open_tasks ?? 0 },
              { label: 'Assigned by me', value: data.assigned_by_me ?? 0 },
            ]}
          />

          <DashKpiGrid>
            <DashKpi icon={ListChecks} tone="info" label="My Open Tasks" value={data.my_open_tasks ?? 0}
              sub="Assigned to you" href="/m/execution/list?my_tasks=true" />
            <DashKpi icon={AlarmClock} tone="bad" label="Overdue" value={data.overdue ?? 0}
              sub="Past their due date" href="/m/execution/list?overdue=true" />
            <DashKpi icon={Hourglass} tone="warn" label="Due Today" value={data.due_today ?? 0}
              sub="Close these out today" href="/m/execution/board" />
            <DashKpi icon={CircleCheckBig} tone="good" label="Completed This Week" value={data.completed_this_week ?? 0}
              sub="Marked done in the last 7 days" />
            <DashKpi icon={UserCheck} tone="info" label="Assigned By Me" value={data.assigned_by_me ?? 0}
              sub="Tasks you handed out" href="/m/execution/list?assigned_by_me=true" />
          </DashKpiGrid>

          <DashAlerts items={[
            { label: 'overdue tasks', count: data.overdue ?? 0, tone: 'bad', icon: TriangleAlert,
              text: 'Past their due date and still open', href: '/m/execution/list?overdue=true' },
          ]} />

          <DashGrid>
            <DashCard title="By status" icon={ClipboardList} sub="Every open + closed task">
              <DashBars empty="No tasks yet." rows={STATUSES.map((s) => ({
                label: s.label, tone: s.tone, value: data.by_status?.[s.value] ?? 0,
              }))} />
            </DashCard>
            <DashCard title="By priority" icon={ClipboardCheck} sub="Every open + closed task">
              <DashBars empty="No tasks yet." rows={PRIORITIES.map((p) => ({
                label: p.label, tone: p.tone, value: data.by_priority?.[p.value] ?? 0,
              }))} />
            </DashCard>
          </DashGrid>
        </>
      )}
    </div>
  );
}

function Ring({ pct, received, collectable }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="ard-ring">
      <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} className="ard-ring-track" />
        <circle cx="64" cy="64" r={r} className="ard-ring-fill" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 64 64)" />
      </svg>
      <div className="ard-ring-center"><b>{p}%</b><span>collected</span></div>
      <div className="ard-ring-cap" title={`${rupee(received)} of ${rupee(collectable)}`}>{inrShort(received)} of {inrShort(collectable)}</div>
    </div>
  );
}

function Kpi({ icon, tone, label, value, sub, href }) {
  const body = (
    <>
      <div className="ard-kpi-top"><span className={`ard-kpi-icon ${tone}`}>{icon}</span>{href && <ChevronRight size={16} className="ard-kpi-go" />}</div>
      <div className="ard-kpi-label">{label}</div>
      <div className={`ard-kpi-value ${tone}`} title={rupee(value)}>{inrShort(value)}</div>
      <div className="ard-kpi-sub">{sub}</div>
    </>
  );
  return href
    ? <Link href={href} className="nx-card ard-kpi is-link">{body}</Link>
    : <div className="nx-card ard-kpi">{body}</div>;
}

// Overdue by age: one stacked bar (share of each bucket) above a tile per bucket.
function Ageing({ ageing, overdue }) {
  const total = Math.max(1, overdue);
  return (
    <div className="nx-card ard-card">
      <div className="ard-card-head">
        <div><div className="ard-card-title">Overdue by age</div><div className="ard-card-sub">Days past the due date</div></div>
        <div className="ard-card-total" title={rupee(overdue)}>{inrShort(overdue)}</div>
      </div>
      <div className="ard-stack">
        {AGE_LABELS.map((a, i) => ageing[a] > 0 && <span key={a} className={`ard-seg a${i}`} title={`${a} days · ${rupee(ageing[a])}`} style={{ width: `${(ageing[a] / total) * 100}%` }} />)}{/* inline-ok: segment width from data */}
      </div>
      <div className="ard-ages">
        {AGE_LABELS.map((a, i) => (
          <div key={a} className={`ard-age${ageing[a] ? '' : ' is-zero'}`}>
            <span className={`ard-dot a${i}`} />
            <span className="ard-age-label">{a} days</span>
            <span className="ard-age-track"><span className={`a${i}`} style={{ width: `${(ageing[a] / total) * 100}%` }} /></span>{/* inline-ok: bar length from data */}
            <b title={rupee(ageing[a])}>{ageing[a] ? inrShort(ageing[a]) : '—'}</b>
            <span className="ard-age-pct">{ageing[a] ? `${Math.round((ageing[a] / total) * 100)}%` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// What falls due, month by month: vertical columns scaled to the largest month.
function Forecast({ rows, total }) {
  const max = Math.max(1, ...rows.map((m) => m.amount));
  return (
    <div className="nx-card ard-card">
      <div className="ard-card-head">
        <div><div className="ard-card-title">Falling due</div><div className="ard-card-sub">Installments not yet due, by month</div></div>
        <div className="ard-card-total" title={rupee(total)}>{inrShort(total)}</div>
      </div>
      <div className="ard-cols">
        {rows.map((m) => (
          <div key={m.label} className="ard-col" title={`${m.label} · ${rupee(m.amount)}`}>
            <span className="ard-col-value">{m.amount ? inrShort(m.amount) : '—'}</span>
            <span className="ard-col-track">
              <span className={`ard-col-bar${m.label === 'No date' ? ' muted' : ''}`} style={{ height: `${Math.max(m.amount ? 4 : 0, (m.amount / max) * 100)}%` }} />{/* inline-ok: column height from data */}
            </span>
            <span className="ard-col-label">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopList({ title, icon, rows, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div className="nx-card ard-card">
      <div className="ard-card-head">
        <div className="ard-card-title ard-with-icon">{icon}{title}</div>
        {rows.length > 0 && <span className="ard-card-sub">Top {rows.length}</span>}
      </div>
      {rows.length === 0 ? <div className="ar-empty">{empty}</div> : (
        <div className="ard-top-list">
          {rows.map((r, i) => (
            <Link key={r.id} href={`/m/ar/ledger/${r.id}`} className="ard-row">
              <span className="ard-rank">{i + 1}</span>
              <span className="ard-avatar">{initials(r.client)}</span>
              <span className="ard-row-body">
                <span className="ard-row-name">{r.client}</span>
                <span className="ard-row-sub">{r.project} · Plot {r.plots}</span>
                <span className="ard-row-bar"><span style={{ width: `${(r.amount / max) * 100}%` }} /></span>{/* inline-ok: bar length from data */}
              </span>
              <span className="ard-row-amt" title={rupee(r.amount)}>{inrShort(r.amount)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function initials(name) {
  const parts = String(name || '').replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '—';
}

// Project-wise: every project's receivables side by side — the same figures as the
// Overall view, split by project (the API sums both from the same accounts).
function ProjectWise({ data, module, onOpen }) {
  const rows = data.by_project || [];
  if (!rows.length) return <div className="nx-card bst-empty"><b>No active accounts</b></div>;
  const t = data.totals;
  return (
    <>
      <ProjectCharts rows={rows} onOpen={onOpen} />
      <div className="nx-card pw-table-card">
        <div className="pw-table-title">All projects at a glance</div>
        <div className="arb-scroll">
          <table className="nx-table pw-table">
            <thead>
              <tr>
                <th>Project</th><th className="num">Accounts</th><th className="num">Collectable</th><th className="num">Received</th>
                <th className="num">Overdue</th><th className="num">&gt;180 days</th><th className="num">Not yet due</th>
                <th className="num">Interest</th><th className="num">Total receivable</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><button className="pw-link" onClick={() => onOpen(p.id)}>{p.name}</button></td>
                  <td className="num">{p.accounts}<span className="pw-muted"> · {p.overdue_accounts} od</span></td>
                  <td className="num">{inrShort(p.totals.collectable)}</td>
                  <td className="num">{inrShort(p.totals.received)}<span className="pw-muted"> · {p.pct_realised}%</span></td>
                  <td className="num pw-bad">{inrShort(p.totals.overdue)}</td>
                  <td className="num">{p.ageing?.['>180'] ? inrShort(p.ageing['>180']) : '—'}</td>
                  <td className="num">{inrShort(p.totals.not_due)}</td>
                  <td className="num">{inrShort(p.totals.net_interest)}</td>
                  <td className="num pw-strong">{inrShort(p.totals.os_with_interest)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td><td className="num">{data.accounts}</td><td className="num">{inrShort(t.collectable)}</td>
                <td className="num">{inrShort(t.received)}<span className="pw-muted"> · {data.pct_realised}%</span></td>
                <td className="num pw-bad">{inrShort(t.overdue)}</td><td className="num">{data.ageing?.['>180'] ? inrShort(data.ageing['>180']) : '—'}</td>
                <td className="num">{inrShort(t.not_due)}</td><td className="num">{inrShort(t.net_interest)}</td>
                <td className="num pw-strong">{inrShort(t.os_with_interest)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Project-wise charts ──────────────────────────────────────────────────────
// 1. What each project owes: one horizontal stacked bar per project — Overdue +
//    Not yet due + Interest = Total receivable — sorted largest first, total
//    labelled at the bar end. 2. Where the overdue sits: projects × ageing buckets
//    as a one-hue heatmap. Colours are the validated chart tokens (--viz-*).
const OWES = [
  { key: 'not_due', label: 'Not yet due', cls: 'pc-v1' },
  { key: 'overdue', label: 'Overdue', cls: 'pc-v2' },
  { key: 'net_interest', label: 'Interest', cls: 'pc-v3' },
];

function ProjectCharts({ rows, onOpen }) {
  const [tip, setTip] = useState(null);   // { x, y, title, lines: [[label, value]] }
  const show = (e, title, lines) => {
    const box = e.currentTarget.closest('.pc-wrap').getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, title, lines });
  };
  const sorted = [...rows].sort((a, b) => b.totals.os_with_interest - a.totals.os_with_interest);
  const max = Math.max(1, ...sorted.map((p) => OWES.reduce((a, o) => a + Math.max(0, p.totals[o.key] || 0), 0)));
  const ageMax = Math.max(1, ...rows.flatMap((p) => AGE_LABELS.map((a) => p.ageing?.[a] || 0)));
  // Square-root scale: one very large bucket (Kalrav's >180 days) would otherwise
  // push every other cell to the faintest step and hide the differences.
  const step = (v) => (v > 0 ? Math.min(7, 1 + Math.floor(Math.sqrt(v / ageMax) * 7)) : 0);

  return (
    <div className="pc-wrap" onMouseLeave={() => setTip(null)}>
      <div className="nx-card pc-card">
        <div className="pc-head">
          <div>
            <div className="ard-card-title">What each project owes</div>
            <div className="ard-card-sub">Total receivable = overdue + not yet due + interest</div>
          </div>
          <div className="pc-legend">
            {OWES.map((o) => <span key={o.key}><i className={`pc-swatch ${o.cls}`} />{o.label}</span>)}
          </div>
        </div>
        <div className="pc-bars">
          {sorted.map((p) => (
            <div key={p.id} className="pc-row">
              <button className="pc-name" onClick={() => onOpen(p.id)} title="Open this project's dashboard">{p.name}</button>
              <div className="pc-track">
                {OWES.map((o) => {
                  const v = Math.max(0, p.totals[o.key] || 0);
                  if (!v) return null;
                  return (
                    <span key={o.key} className={`pc-seg ${o.cls}`} style={{ width: `${(v / max) * 100}%` } /* inline-ok: segment width from data */}
                      onMouseMove={(e) => show(e, p.name, [[o.label, rupee(v)], ['Share of total', `${Math.round((v / (p.totals.os_with_interest || 1)) * 100)}%`]])} />
                  );
                })}
              </div>
              <span className="pc-total">{inrShort(p.totals.os_with_interest)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="nx-card pc-card">
        <div className="pc-head">
          <div>
            <div className="ard-card-title">Where the overdue sits</div>
            <div className="ard-card-sub">Overdue amount by project and days past due — stronger colour is more</div>
          </div>
        </div>
        <div className="pc-heat-scroll">
          <div className="pc-heat" role="table" aria-label="Overdue by project and age">
            <div className="pc-heat-row pc-heat-headrow" role="row">
              <span role="columnheader" />
              {AGE_LABELS.map((a) => <span key={a} role="columnheader" className="pc-heat-col">{a} days</span>)}
            </div>
            {sorted.map((p) => (
              <div key={p.id} className="pc-heat-row" role="row">
                <button role="rowheader" className="pc-name" onClick={() => onOpen(p.id)}>{p.name}</button>
                {AGE_LABELS.map((a) => {
                  const v = p.ageing?.[a] || 0;
                  const st = step(v);
                  return (
                    <span key={a} role="cell" className={`pc-cell pc-s${st}`}
                      onMouseMove={(e) => show(e, p.name, [[`${a} days overdue`, v ? rupee(v) : 'Nothing'], ['Accounts overdue', String(p.overdue_accounts)]])}>
                      {v ? inrShort(v) : '—'}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="pc-scale">
          <span>Less</span>{[1, 2, 3, 4, 5, 6, 7].map((n) => <i key={n} className={`pc-cell-key pc-s${n}`} />)}<span>More</span>
        </div>
      </div>

      {tip && (
        <div className="pc-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>{/* inline-ok: tooltip follows the pointer */}
          <b>{tip.title}</b>
          {tip.lines.map(([k, v]) => <div key={k}><span>{k}</span><strong>{v}</strong></div>)}
        </div>
      )}
    </div>
  );
}

