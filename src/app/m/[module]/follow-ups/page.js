'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { FollowUpsContent } from '../../../sales/follow-ups/page';

// Same Follow-Ups flow as the main Sales module, scoped to leads referred by a
// channel partner (see backend/sales/views.py::FollowUpListView ?cp_only=true).
export default function ChannelPartnerFollowUpsPage() {
  const user = useSelector((s) => s.auth.user);
  if (!user) return null;
  if (!canAccessChannelPartner(user)) {
    return <div className="nx-note info">This is the Channel Partner module — ask an administrator for access.</div>;
  }

  return <FollowUpsContent adminView cpOnly />;
}
