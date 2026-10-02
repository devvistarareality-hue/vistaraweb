'use client';
import { useSelector } from 'react-redux';
import { groupsFor } from '../../../../lib/moduleGroups';
import { DepartmentPage } from '../../../../components/Departments';

// A department (Sales, Accounts & Finance, HR…) and the parts of it this person can open.
export default function DepartmentRoute({ params }) {
  const user = useSelector((s) => s.auth.user);
  if (!user) return null;
  const group = groupsFor(user).find((g) => g.key === params.group);
  return <DepartmentPage group={group} backHref="/admin" backLabel="Back to Admin" />;
}
