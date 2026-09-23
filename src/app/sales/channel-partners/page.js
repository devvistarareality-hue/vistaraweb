'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../lib/moduleAccess';
import { pinnedDashboard } from '../../../lib/dashboards';
import { AdminDashboard } from '../page';

// The partner desk, scoped to partner-sourced records. A designation can pin a
// different view here once one is built — see lib/dashboards.js.
const VIEWS = {};

export default function ChannelPartnersPage() {
  const user = useSelector((s) => s.auth.user);

  if (!canAccessChannelPartner(user)) {
    return <div className="nx-note info">Admin access only.</div>;
  }

  const Pinned = pinnedDashboard(user, VIEWS);
  if (Pinned) return <Pinned user={user} />;
  return <AdminDashboard user={user} cpOnly />;
}
