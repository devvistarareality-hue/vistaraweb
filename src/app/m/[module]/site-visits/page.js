'use client';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { SiteVisitsContent } from '../../../sales/site-visits/page';
import { PartnerActivityPanel } from '../_PartnerActivity';
import CpTabs from '../_CpTabs';

// Two kinds of visit, behind the same CP Leads / CP Details toggle All Leads
// uses. CP Leads is the Sales module's own flow scoped to partner-referred leads
// (backend/sales/views.py::SiteVisitListView ?cp_only=true); CP Details is
// visits taken by the partners themselves, which have no lead and no
// hot/warm/cold outcome.
//
// Kept as a separate panel rather than merged into SiteVisitsContent, because
// that component is shared with the Sales module, where partner rows have no
// business appearing.
export default function ChannelPartnerSiteVisitsPage() {
  const user = useSelector((s) => s.auth.user);
  const companyId = useSelector((s) => s.adminFilter?.companyId);
  const [tab, setTab] = useState('leads');

  if (!user) return null;
  if (!canAccessChannelPartner(user)) {
    return <div className="nx-note info">This is the Channel Partner module — ask an administrator for access.</div>;
  }

  return (
    <>
      <CpTabs value={tab} onChange={setTab} />
      {tab === 'leads'
        ? <SiteVisitsContent adminView cpOnly />
        : <PartnerActivityPanel kind="sv" companyId={companyId} />}
    </>
  );
}
