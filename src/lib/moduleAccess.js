// Module-scoped admin access. A "module admin" (e.g. a Sales Admin) is a user with
// role='Admin' who is NOT a platform super-admin and whose `modules` list is a
// restricted subset. They are boxed into their module(s): they land on their module,
// only see their module tiles, and are redirected away from anything outside it.
//
// Platform super-admins (Django staff, or the VRL company Admin — e.g. admin001/002)
// are unaffected and keep full ERP access. Regular employees are also unaffected;
// the guards only redirect restricted module admins.

export const ALL_MODULES = ['Sales', 'HR', 'Accounts & Finance', 'Execution', 'Purchase', 'Land', 'Club 1000'];

export const MODULE_ROUTES = {
  'Sales':              '/sales',
  'HR':                 '/m/hr',
  'Accounts & Finance': '/m/accounts',
  'Execution':          '/m/execution',
  'Purchase':           '/m/purchase',
  'Land':               '/m/land',
  'Club 1000':          '/club1000',
};

// /m/[module] slug → module display name
export const SLUG_TO_MODULE = {
  hr: 'HR', accounts: 'Accounts & Finance', execution: 'Execution', purchase: 'Purchase', land: 'Land',
};

// A departmental / module admin = role='Admin' restricted to exactly ONE module
// (e.g. a Sales Admin). This holds even inside the VRL company.
export function isModuleAdminUser(user) {
  return !!(user && user.role === 'Admin' && !user.is_staff && ((user.modules || []).length === 1));
}

export function isSuperAdmin(user) {
  if (!user) return false;
  if (user.is_staff) return true;
  // VRL company Admin is a platform super-admin UNLESS restricted to a single module.
  if (user.company_code === 'VRL' && user.role === 'Admin') return !isModuleAdminUser(user);
  return false;
}

export function moduleAccess(user) {
  const superAdmin = isSuperAdmin(user);
  const mods = (user && user.modules) || [];
  const isModuleAdmin = isModuleAdminUser(user) && !superAdmin;
  const allowed = superAdmin ? ALL_MODULES : mods;
  // Where this user should land: super/full-admin → launcher; single-module admin → that module.
  let home = '/admin';
  if (isModuleAdmin && MODULE_ROUTES[mods[0]]) home = MODULE_ROUTES[mods[0]];
  return { superAdmin, isModuleAdmin, allowed, home };
}

// True if the user may access a module (by display name). Only restricted module
// admins are limited; everyone else passes through (super-admins, regular employees).
export function canAccessModule(user, moduleName) {
  const { superAdmin, isModuleAdmin, allowed } = moduleAccess(user);
  if (superAdmin || !isModuleAdmin) return true;
  return allowed.includes(moduleName);
}

// Club 1000 manager-level access: platform admins, company Admins, or anyone
// explicitly granted Club 1000 in their manager_modules. Mirrors
// backend/club1000/permissions.py::is_club1000_manager exactly — keep in sync.
export function isClub1000Manager(user) {
  if (!user) return false;
  return !!(
    user.is_staff || isSuperAdmin(user) || user.role === 'Admin'
    || (user.manager_modules || []).includes('Club 1000')
    || (user.admin_modules || []).includes('Club 1000')
  );
}

// Any Club 1000 access at all: manager-level, or plain module access.
export function hasClub1000Access(user) {
  if (!user) return false;
  return isClub1000Manager(user) || (user.modules || []).includes('Club 1000');
}

// ── Staff hierarchy ───────────────────────────────────────────────────────────
// Seniority order, most senior first. Everything down to Manager carries manager
// authority, so a Director is never able to do less than a Manager reporting to
// them. Mirrors MANAGER_ROLES in the backend — keep the two in step.
// Kiosk is not a rank: it is the unattended self-booking account.
export const ROLE_HIERARCHY = ['Director', 'General Manager', 'Manager', 'Employee', 'Intern'];
export const MANAGER_ROLES = ['Director', 'General Manager', 'Manager'];

/** Manager or more senior (not Admin/staff — check those separately). */
export function isManagerRole(user) {
  return MANAGER_ROLES.includes(user?.role);
}

// ── Channel Partner module ─────────────────────────────────────────────────────
// A Manager whose designation starts with "cp" (e.g. "CP Cluster Head") gets into
// the Channel Partner module ONLY — not the rest of Sales. Mirrors
// backend/sales/views.py::is_cp_manager exactly — keep in sync.
export function isCpManager(user) {
  return !!(user && user.role === 'Manager' && (user.designation || '').toLowerCase().trim().startsWith('cp'));
}

// Who can reach the Channel Partner module at all: the same admins who reach
// every other admin-only Sales page, plus a CP-designation Manager (scoped to
// their assigned projects once inside). Mirrors backend's
// _is_sales_admin(user) or is_cp_manager(user) — keep in sync.
export function canAccessChannelPartner(user) {
  return !!(user && (user.is_staff || user.role === 'Admin' || (user.admin_modules || []).includes('Sales') || isCpManager(user)));
}
