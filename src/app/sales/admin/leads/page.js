'use client';
import { SalesLeadsContent } from '../../leads/page';

// Admin-section mirror of All Leads — full company data, for a Sales Admin-Modules
// user (see backend/sales/views.py::_sees_all_company / admin_view=1).
export default function AdminLeadsPage() {
  return <SalesLeadsContent adminView />;
}
