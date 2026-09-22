'use client';
import Link from 'next/link';
import { ArrowRight, ChevronRight, TriangleAlert } from 'lucide-react';

// Shared dashboard building blocks — the look of the AR dashboard, reused by the
// Sales and Club 1000 dashboards so every module's home reads the same way:
// a gradient hero with the headline number, icon KPI cards, "needs attention"
// cards, bar breakdowns and ranked lists. Styles live in ui.css (.ard-*).

// Gradient hero: eyebrow, big value, a few split figures, and a ring or actions on the right.
export function DashHero({ eyebrow, value, valueTitle, splits = [], ring, actions, note }) {
  return (
    <div className="ard-hero">
      <div className="ard-hero-main">
        {eyebrow && <div className="ard-hero-label">{eyebrow}</div>}
        <div className="ard-hero-value" title={valueTitle}>{value}</div>
        {splits.length > 0 && (
          <div className="ard-hero-split">
            {splits.map((x) => <div key={x.label}><span>{x.label}</span><b title={x.title}>{x.value}</b></div>)}
          </div>
        )}
        {note && <div className="ard-hero-note">{note}</div>}
      </div>
      <div className="ard-hero-side">
        {actions && <div className="ard-hero-actions">{actions}</div>}
        {ring && <DashRing {...ring} />}
      </div>
    </div>
  );
}

export function DashRing({ pct, label, caption, captionTitle }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="ard-ring">
      <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} className="ard-ring-track" />
        <circle cx="64" cy="64" r={r} className="ard-ring-fill" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 64 64)" />
      </svg>
      <div className="ard-ring-center"><b>{Math.round(p * 10) / 10}%</b><span>{label}</span></div>
      {caption && <div className="ard-ring-cap" title={captionTitle}>{caption}</div>}
    </div>
  );
}

// KPI card: tinted icon, label, value, sub-line; a link when href is given.
export function DashKpi({ icon: Icon, tone = 'info', label, value, valueTitle, sub, href }) {
  const body = (
    <>
      <div className="ard-kpi-top">
        <span className={`ard-kpi-icon ${tone}`}>{Icon ? <Icon size={18} /> : null}</span>
        {href && <ChevronRight size={16} className="ard-kpi-go" />}
      </div>
      <div className="ard-kpi-label">{label}</div>
      <div className={`ard-kpi-value ${tone}`} title={valueTitle}>{value}</div>
      {sub != null && sub !== '' && <div className="ard-kpi-sub">{sub}</div>}
    </>
  );
  return href
    ? <Link href={href} className="nx-card ard-kpi is-link">{body}</Link>
    : <div className="nx-card ard-kpi">{body}</div>;
}

export function DashKpiGrid({ children }) {
  return <div className="ard-kpi-grid">{children}</div>;
}

// "Needs attention" cards — only the ones with a count are shown.
export function DashAlerts({ items }) {
  const shown = (items || []).filter((i) => i.count > 0);
  if (!shown.length) return null;
  return (
    <div className="ard-issues">
      {shown.map((i) => {
        const inner = (
          <>
            <span className="ard-issue-icon">{i.icon ? <i.icon size={17} /> : <TriangleAlert size={17} />}</span>
            <span className="ard-issue-body">
              <span className="ard-issue-n">{i.count} <small>{i.label}</small></span>
              {i.text && <span className="ard-issue-text">{i.text}</span>}
            </span>
            {i.href && <ArrowRight size={16} className="ard-issue-go" />}
          </>
        );
        return i.href
          ? <Link key={i.label} href={i.href} className={`ard-issue ${i.tone || 'warn'}`}>{inner}</Link>
          : <div key={i.label} className={`ard-issue ${i.tone || 'warn'}`}>{inner}</div>;
      })}
    </div>
  );
}

// Card shell with a title row (optional icon, sub-line, big total or an action).
export function DashCard({ title, sub, icon: Icon, total, totalTitle, action, children, className = '' }) {
  return (
    <div className={`nx-card ard-card ${className}`}>
      <div className="ard-card-head">
        <div>
          <div className={`ard-card-title${Icon ? ' ard-with-icon' : ''}`}>{Icon ? <Icon size={16} /> : null}{title}</div>
          {sub && <div className="ard-card-sub">{sub}</div>}
        </div>
        {total != null && <div className="ard-card-total" title={totalTitle}>{total}</div>}
        {action}
      </div>
      {children}
    </div>
  );
}

export function DashGrid({ children }) {
  return <div className="ard-grid">{children}</div>;
}

// Horizontal bars: a share of the total per row. tone: good | warn | bad | info | muted.
export function DashBars({ rows, empty = 'Nothing to show yet.' }) {
  const total = rows.reduce((t, r) => t + (Number(r.value) || 0), 0);
  if (!total) return <div className="ar-empty">{empty}</div>;
  return (
    <div className="ard-ages">
      {rows.map((r) => (
        <div key={r.label} className={`ard-age${r.value ? '' : ' is-zero'}`}>
          <span className={`ard-dot tone-${r.tone || 'info'}`} />
          <span className="ard-age-label" title={r.label}>{r.label}</span>
          <span className="ard-age-track"><span className={`tone-${r.tone || 'info'}`} style={{ width: `${(r.value / total) * 100}%` }} /></span>{/* inline-ok: bar length from data */}
          <b title={r.title}>{r.display ?? r.value}</b>
          <span className="ard-age-pct">{r.value ? `${Math.round((r.value / total) * 100)}%` : ''}</span>
        </div>
      ))}
    </div>
  );
}

// Ranked list: rank, initials, name, sub-line, a bar relative to the top row, amount.
export function DashRank({ rows, empty = 'Nothing to show yet.', tone = 'bad' }) {
  if (!rows.length) return <div className="ar-empty">{empty}</div>;
  const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
  return (
    <div className="ard-top-list">
      {rows.map((r, i) => {
        const inner = (
          <>
            <span className="ard-rank">{i + 1}</span>
            <span className="ard-avatar">{initials(r.name)}</span>
            <span className="ard-row-body">
              <span className="ard-row-name">{r.name}</span>
              {r.sub && <span className="ard-row-sub">{r.sub}</span>}
              <span className={`ard-row-bar tone-${tone}`}><span style={{ width: `${((Number(r.value) || 0) / max) * 100}%` }} /></span>{/* inline-ok: bar length from data */}
            </span>
            <span className={`ard-row-amt tone-${tone}`} title={r.title}>{r.display ?? r.value}</span>
          </>
        );
        return r.href
          ? <Link key={r.key ?? i} href={r.href} className="ard-row">{inner}</Link>
          : <div key={r.key ?? i} className="ard-row">{inner}</div>;
      })}
    </div>
  );
}

export function DashSectionTitle({ children, sub }) {
  return <div className="ard-section"><h2>{children}</h2>{sub && <span>{sub}</span>}</div>;
}

function initials(name) {
  const parts = String(name || '').replace(/^(mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '—';
}
