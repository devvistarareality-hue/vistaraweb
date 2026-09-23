import { dashboardFor } from './moduleAccess';

// Which dashboard a person opens is pinned on their designation (Designation
// Master → Permissions → Dashboard). A module keeps a small map of the views it
// has built, keyed by the value declared in accounts/capabilities.py → DASHBOARDS:
//
//   const VIEWS = { ar_manager: ManagerDashboard, ar_employee: OfficerDashboard };
//   const Pinned = pinnedDashboard(user, VIEWS);
//   if (Pinned) return <Pinned user={user} />;
//   …the module's current dashboard as the fallback
//
// A key with no view yet simply falls through, so an admin can pin a dashboard
// before it is written and nothing breaks. When you add one, add its key to
// DASHBOARDS_BUILT so the editor stops calling it "not built yet".
export function pinnedDashboard(user, views) {
  const key = dashboardFor(user);
  return (key && views && views[key]) || null;
}

export default pinnedDashboard;
