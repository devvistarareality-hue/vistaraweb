'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { ClipboardCheck, BookCheck, CircleSlash, Layers, ArrowRight, Hourglass, LayoutGrid, ChevronRight } from 'lucide-react';
import { SALES_ENDPOINTS } from '../../../constants/api';
import { apiFetch } from '../../../utils/apiFetch';
import { rupee, inrShort } from '../../../lib/inr';
import Loader from '../../../components/Loader';
import { MODULE_META } from './moduleMeta';

// The dashboard Accounts & Finance, HR, Purchase and Land open on.
//
// Accounts & Finance reads its own figures from the server (bookings/all?summary):
// everything Sales or Channel Partner approved that has reached the Accounts gate —
// what is waiting, what is signed off, what was sent back, what each is worth, how
// it splits by project, what has waited longest and six months of sign-offs. Every
// number agrees with the Approvals tabs it links to.
//
// The modules whose figures are not wired yet get a plain page about the module
// rather than Accounts' tiles with dashes in them.
export default function ModuleDashboard({ slug }) {
  const meta = MODULE_META[slug] || { name: slug, desc: '' };
  if (slug !== 'accounts') return <ModulePlaceholder meta={meta} />;
  return <AccountsDashboard slug={slug} meta={meta} />;
}

function ModulePlaceholder({ meta }) {
  return (
    <div className="nx-page">
      <div className="md-head">
        <div>
          <h1 className="nx-page-title">{meta.name}</h1>
          <p className="nx-page-sub">{meta.desc}</p>
        </div>
      </div>
      <section className="nx-card md-empty">
        <span className="md-empty-icon"><LayoutGrid size={22} /></span>
        <h2>{meta.name}</h2>
        <p>{meta.desc || 'Its tabs are in the menu on the left.'}</p>
        <p className="md-muted">Its figures will appear here once they are wired up — everything it does is in the menu on the left.</p>
      </section>
    </div>
  );
}

// Where a booking stands at the Accounts gate, in the order the bar shows them.
const STATES = [
  { key: 'approved', label: 'Approved', cls: 'acc-s-ok' },
  { key: 'pending', label: 'Waiting', cls: 'acc-s-wait' },
  { key: 'rejected', label: 'Sent back', cls: 'acc-s-bad' },
];

const initials = (name) => {
  const parts = String(name || '').replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '—';
};

// Built from the AR dashboard's pieces (ard-*), so the two read as one family.
function AccountsDashboard({ slug, meta }) {
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [d, setD] = useState(null);

  useEffect(() => {
    setD(null);
    apiFetch(`${SALES_ENDPOINTS.bookingsAll}?summary=true${companyId ? `&company_id=${companyId}` : ''}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((x) => setD(x && typeof x === 'object' ? x : {}))
      .catch(() => setD({}));
  }, [companyId]);

  if (d === null) return <div className="nx-page"><Loader label="Adding it up…" /></div>;

  const v = d.values || {};
  const total = d.total || 0;
  const totalValue = (v.pending || 0) + (v.approved || 0) + (v.rejected || 0);
  const pct = total ? Math.round(((d.approved || 0) / total) * 100) : 0;
  const waiting = d.oldest_pending || [];
  const projects = d.by_project || [];
  const trend = d.trend || [];
  const approvals = (tab) => `/m/${slug}/approvals?tab=${tab}`;

  return (
    <div className="nx-page">
      <div className="ard-head">
        <div>
          <h1 className="nx-page-title">{meta.name}</h1>
          <p className="nx-page-sub">{total.toLocaleString('en-IN')} bookings at the Accounts gate · approved by Sales or Channel Partner</p>
        </div>
      </div>

      <div className="ard-top">
        <div className="ard-hero">
          <div className="ard-hero-main">
            <div className="ard-hero-label">At the Accounts gate</div>
            <div className="ard-hero-value" title={rupee(totalValue)}>{inrShort(totalValue)}</div>
            <div className="ard-hero-split">
              <div><span>Approved</span><b title={rupee(v.approved || 0)}>{inrShort(v.approved || 0)}</b></div>
              <div><span>Waiting</span><b title={rupee(v.pending || 0)}>{inrShort(v.pending || 0)}</b></div>
              <div><span>Bookings</span><b>{total.toLocaleString('en-IN')}</b></div>
            </div>
          </div>
          <Ring pct={pct} cap={`${d.approved || 0} of ${total}`} />
        </div>

        <div className="ard-kpis">
          <Kpi icon={<ClipboardCheck size={18} />} tone="warn" label="Waiting for sign-off" n={d.pending} money={v.pending} href={approvals('pending')} />
          <Kpi icon={<BookCheck size={18} />} tone="good" label="Approved" n={d.approved} money={v.approved} href={`/m/${slug}/bookings`} />
          <Kpi icon={<CircleSlash size={18} />} tone="bad" label="Sent back" n={d.rejected} money={v.rejected} href={approvals('rejected')} />
          <Kpi icon={<Layers size={18} />} tone="info" label="All at Accounts" n={total} money={totalValue} href={approvals('all')} />
        </div>
      </div>

      {(d.pending || 0) > 0 && (
        <div className="ard-issues">
          <Link href={approvals('pending')} className="ard-issue warn">
            <span className="ard-issue-icon"><Hourglass size={17} /></span>
            <span className="ard-issue-body">
              <span className="ard-issue-n">{d.pending} <small>waiting for sign-off</small></span>
              <span className="ard-issue-text">{inrShort(v.pending || 0)} · the oldest has waited {waiting[0]?.days ?? 0} days since Sales or CP approved it</span>
            </span>
            <ArrowRight size={16} className="ard-issue-go" />
          </Link>
        </div>
      )}

      <div className="ard-grid">
        {/* Where they stand: one bar, then a row per state — the AR "Overdue by age" card. */}
        <div className="nx-card ard-card">
          <div className="ard-card-head">
            <div><div className="ard-card-title">Where they stand</div><div className="ard-card-sub">Every booking at the Accounts gate</div></div>
            <div className="ard-card-total">{total.toLocaleString('en-IN')}</div>
          </div>
          <div className="ard-stack">
            {STATES.map((s) => (d[s.key] ? (
              <span key={s.key} className={`ard-seg ${s.cls}`} title={`${s.label} · ${d[s.key]}`} style={{ width: `${(d[s.key] / Math.max(1, total)) * 100}%` } /* inline-ok: segment width from data */} />
            ) : null))}{/* inline-ok: segment width from data */}
          </div>
          <div className="ard-ages">
            {STATES.map((s) => (
              <div key={s.key} className={`ard-age acc-age-row${d[s.key] ? '' : ' is-zero'}`}>
                <span className={`ard-dot ${s.cls}`} />
                <span className="ard-age-label">{s.label}</span>
                <span className="ard-age-track"><span className={s.cls} style={{ width: `${((d[s.key] || 0) / Math.max(1, total)) * 100}%` }} /></span>{/* inline-ok: bar length from data */}
                <b>{(d[s.key] || 0).toLocaleString('en-IN')}</b>
                <b className="acc-age-money" title={rupee(v[s.key] || 0)}>{v[s.key] ? inrShort(v[s.key]) : '—'}</b>
                <span className="ard-age-pct">{total ? `${Math.round(((d[s.key] || 0) / total) * 100)}%` : ''}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Signed off each month — the AR "Falling due" columns. */}
        <div className="nx-card ard-card">
          <div className="ard-card-head">
            <div><div className="ard-card-title">Signed off by month</div><div className="ard-card-sub">Bookings Accounts approved · last six months</div></div>
            <div className="ard-card-total">{trend.reduce((t, m) => t + m.count, 0)}</div>
          </div>
          <div className="ard-cols">
            {trend.map((m) => {
              const max = Math.max(1, ...trend.map((x) => x.count));
              return (
                <div key={m.month} className="ard-col" title={`${m.month} · ${m.count} bookings · ${rupee(m.value)}`}>
                  <span className="ard-col-value">{m.count || '—'}</span>
                  <span className="ard-col-track">
                    <span className="ard-col-bar acc-col-ok" style={{ height: `${Math.max(m.count ? 4 : 0, (m.count / max) * 100)}%` }} />{/* inline-ok: column height from data */}
                  </span>
                  <span className="ard-col-label">{m.month}</span>
                  <span className="acc-col-money">{m.value ? inrShort(m.value) : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ard-grid">
        {/* Waiting longest — the AR "Most overdue" list. */}
        <div className="nx-card ard-card">
          <div className="ard-card-head">
            <div className="ard-card-title ard-with-icon"><Hourglass size={16} />Waiting longest</div>
            <Link href={approvals('pending')} className="acc-link">All {d.pending || 0} <ArrowRight size={13} /></Link>
          </div>
          {waiting.length === 0 ? <div className="ar-empty">Nothing is waiting — every booking at Accounts has been decided.</div> : (
            <div className="ard-top-list">
              {waiting.map((w, i) => (
                <Link key={w.id} href={approvals('pending')} className="ard-row">
                  <span className="ard-rank">{i + 1}</span>
                  <span className="ard-avatar">{initials(w.client)}</span>
                  <span className="ard-row-body">
                    <span className="ard-row-name">{w.client || '—'}</span>
                    <span className="ard-row-sub">{w.project}{w.plots ? ` · Plot ${w.plots}` : ''}{w.stm ? ` · ${w.stm}` : ''}</span>
                  </span>
                  <span className="acc-row-end">
                    <span className="acc-row-amt" title={rupee(w.amount)}>{inrShort(w.amount)}</span>
                    <span className={`acc-days${w.days >= 7 ? ' is-old' : w.days >= 3 ? ' is-mid' : ''}`}>{w.days ?? '—'} days</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* By project — a row per project with its split and what Accounts approved. */}
        <div className="nx-card ard-card">
          <div className="ard-card-head">
            <div className="ard-card-title ard-with-icon"><LayoutGrid size={16} />By project</div>
            <span className="ard-card-sub">Approved value</span>
          </div>
          <div className="ard-top-list">
            {projects.map((p) => {
              const n = p.pending + p.approved + p.rejected;
              return (
                <div key={p.id || p.name} className="ard-row acc-proj-row">
                  <span className="ard-avatar">{initials(p.name)}</span>
                  <span className="ard-row-body">
                    <span className="ard-row-name">{p.name}</span>
                    <span className="ard-row-sub">
                      {p.approved} approved{p.pending ? <> · <em className="acc-wait-n">{p.pending} waiting</em></> : ''}{p.rejected ? ` · ${p.rejected} sent back` : ''}
                    </span>
                    <span className="acc-proj-bar">
                      {STATES.map((s) => (p[s.key] ? (
                        <span key={s.key} className={s.cls} style={{ width: `${(p[s.key] / Math.max(1, n)) * 100}%` } /* inline-ok: split from data */} />
                      ) : null))}{/* inline-ok: split from data */}
                    </span>
                  </span>
                  <span className="acc-row-end">
                    <span className="acc-row-amt is-good" title={rupee(p.approved_value)}>{p.approved_value ? inrShort(p.approved_value) : '—'}</span>
                    {p.pending_value ? <span className="acc-row-note">+{inrShort(p.pending_value)} waiting</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Ring({ pct, cap }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="ard-ring">
      <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} className="ard-ring-track" />
        <circle cx="64" cy="64" r={r} className="ard-ring-fill" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 64 64)" />
      </svg>
      <div className="ard-ring-center"><b>{p}%</b><span>signed off</span></div>
      <div className="ard-ring-cap">{cap}</div>
    </div>
  );
}

function Kpi({ icon, tone, label, n, money, href }) {
  return (
    <Link href={href} className="nx-card ard-kpi is-link">
      <div className="ard-kpi-top"><span className={`ard-kpi-icon ${tone}`}>{icon}</span><ChevronRight size={16} className="ard-kpi-go" /></div>
      <div className="ard-kpi-label">{label}</div>
      <div className={`ard-kpi-value ${tone}`}>{(n || 0).toLocaleString('en-IN')}</div>
      <div className="ard-kpi-sub" title={rupee(money || 0)}>{inrShort(money || 0)}</div>
    </Link>
  );
}
