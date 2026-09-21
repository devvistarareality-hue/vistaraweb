'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { MODULE_META } from './moduleMeta';
import { isManagerRole } from '../../../lib/moduleAccess';

// Every tile is the same card, so they keep one height across the row —
// the description flexes and "Open →" is pinned to the bottom.
const ICONS = {
  team: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /></>,
  check: <><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></>,
};

function Tile({ href, icon, title, desc }) {
  return (
    <Link href={href} className="nx-tile-link">
      <div className="nx-card nx-tile">
        <div className="nx-tile-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[icon]}
          </svg>
        </div>
        <div className="nx-tile-title">{title}</div>
        <div className="nx-tile-desc">{desc}</div>
        <div className="nx-tile-open">Open →</div>
      </div>
    </Link>
  );
}

export default function ModuleOverview({ params }) {
  const slug = params.module;
  const router = useRouter();
  // AR opens straight on its Dashboard; /m/ar (old links, bookmarks) forwards there.
  useEffect(() => { if (slug === 'ar') router.replace('/m/ar/dashboard'); }, [slug, router]);
  const meta = MODULE_META[slug] || { name: slug, accent: 'var(--accent)', desc: '' };
  const user = useSelector((s) => s.auth.user);
  const canSeeTeam = isManagerRole(user) || user?.role === 'Admin' || user?.is_staff;

  if (slug === 'ar') return null;
  const tiles = [
    canSeeTeam && { href: `/m/${slug}/team`, icon: 'team', title: 'My Team', desc: `View the ${meta.name} department org chart` },
    slug === 'accounts' && { href: `/m/${slug}/approvals`, icon: 'check', title: 'Approvals', desc: "Review pending LOI & EOI bookings and approve/reject each one's Accounts-stage sign-off" },
    slug === 'accounts' && { href: `/m/${slug}/bookings`, icon: 'book', title: 'Bookings', desc: 'Approved bookings and cancellations, project-wise' },
  ].filter(Boolean);

  return (
    <div className="nx-page" style={{ '--tile-accent': meta.accent }}>{/* inline-ok: per-module accent colour */}
      <h1 className="nx-page-title">{meta.name}</h1>
      <p className="nx-page-sub">{meta.desc}</p>

      {tiles.length === 0
        ? <p className="nx-ratio-empty">No tools available in this module yet.</p>
        : (
          <div className="nx-tile-grid">
            {tiles.map((t) => <Tile key={t.href} {...t} />)}
          </div>
        )}
    </div>
  );
}
