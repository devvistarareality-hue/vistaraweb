'use client';
import { useSelector } from 'react-redux';
import { notFound } from 'next/navigation';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import BookingPageWrapper from '../../../sales/booking/page';

// The booking form inside the Channel Partner module — the same form as Sales
// (sales/booking), so booking a plot from the CP unit map keeps the CP menu.
export default function ChannelPartnerBookingFormPage({ params }) {
  const user = useSelector((s) => s.auth.user);
  if (params.module !== 'cp') notFound();
  if (!user) return null;
  if (!canAccessChannelPartner(user)) {
    return <div className="nx-note info">This is the Channel Partner module — ask an administrator for access.</div>;
  }
  return <BookingPageWrapper />;
}
