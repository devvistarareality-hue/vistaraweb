'use client';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { MODULE_META } from './moduleMeta';
import { isManagerRole } from '../../../lib/moduleAccess';

export default function ModuleOverview({ params }) {
  const slug = params.module;
  const meta = MODULE_META[slug] || { name: slug, accent: 'var(--accent)', desc: '' };
  const user = useSelector((s) => s.auth.user);
  const canSeeTeam = isManagerRole(user) || user?.role === 'Admin' || user?.is_staff;

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{meta.name}</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{meta.desc}</p>

      <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {canSeeTeam && (
        <Link href={`/m/${slug}/team`} style={{ textDecoration: 'none' }}>
          <div className="nx-card" style={{ width: 280, background: 'var(--surface)', borderRadius: 20, padding: 20, boxShadow: '0 4px 16px rgba(140,148,160,0.22)', border: '1px solid var(--surface-3)', cursor: 'pointer' }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: `color-mix(in srgb, ${meta.accent} 9%, transparent)`, color: meta.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>My Team</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>View the {meta.name} department org chart</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: meta.accent }}>Open →</div>
          </div>
        </Link>
        )}
        {slug === 'accounts' && (
        <Link href={`/m/${slug}/approvals`} style={{ textDecoration: 'none' }}>
          <div className="nx-card" style={{ width: 280, background: 'var(--surface)', borderRadius: 20, padding: 20, boxShadow: '0 4px 16px rgba(140,148,160,0.22)', border: '1px solid var(--surface-3)', cursor: 'pointer' }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: `color-mix(in srgb, ${meta.accent} 9%, transparent)`, color: meta.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>Approvals</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Review pending LOI &amp; EOI bookings and approve/reject each one's Accounts-stage sign-off</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: meta.accent }}>Open →</div>
          </div>
        </Link>
        )}
        {slug === 'accounts' && (
        <Link href={`/m/${slug}/bookings`} style={{ textDecoration: 'none' }}>
          <div className="nx-card" style={{ width: 280, background: 'var(--surface)', borderRadius: 20, padding: 20, boxShadow: '0 4px 16px rgba(140,148,160,0.22)', border: '1px solid var(--surface-3)', cursor: 'pointer' }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: `color-mix(in srgb, ${meta.accent} 9%, transparent)`, color: meta.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 5 }}>Bookings</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Approved bookings and cancellations, project-wise</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: meta.accent }}>Open →</div>
          </div>
        </Link>
        )}
        {!canSeeTeam && slug !== 'accounts' && (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>No tools available in this module yet.</p>
        )}
      </div>
    </div>
  );
}
