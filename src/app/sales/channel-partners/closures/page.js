'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { MyConversionsContent } from '../../my-conversions/page';

// Same Site Visits/Closures history as the main Sales module's My Conversions,
// scoped to leads referred by a channel partner (?cp_only=true).
export default function ChannelPartnerClosuresPage() {
  const user = useSelector((s) => s.auth.user);
  if (!canAccessChannelPartner(user)) {
    return <div style={{ padding: 40, color: '#8492A6' }}>Admin access only.</div>;
  }

  return <MyConversionsContent adminView cpOnly />;
}
