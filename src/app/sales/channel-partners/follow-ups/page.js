'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { FollowUpsContent } from '../../follow-ups/page';

// Same Follow-Ups flow as the main Sales module, scoped to leads referred by a
// channel partner (see backend/sales/views.py::FollowUpListView ?cp_only=true).
export default function ChannelPartnerFollowUpsPage() {
  const user = useSelector((s) => s.auth.user);
  if (!canAccessChannelPartner(user)) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Admin access only.</div>;
  }

  return <FollowUpsContent adminView cpOnly />;
}
