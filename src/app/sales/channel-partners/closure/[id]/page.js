'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../../lib/moduleAccess';
import { ClosureViewerContent } from '../../../closure/[id]/page';

// Same unit-map/booking flow as the main Sales module's (see channel-partners/
// closure/page.js) — just keeps the CP manager's "← All projects" back button
// inside the Channel Partner module instead of dropping them onto plain Sales.
export default function ChannelPartnerClosureViewerPage() {
  const user = useSelector((s) => s.auth.user);

  if (!canAccessChannelPartner(user)) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Admin access only.</div>;
  }

  return <ClosureViewerContent backHref="/sales/channel-partners/closure" />;
}
