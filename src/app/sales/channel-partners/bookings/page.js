'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { BookingsContent } from '../../bookings/page';

// Filtered to Channel-Partner-sourced bookings only (cp_only — see cp_lead_q):
// a lead referred by an actual Channel Partner, OR sourced/booked with
// Source = "Channel Partner". Was deliberately left unfiltered early on,
// when CP-sourced bookings didn't exist yet and filtering just left the page
// empty — now that real ones exist, showing the company-wide list here was
// just noise unrelated to CP work.
// `cpMode` is a separate flag from `cpOnly` — it only swaps which "Booking
// Approvers — by project" panel renders (CP approvers here, not the regular
// ones), independent of the (now filtered) booking list above.
export default function ChannelPartnerBookingsPage() {
  const user = useSelector((s) => s.auth.user);
  if (!canAccessChannelPartner(user)) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Admin access only.</div>;
  }

  return <BookingsContent adminView cpMode cpOnly />;
}
