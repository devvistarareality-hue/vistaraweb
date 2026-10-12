'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { TeamUsersContent } from '../../../sales/users/page';

// The same Team Users screen the Sales module has, listing the Channel Partner
// desk instead — so a CP manager can see their own people and set their project
// assignments without going through Sales (see sales/views.py::SalesTeamView
// ?cp=1, which scopes by department).
export default function ChannelPartnerUsersPage() {
  const user = useSelector((s) => s.auth.user);
  if (!user) return null;
  if (!canAccessChannelPartner(user)) {
    return <div className="nx-note info">This is the Channel Partner module — ask an administrator for access.</div>;
  }
  return <TeamUsersContent cpOnly />;
}
