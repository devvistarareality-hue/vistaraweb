'use client';
import { SiteVisitsContent } from '../../site-visits/page';

// Admin-section mirror of Site Visits — full company data, for a Sales Admin-Modules
// user (see backend/sales/views.py::_sees_all_company / admin_view=1).
export default function AdminSiteVisitsPage() {
  return <SiteVisitsContent adminView />;
}
