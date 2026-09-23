'use client';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { isClub1000Manager, dashboardFor } from '../../lib/moduleAccess';
import DashboardRoleFilter from '../../components/DashboardRoleFilter';
import ManagerDashboard from './_ManagerDashboard';
import EmployeeDashboard from './_EmployeeDashboard';

// Club 1000's two dashboards, by role level.
export const CLUB_DASHBOARDS = [
  { key: 'club_exec', role: 'Employee', label: 'Executive' },
  { key: 'club_manager', role: 'Manager', label: 'Manager' },
];

export default function Club1000Dashboard() {
  const user = useSelector((s) => s.auth.user);
  const isAdmin = user?.role === 'Admin' || user?.is_staff;
  const [preview, setPreview] = useState('');
  if (!user) return null;

  const chosen = preview || dashboardFor(user);
  const body = chosen === 'club_manager' ? <ManagerDashboard />
    : chosen === 'club_exec' ? <EmployeeDashboard />
      // Nothing pinned: the old rule — managers get the desk view.
      : isClub1000Manager(user) ? <ManagerDashboard /> : <EmployeeDashboard />;

  if (!isAdmin) return body;
  return (
    <>
      <DashboardRoleFilter options={CLUB_DASHBOARDS} value={chosen} onChange={setPreview} />
      {body}
    </>
  );
}
