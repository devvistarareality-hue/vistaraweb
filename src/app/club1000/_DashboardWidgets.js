'use client';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '../../components/Icon';

// A KPI tile with an icon chip — used for both the primary numbers row and the
// "Needs Attention" row (same shape, just a warning/danger accent for the latter).
export function KpiCard({ icon, label, value, sub, accent = 'var(--success)', href }) {
  const content = (
    <>
      <div className="nx-kpi-icon" style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}> {/* inline-ok: accent is per-metric, not a fixed style */}
        <Icon name={icon} size={19} />
      </div>
      <div>
        <div className="nx-kpi-label">{label}</div>
        <div className="nx-kpi-value" style={{ color: accent }}>{value}</div> {/* inline-ok: accent is per-metric */}
        {sub && <div className="nx-kpi-sub">{sub}</div>}
      </div>
    </>
  );
  const Tag = href ? Link : 'div';
  const extra = href ? { href } : {};
  return <Tag className="nx-kpi-card" {...extra}>{content}</Tag>;
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

const DONUT_COLORS = {
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

// Portfolio status breakdown — a donut so "how much of my book needs a
// renew/payout decision right now" reads at a glance, not as four separate
// numbers the reader has to add up themselves.
export function StatusDonut({ breakdown }) {
  const rows = Object.entries(breakdown || {})
    .map(([key, value]) => ({ key, name: DONUT_LABELS[key] || key, value, color: DONUT_COLORS[key] || 'var(--muted)' }))
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
              {rows.map((r) => <Cell key={r.key} fill={r.color} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid var(--surface-3)' }} />
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
            <span className="nx-donut-dot" style={{ background: r.color }} /> {/* inline-ok: per-status color */}
            <span className="nx-donut-name">{r.name}</span>
            <span className="nx-donut-count">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
