'use client';
import { SalesDashboardContent } from '../page';

// Admin-section mirror of the Sales Dashboard — full company data, for a Sales
// Admin-Modules user (see backend/sales/views.py::_sees_all_company / admin_view=1).
export default function AdminDashboardPage() {
  return <SalesDashboardContent adminView />;
}
