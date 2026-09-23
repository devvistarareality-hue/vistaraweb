'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { ClosureProjectsContent } from '../../../sales/closure/page';

// The actual Booking-creation flow (pick a project → view units → record a
// closure) — same project/unit list as the main Sales module's, not filtered
// to channel partner leads, since choosing a project/unit isn't a CP-specific
// concept. `cpOnly` only keeps the click-through (project card → unit map)
// inside /cp/closure/[id] instead of the plain /sales/
// closure/[id], so a CP manager's "← All projects" button stays in-module.
export default function ChannelPartnerBookingPage() {
  const user = useSelector((s) => s.auth.user);

  if (!user) return null;

  if (!canAccessChannelPartner(user)) {
    return <div className="nx-note info">This is the Channel Partner module — ask an administrator for access.</div>;
  }

  return <ClosureProjectsContent backHref="/m/cp/site-visits" cpOnly />;
}
