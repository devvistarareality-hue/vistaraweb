'use client';
import { FollowUpsContent } from '../../follow-ups/page';

// Admin-section mirror of Follow-Ups — full company data, for a Sales Admin-Modules
// user (see backend/sales/views.py::_sees_all_company / admin_view=1).
export default function AdminFollowUpsPage() {
  return <FollowUpsContent adminView />;
}
