'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Building2, CalendarDays, Wallet, CircleCheckBig, AlarmClock, Hourglass, Percent,
  CalendarClock, TriangleAlert, ArrowRight, ChevronRight, ListChecks, ClipboardList,
  ClipboardCheck, UserCheck,
} from 'lucide-react';
import { AR_ENDPOINTS, TASK_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import Dropdown from '../../../../components/Dropdown';
import { DashHero, DashKpi, DashKpiGrid, DashAlerts, DashCard, DashGrid, DashBars } from '../../../../components/Dash';
import { rupee, inrShort, AGE_LABELS, ISSUES, today } from '../_ar';
import { STATUSES, PRIORITIES, companyParam } from '../_execution';

const ISSUE_TEXT = {
  no_schedule: 'Booking has no installment schedule — Sales needs to add one',
  plan_mismatch: "LOI schedule doesn't add up to the deal",
};

// Dispatches to the AR or Task Allocation dashboard by slug — both live in this
// one dynamic-route file, same as every other page under m/[module].
export default function DashboardPage({ params }) {
  if (params.module === 'execution') return <TaskDashboardPage />;
  return <ARDashboardPage params={params} />;
}

// AR Dashboard — the receivables book at a glance: what is owed, how late, what
// falls due month by month, who owes the most, and what data needs fixing.
function ARDashboardPage({ params }) {
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

  const [projects, setProjects] = useState([]);
  useEffect(() => { if (data?.projects) setProjects(data.projects); }, [data]);

  const t = data?.totals;
  const regQ = project ? `&project=${project}` : '';

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
          <Dropdown value={project} onChange={setProject} searchable ariaLabel="Project"
            icon={<Building2 size={15} />}
            options={[{ value: '', label: 'All projects' }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))]} />
          <label className="ard-date">
            <CalendarDays size={15} />
            <input type="date" aria-label="As of" value={asOf} max={today()} onChange={(e) => setAsOf(e.target.value || today())} />
          </label>
        </div>
      </div>

      {data === null ? <Loader label="Calculating the receivables book…" /> : err ? <div className="nx-note bad">{err}</div> : (
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
