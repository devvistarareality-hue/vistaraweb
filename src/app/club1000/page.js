'use client';
import { useSelector } from 'react-redux';
import { isClub1000Manager } from '../../lib/moduleAccess';
import ManagerDashboard from './_ManagerDashboard';
import EmployeeDashboard from './_EmployeeDashboard';

export default function Club1000Dashboard() {
  const user = useSelector((s) => s.auth.user);
  if (!user) return null;
  return isClub1000Manager(user) ? <ManagerDashboard /> : <EmployeeDashboard />;
}
