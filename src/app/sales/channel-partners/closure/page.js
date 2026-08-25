'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { ClosureProjectsContent } from '../../closure/page';

// The actual Booking-creation flow (pick a project → view units → record a
// closure), identical to the main Sales module's — not filtered to channel
// partner leads, since choosing a project/unit isn't a CP-specific concept.
export default function ChannelPartnerBookingPage() {
  const user = useSelector((s) => s.auth.user);

  if (!canAccessChannelPartner(user)) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Admin access only.</div>;
  }

  return <ClosureProjectsContent backHref="/sales/channel-partners/site-visits" />;
}
