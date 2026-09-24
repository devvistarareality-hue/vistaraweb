'use client';
import { MyConversionsContent } from '../../my-conversions/page';

// Admin-section mirror of My Conversions — full company data, for a Sales
// Admin-Modules user (see backend/sales/views.py::_sees_all_company / admin_view=1).
export default function AdminMyConversionsPage() {
  return <MyConversionsContent adminView />;
}
