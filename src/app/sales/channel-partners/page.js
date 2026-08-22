'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../lib/moduleAccess';

export default function ChannelPartnersPage() {
  const user = useSelector((s) => s.auth.user);

  if (!canAccessChannelPartner(user)) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Admin access only.</div>;
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 680 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A2E', marginBottom: 4 }}>Channel Partner · Dashboard</h1>
      <p style={{ fontSize: 13, color: '#8492A6', marginBottom: 20 }}>
        Workflow coming soon.
      </p>
    </div>
  );
}
