'use client';
// Kiosk booking: renders the exact Sales booking/LOI form, but full-screen (outside the
// /sales layout, so no ERP sidebar). The form detects the /kiosk path and returns to the
// kiosk on Back / after submit. The logged-in Kiosk user is the STM; booking is PENDING.
import BookingPageWrapper from '../../sales/booking/page';

export default function KioskBookPage() {
  return <BookingPageWrapper />;
}
