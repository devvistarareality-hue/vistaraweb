'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { MyConversionsContent } from '../../my-conversions/page';
import { canSee } from '../../../../lib/moduleAccess';

// Admin-section mirror of My Conversions — full company data, for a Sales
// Admin-Modules user (see backend/sales/views.py::_sees_all_company / admin_view=1).
// The layout's menu guard doesn't cover this address, so the page checks for itself:
// an admin, a Sales module admin, or someone whose menu has My Conversions.
export default function AdminMyConversionsPage() {
  const user = useSelector((s) => s.auth.user);
  const router = useRouter();
  const allowed = !!user && (user.role === 'Admin' || user.is_staff
    || (user.admin_modules || []).includes('Sales') || canSee(user, 'sales.screen.conversions'));
  useEffect(() => { if (user && !allowed) router.replace('/sales'); }, [user, allowed]);
  if (!allowed) return null;
  return <MyConversionsContent adminView />;
}
