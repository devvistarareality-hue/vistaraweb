'use client';
import Link from 'next/link';

export default function StatCard({ label, value, accent = '#00838F', href }) {
  const card = (
    <div style={{ flex: '1 1 180px', minWidth: 160, background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #EDF1F7', cursor: href ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8492A6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
  if (!href) return card;
  return <Link href={href} style={{ textDecoration: 'none', flex: '1 1 180px' }}>{card}</Link>;
}

export function fmtMoney(n) {
  const num = Number(n || 0);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
