'use client';
import OrgChartView from '../../../../components/OrgChartView';

// Channel Partner "My Team": CP managers see their own reporting subtree; admins
// see the CP org chart. Scoped by CP designation rather than by module — CP staff
// sit in the Sales module, so there is no "Channel Partner" module to ask for.
export default function CpMyTeamPage() {
  return <OrgChartView cp title="My Team" />;
}
