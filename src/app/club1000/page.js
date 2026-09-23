'use client';
import { useSelector } from 'react-redux';
import { isClub1000Manager } from '../../lib/moduleAccess';
import { pinnedDashboard } from '../../lib/dashboards';
import ManagerDashboard from './_ManagerDashboard';
import EmployeeDashboard from './_EmployeeDashboard';

// A designation can pin which of these opens (Designation Master → Permissions →
// Dashboard). Nothing pinned keeps the old rule: managers get the desk view.
const VIEWS = { club_manager: ManagerDashboard, club_employee: EmployeeDashboard };

export default function Club1000Dashboard() {
  const user = useSelector((s) => s.auth.user);
  if (!user) return null;
  const Pinned = pinnedDashboard(user, VIEWS);
  if (Pinned) return <Pinned />;
  return isClub1000Manager(user) ? <ManagerDashboard /> : <EmployeeDashboard />;
}
