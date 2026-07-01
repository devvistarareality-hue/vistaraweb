'use client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, defs, linearGradient, stop
} from 'recharts';

function fillDates(rows, dateFrom, dateTo) {
  const map = {};
  rows.forEach(r => { map[r.date] = r.count; });

  const result = [];
  const cur = new Date(dateFrom);
  const end = new Date(dateTo);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    result.push({ date: key, count: map[key] ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const cardStyle = {
  flex: 1,
  background: '#fff',
  borderRadius: 16,
  border: '1px solid #F0F3FA',
  padding: '18px 20px',
  boxShadow: '0 2px 12px rgba(24,35,80,0.06)',
  minWidth: 0,
};

const CustomTooltip = ({ active, payload, label, color, metricLabel }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1A1A2E', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label ? shortDate(label) : ''}</div>
      <div style={{ color }}>{metricLabel}: <strong>{payload[0].value}</strong></div>
    </div>
  );
};

function SingleChart({ title, badge, data, color, gradientId, metricLabel, emptyMsg }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  // Keep ALL data points so no spikes are lost — only reduce x-axis label frequency
  const labelInterval = data.length > 14 ? Math.ceil(data.length / 6) : 0;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#1A1A2E' }}>{total}</span>
            <span style={{ fontSize: 12, color: '#8492A6', fontWeight: 600 }}>total</span>
          </div>
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 20, background: color + '20', color, fontSize: 12, fontWeight: 700 }}>
          {badge}
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C0C8D8', fontSize: 13 }}>
          {emptyMsg}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F3FA" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: '#B0BAD0' }} tickLine={false} axisLine={false} interval={labelInterval} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#B0BAD0' }} tickLine={false} axisLine={false} width={32} />
            <Tooltip content={<CustomTooltip color={color} metricLabel={metricLabel} />} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 2' }} />
            <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 5, fill: color, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function TrendCharts({ trend, dateFrom, dateTo, loading }) {
  const defaultFrom = (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); })();
  const defaultTo   = new Date().toISOString().slice(0, 10);

  const from = dateFrom || defaultFrom;
  const to   = dateTo   || defaultTo;

  const mqlData = trend ? fillDates(trend.mql || [], from, to) : [];
  const svData  = trend ? fillDates(trend.sv  || [], from, to) : [];

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ ...cardStyle, height: 196 }}>
            <div style={{ height: 16, width: 120, background: '#F0F3FA', borderRadius: 6, marginBottom: 10 }} />
            <div style={{ height: 28, width: 60, background: '#F0F3FA', borderRadius: 6, marginBottom: 20 }} />
            <div style={{ height: 120, background: '#F8FAFD', borderRadius: 8 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
      <SingleChart
        title="Called / MQL"
        badge="MQL Trend"
        data={mqlData}
        color="#3D5AFE"
        gradientId="mqlGrad"
        metricLabel="MQL"
        emptyMsg="No MQL data for this range"
      />
      <SingleChart
        title="Site Visits"
        badge="SV Trend"
        data={svData}
        color="#10B981"
        gradientId="svGrad"
        metricLabel="SV"
        emptyMsg="No SV data for this range"
      />
    </div>
  );
}
