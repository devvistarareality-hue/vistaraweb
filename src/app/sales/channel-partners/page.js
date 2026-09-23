'use client';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner, dashboardFor } from '../../../lib/moduleAccess';
import DashboardRoleFilter from '../../../components/DashboardRoleFilter';
import { AdminDashboard, STMDashboard } from '../page';

// The partner desk's dashboards, one per role level. The filter switches between
// them for an admin; Designation Master → Permissions pins the one a designation
// opens. Every view here is scoped to partner-sourced records.
export const CP_DASHBOARDS = [
  { key: 'cp_exec', role: 'Employee', label: 'CP Executive' },
  { key: 'cp_manager', role: 'Manager', label: 'CP Manager' },
  { key: 'cp_gm', role: 'General Manager', label: 'General Manager' },
  { key: 'cp_director', role: 'Director', label: 'Director' },
];

// A CP designation can be pinned to a Sales dashboard too — "give the CP Cluster
// Head the Manager dashboard" — so those keys map onto the partner-scoped view
// of the same thing. Without this the pin looked ignored.
const SAME_AS = {
  manager: 'cp_manager', gm: 'cp_gm', director: 'cp_director',
  stm: 'cp_exec', telecaller: 'cp_exec',
};

export default function ChannelPartnersPage() {
  const user = useSelector((s) => s.auth.user);
  const isAdmin = user?.role === 'Admin' || user?.is_staff;
  const [preview, setPreview] = useState('');

  if (!canAccessChannelPartner(user)) {
    return <div className="nx-note info">Admin access only.</div>;
  }

  const pinned = dashboardFor(user, 'Channel Partner');
  const chosen = preview || SAME_AS[pinned] || pinned;
  // The executive view is their own pipeline; the rest are the desk, and only a
  // Director's is company-wide. The backend scopes every figure either way.
  const body = chosen === 'cp_exec'
    ? <STMDashboard user={user} cpOnly />
    : <AdminDashboard user={user} cpOnly adminView={chosen === 'cp_director'} />;

  if (!isAdmin) return body;
  return (
    <>
      <DashboardRoleFilter options={CP_DASHBOARDS} value={chosen} onChange={setPreview} module="Channel Partner" />
      {body}
    </>
  );
}
