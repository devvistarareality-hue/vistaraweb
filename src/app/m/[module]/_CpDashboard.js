'use client';
import { AdminDashboard, STMDashboard } from '../../sales/page';

// The partner desk's dashboard. Every view here is scoped to partner-sourced
// records; which one opens is the designation's pin or the role filter above.
// A Sales dashboard pinned to a CP designation maps onto the partner view of
// the same thing, so the pin is never ignored.
const SAME_AS = {
  manager: 'cp_manager', gm: 'cp_gm', director: 'cp_director',
  stm: 'cp_exec', telecaller: 'cp_exec',
};

export default function ChannelPartnerDashboard({ chosen, user }) {
  const view = SAME_AS[chosen] || chosen;
  if (view === 'cp_exec') return <STMDashboard user={user} cpOnly />;
  return <AdminDashboard user={user} cpOnly adminView={view === 'cp_director'} />;
}
