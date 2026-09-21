'use client';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '../../components/Icon';

// A KPI tile with an icon chip — used for both the primary numbers row and the
// "Needs Attention" row. `accent` picks one of a fixed palette of modifier
// classes (blue/green/purple/orange/red) — no inline colour, ever.
export function KpiCard({ icon, label, value, sub, accent = 'green', href }) {
  const content = (
    <>
      <div className="nx-kpi-icon">
        <Icon name={icon} size={19} />
      </div>
      <div>
        <div className="nx-kpi-label">{label}</div>
        <div className="nx-kpi-value">{value}</div>
        {sub && <div className="nx-kpi-sub">{sub}</div>}
      </div>
    </>
  );
  const Tag = href ? Link : 'div';
  const extra = href ? { href } : {};
  return <Tag className={`nx-kpi-card nx-kpi-accent-${accent}`} {...extra}>{content}</Tag>;
}

// Section wrapper — a consistent card shell with a title, used for the table/
// chart/list sections below the KPI rows.
export function SectionCard({ title, action, children }) {
  return (
    <div className="nx-c1k-card-full">
      <div className="nx-c1k-section-head">
        <div className="nx-c1k-section-head-title">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

// Recharts reads colour off each Cell's `fill` prop directly (its own typed
// API, not the page's `style` prop) — the fixed legend swatches below use
// real CSS classes (.nx-donut-dot.<key>) instead.
const DONUT_FILL = {
  active: 'var(--success)',
  due_for_renewal: 'var(--warning-2)',
  redeemed: 'var(--accent)',
  premature_redeemed: 'var(--danger)',
};
const DONUT_LABELS = {
  active: 'Active',
  due_for_renewal: 'Due for Renewal',
  redeemed: 'Redeemed',
  premature_redeemed: 'Premature Redeemed',
};

// Recharts' default Tooltip content carries its own hardcoded inline styles
// no matter what contentStyle/wrapperClassName is passed — a custom content
// render function is the only way to style it with a real class (same
// pattern sales/_TrendCharts.js already uses for its own tooltip).
function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return <div className="nx-donut-tooltip">{name}: <strong>{value}</strong></div>;
}

// Portfolio status breakdown — a donut so "how much of my book needs a
// renew/payout decision right now" reads at a glance, not as four separate
// numbers the reader has to add up themselves.
export function StatusDonut({ breakdown }) {
  const rows = Object.entries(breakdown || {})
    .map(([key, value]) => ({ key, name: DONUT_LABELS[key] || key, value }))
    .filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);

  if (!total) {
    return <div className="nx-donut-empty">No investors yet.</div>;
  }

  return (
    <div className="nx-donut-wrap">
      <div className="nx-donut-circle">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={40} outerRadius={62} paddingAngle={2} stroke="none">
              {rows.map((r) => <Cell key={r.key} fill={DONUT_FILL[r.key] || 'var(--muted)'} />)}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="nx-donut-center">
          <div className="nx-donut-center-num">{total}</div>
          <div className="nx-donut-center-label">Investors</div>
        </div>
      </div>
      <div className="nx-donut-legend">
        {rows.map((r) => (
          <div key={r.key} className="nx-donut-row">
            <span className={`nx-donut-dot ${r.key}`} />
            <span className="nx-donut-name">{r.name}</span>
            <span className="nx-donut-count">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
