'use client';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner } from '../../../../lib/moduleAccess';
import { MyConversionsContent } from '../../../sales/my-conversions/page';

// Same Site Visits/Closures history as the main Sales module's My Conversions,
// scoped to leads referred by a channel partner (?cp_only=true).
export default function ChannelPartnerClosuresPage() {
  const user = useSelector((s) => s.auth.user);
  if (!user) return null;
  if (!canAccessChannelPartner(user)) {
    return <div className="nx-note info">This is the Channel Partner module — ask an administrator for access.</div>;
  }

  return <MyConversionsContent adminView cpOnly />;
}
