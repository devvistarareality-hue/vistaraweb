'use client';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { FollowUpsContent } from '../../../sales/follow-ups/page';
import { PartnerActivityPanel } from '../_PartnerActivity';
import CpTabs from '../_CpTabs';

// Two kinds of follow-up, behind the same CP Leads / CP Details toggle All Leads
// uses. CP Leads is the Sales module's own flow scoped to partner-referred leads
// (backend/sales/views.py::FollowUpListView ?cp_only=true); CP Details is calls
// with the partners themselves, which have no lead behind them.
//
// Kept as a separate panel rather than merged into FollowUpsContent, because
// that component is shared with the Sales module, where partner rows have no
// business appearing.
export default function ChannelPartnerFollowUpsPage() {
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
        ? <FollowUpsContent adminView cpOnly />
        : <PartnerActivityPanel kind="fu" companyId={companyId} />}
    </>
  );
}
