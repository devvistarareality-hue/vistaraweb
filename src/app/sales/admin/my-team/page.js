'use client';
import OrgChartView from '../../../../components/OrgChartView';

// Admin-section mirror of My Team — full company org, for a Sales Admin-Modules
// user (see backend/sales/views.py::_sees_all_company / admin_view=1).
export default function AdminMyTeamPage() {
  return <OrgChartView module="Sales" title="My Team" adminView />;
}
