'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { ClipboardCheck, BookCheck, CircleSlash, Layers, ArrowRight, Hourglass, LayoutGrid } from 'lucide-react';
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

  const kpis = useMemo(() => {
    const n = d || {};
    const v = n.values || {};
    return [
      { key: 'pending', icon: ClipboardCheck, tone: 'wait', label: 'Waiting for sign-off', value: n.pending || 0,
        money: v.pending, sub: 'At the Accounts gate', href: `/m/${slug}/approvals?tab=pending` },
      { key: 'approved', icon: BookCheck, tone: 'ok', label: 'Approved', value: n.approved || 0,
        money: v.approved, sub: 'Signed off by Accounts', href: `/m/${slug}/bookings` },
      { key: 'rejected', icon: CircleSlash, tone: 'bad', label: 'Sent back', value: n.rejected || 0,
        money: v.rejected, sub: 'Returned to Sales with remarks', href: `/m/${slug}/approvals?tab=rejected` },
      { key: 'total', icon: Layers, tone: 'info', label: 'All at Accounts', value: n.total || 0,
        money: (v.pending || 0) + (v.approved || 0) + (v.rejected || 0), sub: 'Waiting + approved + sent back',
        href: `/m/${slug}/approvals?tab=all` },
    ];
  }, [d, slug]);

  if (d === null) {
    return <div className="nx-page"><Loader label="Adding it up…" /></div>;
  }
  const total = d.total || 0;
  const totalValue = kpis[3].money || 0;
  const trend = d.trend || [];
  const trendMax = Math.max(1, ...trend.map((t) => t.count));
  const projects = d.by_project || [];
  const projMax = Math.max(1, ...projects.map((p) => p.pending + p.approved + p.rejected));
  const waiting = d.oldest_pending || [];

  return (
    <div className="nx-page">
      <div className="md-head">
        <div>
          <h1 className="nx-page-title">{meta.name}</h1>
          <p className="nx-page-sub">Bookings Sales and Channel Partner have approved, at the Accounts gate</p>
        </div>
      </div>

      {/* The headline: everything at Accounts, and how it splits. */}
      <section className="nx-card acc-hero">
        <div className="acc-hero-top">
          <div>
            <div className="acc-hero-label">At the Accounts gate</div>
            <div className="acc-hero-value">{total.toLocaleString('en-IN')} <span>bookings</span></div>
            <div className="acc-hero-sub">{rupee(totalValue)} in all</div>
          </div>
          <Link href={`/m/${slug}/approvals?tab=pending`} className="nx-btn nx-btn-md nx-btn-primary acc-hero-cta">
            Review {d.pending || 0} waiting <ArrowRight size={15} />
          </Link>
        </div>
        <div className="acc-bar" role="img" aria-label="Approved, waiting and sent back">
          {STATES.map((s) => (d[s.key] ? (
            <span key={s.key} className={`acc-bar-seg ${s.cls}`} style={{ flexGrow: d[s.key] } /* inline-ok: share from data */}
              title={`${s.label}: ${d[s.key]}`} />
          ) : null))}
        </div>
        <div className="acc-legend">
          {STATES.map((s) => (
            <span key={s.key}>
              <i className={`acc-dot ${s.cls}`} />{s.label}
              <b>{d[s.key] || 0}</b>
              <em>{total ? Math.round(((d[s.key] || 0) / total) * 100) : 0}%</em>
            </span>
          ))}
        </div>
      </section>

      <div className="md-kpis">
        {kpis.map((k) => (
          <Link key={k.key} href={k.href} className={`nx-card md-kpi acc-kpi acc-kpi-${k.tone}`}>
            <span className="md-kpi-icon"><k.icon size={18} /></span>
            <span className="md-kpi-label">{k.label}</span>
            <b className="md-kpi-value">{k.value.toLocaleString('en-IN')}</b>
            <span className="acc-kpi-money">{inrShort(k.money || 0)}</span>
            <span className="md-kpi-sub">{k.sub}</span>
            <ArrowRight size={14} className="md-kpi-go" />
          </Link>
        ))}
      </div>

      <div className="acc-grid">
        <section className="nx-card acc-panel">
          <div className="acc-panel-head">
            <div>
              <h2>Waiting longest</h2>
              <p>Oldest first — days since Sales or CP approved them</p>
            </div>
            <Link href={`/m/${slug}/approvals?tab=pending`} className="acc-link">All {d.pending || 0} <ArrowRight size={13} /></Link>
          </div>
          {waiting.length ? (
            <ul className="acc-wait">
              {waiting.map((w) => (
                <li key={w.id}>
                  <span className={`acc-age${w.days >= 7 ? ' is-old' : w.days >= 3 ? ' is-mid' : ''}`}>
                    <Hourglass size={12} />{w.days ?? '—'}d
                  </span>
                  <div className="acc-wait-main">
                    <b>{w.client || '—'}</b>
                    <span>{w.project}{w.plots ? ` · Plot ${w.plots}` : ''}{w.stm ? ` · ${w.stm}` : ''}</span>
                  </div>
                  <span className="acc-wait-amt">{inrShort(w.amount)}</span>
                </li>
              ))}
            </ul>
          ) : <div className="acc-none">Nothing is waiting — every booking at Accounts has been decided.</div>}
        </section>

        <section className="nx-card acc-panel">
          <div className="acc-panel-head">
            <div>
              <h2>Signed off — last six months</h2>
              <p>Bookings Accounts approved each month</p>
            </div>
          </div>
          <div className="acc-trend" role="list">
            {trend.map((t, i) => (
              <div key={t.month} role="listitem" className="acc-trend-col" title={`${t.month}: ${t.count} bookings · ${rupee(t.value)}`}>
                <span className="acc-trend-val">{t.count || '—'}</span>
                <div className="acc-trend-track">
                  <div className="acc-trend-bar" style={{ height: `${(t.count / trendMax) * 100}%` } /* inline-ok: column height from data */} />
                </div>
                <span className={`acc-trend-label${i === trend.length - 1 ? ' is-now' : ''}`}>{t.month}</span>
                <span className="acc-trend-money">{t.value ? inrShort(t.value) : ''}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="nx-card acc-panel">
        <div className="acc-panel-head">
          <div>
            <h2>By project</h2>
            <p>Where each project stands at Accounts</p>
          </div>
          <div className="acc-legend acc-legend-sm">
            {STATES.map((s) => <span key={s.key}><i className={`acc-dot ${s.cls}`} />{s.label}</span>)}
          </div>
        </div>
        <div className="arb-scroll">
          <table className="nx-table acc-table">
            <thead>
              <tr>
                <th>Project</th><th className="acc-bar-col" /><th className="num">Waiting</th><th className="num">Approved</th>
                <th className="num">Sent back</th><th className="num">Waiting value</th><th className="num">Approved value</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const n = p.pending + p.approved + p.rejected;
                return (
                  <tr key={p.id || p.name}>
                    <td className="acc-proj">{p.name}</td>
                    <td className="acc-bar-col">
                      <div className="acc-minibar" style={{ width: `${(n / projMax) * 100}%` } /* inline-ok: bar length from data */}>
                        {STATES.map((s) => (p[s.key] ? (
                          <span key={s.key} className={`acc-bar-seg ${s.cls}`} style={{ flexGrow: p[s.key] } /* inline-ok: share from data */} />
                        ) : null))}
                      </div>
                    </td>
                    <td className="num">{p.pending ? <span className="acc-num-wait">{p.pending}</span> : '—'}</td>
                    <td className="num">{p.approved || '—'}</td>
                    <td className="num">{p.rejected ? <span className="acc-num-bad">{p.rejected}</span> : '—'}</td>
                    <td className="num">{p.pending_value ? inrShort(p.pending_value) : '—'}</td>
                    <td className="num acc-strong">{p.approved_value ? inrShort(p.approved_value) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
