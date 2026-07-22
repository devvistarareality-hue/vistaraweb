'use client';
import { BookingsContent } from '../../bookings/page';

// Admin-section mirror of Approvals — full company data, for a Sales Admin-Modules
// user (see backend/sales/views.py::_sees_all_company / admin_view=1).
export default function AdminBookingsPage() {
  return <BookingsContent adminView />;
}
