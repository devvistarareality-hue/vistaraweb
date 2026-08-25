'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { SiteVisitsContent } from '../../site-visits/page';

// Same Site Visits flow as the main Sales module, scoped to leads referred by a
// channel partner (see backend/sales/views.py::SiteVisitListView ?cp_only=true).
export default function ChannelPartnerSiteVisitsPage() {
  const user = useSelector((s) => s.auth.user);
  if (!canAccessChannelPartner(user)) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Admin access only.</div>;
  }

  return <SiteVisitsContent adminView cpOnly />;
}
