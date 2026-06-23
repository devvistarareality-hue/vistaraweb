'use client';
import OrgChartView from '../../../components/OrgChartView';
// Full company org chart — reachable from User Management.
export default function CompanyOrgChartPage() {
  return <OrgChartView scope="all" title="Company Org Chart" />;
}
