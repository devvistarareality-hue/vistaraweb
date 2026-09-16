'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../lib/moduleAccess';
import { AdminDashboard } from '../page';

export default function ChannelPartnersPage() {
  const user = useSelector((s) => s.auth.user);

  if (!canAccessChannelPartner(user)) {
    return <div style={{ padding: 40, color: '#6E7278' }}>Admin access only.</div>;
  }

  return <AdminDashboard user={user} cpOnly />;
}
