'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { can } from '../../../../lib/moduleAccess';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AlarmClock, CalendarClock, PhoneCall, UserX, Building2, BellRing, Phone } from 'lucide-react';
import { AR_ENDPOINTS } from '../../../../constants/api';
import { apiFetch } from '../../../../utils/apiFetch';
import Loader from '../../../../components/Loader';
import Dropdown from '../../../../components/Dropdown';
import { DashKpi } from '../../../../components/Dash';
import { fmtWhen } from '../../../../components/ActivityHistory';
import { rupee, inrShort } from '../_ar';
import FollowUpModal from '../_FollowUpModal';

const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const WINDOWS = [0, 7, 30, 60, 90];   // 0 = due today
const windowLabel = (w) => (w === 0 ? 'Today' : `${w} days`);

// Collections: who has not paid (overdue), what falls due next (upcoming), and
// the follow-ups chasing both. Each row opens its follow-ups; the ledger is a click away.
export default function ARCollectionsPage({ params, searchParams }) {
  if (params.module !== 'ar') notFound();
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const me = useSelector((s) => s.auth.user?.id);
  const user = useSelector((s) => s.auth.user);
  const [tab, setTab] = useState(searchParams?.tab || 'overdue');
  const [days, setDays] = useState(30);
  const [project, setProject] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);
  // Follow-ups tab
  const [fuScope, setFuScope] = useState('mine');
  const [fuWhen, setFuWhen] = useState('open');
  const [fus, setFus] = useState(null);
  const [reload, setReload] = useState(0);

  const view = tab === 'followups' ? 'all' : tab;
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ view, days: String(days) });
    if (project) qs.set('project', project);
    if (companyId) qs.set('company_id', companyId);
    setErr('');
    apiFetch(`${AR_ENDPOINTS.collections}?${qs}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) { setErr(d.detail || 'Could not load collections.'); setData({ results: [], counts: {}, projects: [] }); return; }
        setData(d);
      })
      .catch(() => { if (alive) { setErr('Could not load collections. Check your connection.'); setData({ results: [], counts: {}, projects: [] }); } });
    return () => { alive = false; };
  }, [view, days, project, companyId, reload]);

  useEffect(() => {
    if (tab !== 'followups') return undefined;
    let alive = true;
    const qs = new URLSearchParams({ scope: fuScope, when: fuWhen });
    if (companyId) qs.set('company_id', companyId);
    setFus(null);
    apiFetch(`${AR_ENDPOINTS.myFollowUps}?${qs}`)
      .then((r) => r.json()).then((d) => { if (alive) setFus(d.results || []); })
      .catch(() => { if (alive) setFus([]); });
    return () => { alive = false; };
  }, [tab, fuScope, fuWhen, companyId, reload]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.results || []).filter((r) => !needle || r.client_name.toLowerCase().includes(needle)
      || (r.phone || '').includes(needle) || String(r.plots).toLowerCase().includes(needle));
  }, [data, q]);

  const c = data?.counts || {};
  const byId = useMemo(() => Object.fromEntries((data?.results || []).map((r) => [r.id, r])), [data]);

  return (
    <div className="nx-page ard">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">Collections</h1>
          <p className="nx-page-sub">Who has not paid, what falls due next, and the follow-ups chasing it{data?.as_of ? ` · as of ${dmy(data.as_of)}` : ''}</p>
        </div>
        <div className="ard-filters">
          <Dropdown value={project} onChange={setProject} searchable ariaLabel="Project" icon={<Building2 size={15} />}
            options={[{ value: '', label: 'All projects' }, ...(data?.projects || []).map((p) => ({ value: String(p.id), label: p.name }))]} />
        </div>
      </div>

      {data === null ? <Loader label="Working out who owes what…" /> : (
        <>
          {err && <div className="nx-note bad">{err}</div>}
          <div className="col-kpis">
            <DashKpi icon={AlarmClock} tone="bad" label="Overdue" value={inrShort(c.overdue_amount)} valueTitle={rupee(c.overdue_amount)} sub={`${c.overdue_accounts || 0} accounts not paid`} />
            <DashKpi icon={CalendarClock} tone="warn" label={days === 0 ? 'Due today' : `Due in ${days} days`} value={inrShort(c.upcoming_amount)} valueTitle={rupee(c.upcoming_amount)} sub={`${c.upcoming_accounts || 0} accounts`} />
            <DashKpi icon={PhoneCall} tone="info" label="Follow-ups today" value={c.followups_today || 0} sub={`${c.followups_overdue || 0} overdue`} />
            <DashKpi icon={UserX} tone="muted" label="Not followed up" value={c.no_followup || 0} sub="Overdue with nothing scheduled" />
          </div>

          <div className="nx-filters col-tabs">
            {[['overdue', `Overdue · ${c.overdue_accounts || 0}`], ['upcoming', `Upcoming · ${c.upcoming_accounts || 0}`], ['followups', 'Follow-ups']].map(([k, label]) => (
              <button type="button" key={k} className={`nx-btn nx-btn-md nx-toggle${tab === k ? ' is-on' : ''}`} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>

          {tab !== 'followups' ? (
            <>
              <div className="ar-filters">
                <input className="nx-input nx-input-sm ar-search" placeholder="Search client, phone or plot…" value={q} onChange={(e) => setQ(e.target.value)} />
                {tab === 'upcoming' && (
                  <div className="col-window">
                    {WINDOWS.map((w) => (
                      <button type="button" key={w} className={`nx-btn nx-btn-sm nx-toggle${days === w ? ' is-on' : ''}`} onClick={() => setDays(w)}>{windowLabel(w)}</button>
                    ))}
                  </div>
                )}
              </div>
              {rows.length === 0 ? (
                <div className="nx-card ar-card"><div className="ar-empty">{tab === 'overdue' ? 'Nobody is overdue. Every due installment is paid.' : (days === 0 ? 'Nothing falls due today.' : `Nothing falls due in the next ${days} days.`)}</div></div>
              ) : (
                <div className="coll-grid">
                  {rows.map((r) => (
                    <article key={r.id} className={`nx-card coll-card${tab === 'overdue' && r.days_overdue > 90 ? ' is-late' : ''}`}>
                      <header className="coll-head">
                        <div className="coll-who">
                          <h3 title={r.client_name}>{r.client_name || '—'}</h3>
                          <div className="coll-meta">
                            <span className="coll-chip"><Building2 size={12} /> {r.project}</span>
                            <span className="coll-chip">Plot {r.plots}</span>
                            {r.phone ? <span className="coll-chip"><Phone size={12} /> {r.phone}</span> : null}
                          </div>
                        </div>
                        {tab === 'overdue'
                          ? <span className={`coll-age ${r.days_overdue > 90 ? 'bad' : 'warn'}`}><b>{r.days_overdue}</b><span>days late</span></span>
                          : <span className="coll-age info"><b>{r.upcoming_installments}</b><span>inst due</span></span>}
                      </header>

                      <div className="coll-figs">
                        {tab === 'overdue' ? (
                          <>
                            <div className="coll-fig bad">
                              <span>Overdue</span><b title={rupee(r.overdue)}>{rupee(r.overdue)}</b>
                              <small>{r.overdue_installments} inst · since {dmy(r.overdue_since)}</small>
                            </div>
                            <div className="coll-fig">
                              <span>O/s + interest</span><b>{rupee(r.os_with_interest)}</b>
                              <small>Interest {rupee(r.net_interest)}</small>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="coll-fig">
                              <span>{days === 0 ? 'Due today' : `Due in ${days} days`}</span><b>{rupee(r.upcoming_amount)}</b>
                              <small>{r.next_due ? `Next ${dmy(r.next_due.date)} · ${r.next_due.label}` : '—'}</small>
                            </div>
                            <div className={`coll-fig${r.overdue > 0 ? ' bad' : ''}`}>
                              <span>Also overdue</span><b>{r.overdue > 0 ? rupee(r.overdue) : '—'}</b>
                              <small>{r.overdue > 0 ? `${r.days_overdue} days late` : 'Nothing overdue'}</small>
                            </div>
                          </>
                        )}
                        <div className="coll-fig">
                          <span>Last paid</span><b>{r.last_paid_on ? rupee(r.last_paid_amount) : '—'}</b>
                          <small>{r.last_paid_on ? dmy(r.last_paid_on) : 'Never paid'}</small>
                        </div>
                      </div>

                      <footer className="coll-foot">
                        <div className="coll-fu">
                          {r.followup
                            ? <span className={`nx-status ${r.followup.is_overdue ? 'bad' : 'ok'}`}>{r.followup.channel_label} · {fmtWhen(r.followup.scheduled_at)}</span>
                            : <span className="nx-status off">No follow-up scheduled</span>}
                          {r.last_outcome?.text && <p className="coll-outcome" title={r.last_outcome.text}>“{r.last_outcome.text}”</p>}
                        </div>
                        <div className="coll-actions">
                          <Link href={`/m/ar/ledger/${r.id}`} className="nx-btn nx-btn-sm nx-btn-secondary">Ledger</Link>
                          {can(user, 'ar.followup.manage') && <button type="button" className="nx-btn nx-btn-sm nx-btn-primary" onClick={() => setOpen(r)}><BellRing size={13} /> Follow up</button>}
                        </div>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="ar-filters">
                {[['mine', 'Mine'], ['all', 'Everyone']].map(([k, label]) => (
                  <button type="button" key={k} className={`nx-btn nx-btn-sm nx-toggle${fuScope === k ? ' is-on' : ''}`} onClick={() => setFuScope(k)}>{label}</button>
                ))}
                <span className="col-sep" />
                {[['open', 'All open'], ['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Later'], ['done', 'Done']].map(([k, label]) => (
                  <button type="button" key={k} className={`nx-btn nx-btn-sm nx-toggle${fuWhen === k ? ' is-on' : ''}`} onClick={() => setFuWhen(k)}>{label}</button>
                ))}
              </div>
              {fus === null ? <Loader label="Loading…" /> : fus.length === 0 ? (
                <div className="nx-card ar-card"><div className="ar-empty">No follow-ups here.</div></div>
              ) : (
                <div className="coll-grid">
                  {fus.map((f) => (
                    <article key={f.id} className={`nx-card coll-card${f.is_overdue ? ' is-late' : ''}`}>
                      <header className="coll-head">
                        <div className="coll-who">
                          <h3 title={f.account.client_name}>{f.account.client_name || '—'}</h3>
                          <div className="coll-meta">
                            <span className="coll-chip"><Building2 size={12} /> {f.account.project}</span>
                            <span className="coll-chip">Plot {f.account.plots}</span>
                            {f.account.phone ? <span className="coll-chip"><Phone size={12} /> {f.account.phone}</span> : null}
                          </div>
                        </div>
                        <span className={`nx-status ${f.status === 'done' ? 'ok' : f.is_overdue ? 'bad' : 'info'}`}>
                          {f.status === 'done' ? 'Done' : f.is_overdue ? 'Overdue' : 'Scheduled'}
                        </span>
                      </header>
                      <div className="coll-fu-when">
                        <b>{f.channel_label}</b> · {fmtWhen(f.status === 'done' ? f.done_at : f.scheduled_at)}
                        <span className="coll-assignee">{f.assigned_to?.name || '—'}</span>
                      </div>
                      {(f.outcome || f.note) && <p className="coll-outcome">{f.outcome || f.note}</p>}
                      {f.promised_amount != null && (
                        <p className="coll-promise">Promised {rupee(f.promised_amount)}{f.promised_on ? ` by ${dmy(f.promised_on)}` : ''}</p>
                      )}
                      <footer className="coll-foot">
                        <div />
                        <div className="coll-actions">
                          <button type="button" className="nx-btn nx-btn-sm nx-btn-primary"
                            onClick={() => setOpen(byId[f.account_id] || { ...f.account, overdue: 0 })}>Open follow-ups</button>
                        </div>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {open && <FollowUpModal row={open} companyId={companyId} me={me} onClose={() => setOpen(null)} onChanged={() => setReload((n) => n + 1)} />}
    </div>
  );
}
