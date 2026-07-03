// Module-scoped admin access. A "module admin" (e.g. a Sales Admin) is a user with
// role='Admin' who is NOT a platform super-admin and whose `modules` list is a
// restricted subset. They are boxed into their module(s): they land on their module,
// only see their module tiles, and are redirected away from anything outside it.
//
// Platform super-admins (Django staff, or the VRL company Admin — e.g. admin001/002)
// are unaffected and keep full ERP access. Regular employees are also unaffected;
// the guards only redirect restricted module admins.

export const ALL_MODULES = ['Sales', 'HR', 'Accounts & Finance', 'Execution', 'Purchase', 'Land'];

export const MODULE_ROUTES = {
  'Sales':              '/sales',
  'HR':                 '/m/hr',
  'Accounts & Finance': '/m/accounts',
  'Execution':          '/m/execution',
  'Purchase':           '/m/purchase',
  'Land':               '/m/land',
};

// /m/[module] slug → module display name
export const SLUG_TO_MODULE = {
  hr: 'HR', accounts: 'Accounts & Finance', execution: 'Execution', purchase: 'Purchase', land: 'Land',
};

export function isSuperAdmin(user) {
  return !!(user && (user.is_staff || (user.company_code === 'VRL' && user.role === 'Admin')));
}

export function moduleAccess(user) {
  const superAdmin = isSuperAdmin(user);
  const mods = (user && user.modules) || [];
  // Restricted module admin: Admin, not super, with a proper subset of modules.
  const isModuleAdmin = !!(user && user.role === 'Admin' && !superAdmin
    && mods.length > 0 && mods.length < ALL_MODULES.length);
  const allowed = superAdmin ? ALL_MODULES : mods;
  // Where this user should land: super/full-admin → launcher; single-module admin → that module.
  let home = '/admin';
  if (isModuleAdmin && mods.length === 1 && MODULE_ROUTES[mods[0]]) home = MODULE_ROUTES[mods[0]];
  return { superAdmin, isModuleAdmin, allowed, home };
}

// True if the user may access a module (by display name). Only restricted module
// admins are limited; everyone else passes through (super-admins, regular employees).
export function canAccessModule(user, moduleName) {
  const { superAdmin, isModuleAdmin, allowed } = moduleAccess(user);
  if (superAdmin || !isModuleAdmin) return true;
  return allowed.includes(moduleName);
}
