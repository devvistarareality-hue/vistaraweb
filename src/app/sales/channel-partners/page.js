'use client';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { canAccessChannelPartner, dashboardFor } from '../../../lib/moduleAccess';
import DashboardRoleFilter from '../../../components/DashboardRoleFilter';
import { AdminDashboard } from '../page';

// The partner desk's dashboards, one per role level. The filter switches between
// them for an admin; Designation Master → Permissions pins the one a designation
// opens. Every view is scoped to partner-sourced records.
export const CP_DASHBOARDS = [
  { key: 'cp_exec', role: 'Employee', label: 'CP Executive' },
  { key: 'cp_manager', role: 'Manager', label: 'CP Manager' },
  { key: 'cp_gm', role: 'General Manager', label: 'General Manager' },
  { key: 'cp_director', role: 'Director', label: 'Director' },
];

export default function ChannelPartnersPage() {
  const user = useSelector((s) => s.auth.user);
  const isAdmin = user?.role === 'Admin' || user?.is_staff;
  const [preview, setPreview] = useState('');

  if (!canAccessChannelPartner(user)) {
    return <div className="nx-note info">Admin access only.</div>;
  }

  const chosen = preview || dashboardFor(user, 'Channel Partner');
  // cp_director is the company-wide cut; the rest are the ordinary desk, which
  // the backend already scopes by role and the reporting tree.
  const body = <AdminDashboard user={user} cpOnly adminView={chosen === 'cp_director'} />;

  if (!isAdmin) return body;
  return (
    <>
      <DashboardRoleFilter options={CP_DASHBOARDS} value={chosen} onChange={setPreview} module="Channel Partner" />
      {body}
    </>
  );
}
