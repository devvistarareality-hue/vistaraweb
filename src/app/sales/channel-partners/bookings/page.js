'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { BookingsContent } from '../../bookings/page';

// Mirrors the main Sales module's Bookings & Approvals exactly — same data, not
// filtered to channel-partner-referred leads. A booking is a much later pipeline
// stage than a CP lead, so restricting this to cp_only left it empty until a CP
// lead's deal actually closed; showing the same company-wide view here instead.
// `cpMode` is a separate flag from `cpOnly` — it only swaps which "Booking
// Approvers — by project" panel renders (CP approvers here, not the regular
// ones), independent of the (deliberately unfiltered) booking list above.
export default function ChannelPartnerBookingsPage() {
  const user = useSelector((s) => s.auth.user);
  if (!canAccessChannelPartner(user)) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Admin access only.</div>;
  }

  return <BookingsContent adminView cpMode />;
}
