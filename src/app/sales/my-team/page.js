'use client';
import OrgChartView from '../../../components/OrgChartView';

// Sales "My Team": managers see their own reporting subtree; admins see the
// Sales department org chart (scoped to the Sales module).
export default function MyTeamPage() {
  return <OrgChartView module="Sales" title="My Team" />;
}
