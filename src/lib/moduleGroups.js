// Departments: how the modules are grouped on the home screen and in the sidebar.
//
// Underneath, every module stays exactly what it was — 'AR', 'Accounts & Finance',
// 'Task Allocation' keep their own access in User Management, their own menus,
// permissions and data. This file only decides presentation: the home screen shows
// a handful of departments instead of every module, and a new module (Accounts
// Payable, say) becomes one more part inside a department rather than one more tile.
// The app keeps an identical copy (Vistarafront/src/lib/moduleGroups.js).
import { moduleAccess, canAccessChannelPartner } from './moduleAccess';

const hasAny = (mods, list) => list.some((m) => mods.includes(m));

export const GROUPS = [
  {
    key: 'admin', title: 'Administration', icon: 'shield', tone: 'blue', adminOnly: true,
    desc: 'Users, companies, designations, backup and the activity log',
    parts: [
      { key: 'users', title: 'User Management', desc: 'Employees, roles and module access', href: '/admin/users', icon: 'users' },
      { key: 'companies', title: 'Company Management', desc: 'Workspaces, settings and company data', href: '/admin/companies', icon: 'building' },
      { key: 'designations', title: 'Designation Master', desc: 'Designations, menus and permissions', href: '/admin/designations', icon: 'tag' },
      { key: 'backup', title: 'Data Backup & Reset', desc: 'Excel snapshots, automatic backups, restore', href: '/admin/data-backup', icon: 'backup' },
      { key: 'activity', title: 'Activity Log', desc: 'Who changed what, and when', href: '/admin/activity', icon: 'clock' },
    ],
  },
  {
    key: 'sales', title: 'Sales', icon: 'trending', tone: 'peach',
    desc: 'Leads, site visits, bookings and channel partners',
    parts: [
      { key: 'sales', module: 'Sales', title: 'Sales CRM', desc: 'Leads, follow-ups, site visits and bookings', href: '/sales', icon: 'trending' },
      { key: 'cp', module: 'Channel Partner', title: 'Channel Partner', desc: 'Partner-sourced leads, visits and bookings', href: '/m/cp/dashboard', icon: 'handshake' },
    ],
  },
  {
    key: 'finance', title: 'Accounts & Finance', icon: 'wallet', tone: 'green',
    desc: 'Booking approvals, receivables and banks — payables next',
    parts: [
      { key: 'accounts', module: 'Accounts & Finance', title: 'Approvals & Bookings', desc: 'Sign off bookings and the bookings ledger', href: '/m/accounts', icon: 'wallet' },
      { key: 'ar', module: 'AR', title: 'Accounts Receivable', desc: 'Collections, dues, ageing, cancellations', href: '/m/ar/dashboard', icon: 'coins' },
      // Shared by Receivables now and Payables next, so it belongs to the department.
      // Opened inside whichever of the two modules the person has.
      // Its own module — ticked per person in User Management; AR users still pick a
      // bank in Record Payment, but only those ticked open Bank Master.
      { key: 'banks', module: 'Bank Master', title: 'Bank Master', desc: 'Your banks, balances and statements', icon: 'bank',
        href: (mods) => (!mods.includes('Accounts & Finance') && mods.includes('AR') ? '/m/ar/banks' : '/m/accounts/banks') },
      { key: 'ap', title: 'Accounts Payable', desc: 'Vendor bills and payments', soon: true, icon: 'receipt' },
    ],
  },
  {
    key: 'hr', title: 'HR', icon: 'people', tone: 'blue',
    desc: 'People, attendance and tasks',
    parts: [
      { key: 'hr', module: 'HR', title: 'People & Attendance', desc: 'People, org chart, attendance and leave', href: '/m/hr', icon: 'people' },
      { key: 'execution', module: 'Task Allocation', title: 'Task Allocation', desc: 'Assign, track and close out tasks across every team', href: '/m/execution/dashboard', icon: 'checklist' },
    ],
  },
  { key: 'purchase', title: 'Purchase', icon: 'cart', tone: 'peach', desc: 'Vendors and purchase orders',
    parts: [{ key: 'purchase', module: 'Purchase', title: 'Purchase', desc: 'Vendors and purchase orders', href: '/m/purchase', icon: 'cart' }] },
  { key: 'land', title: 'Land', icon: 'map', tone: 'blue', desc: 'Land parcels and site portfolio',
    parts: [{ key: 'land', module: 'Land', title: 'Land', desc: 'Land parcels and site portfolio', href: '/m/land', icon: 'map' }] },
  { key: 'club1000', title: 'Club 1000', icon: 'coins', tone: 'green', desc: 'Investors, schemes and payouts',
    parts: [{ key: 'club1000', module: 'Club 1000', title: 'Club 1000', desc: 'Investors, schemes and payouts', href: '/club1000', icon: 'coins' }] },
];


// The modules this person can open. Admin side: a full admin sees every module
// (as the admin home always did); a module admin only theirs. Employee side: their
// assigned modules, plus Channel Partner when their designation gives it.
export function modulesFor(user) {
  const { superAdmin, isModuleAdmin, allowed } = moduleAccess(user);
  const isAdmin = user?.role === 'Admin' || user?.is_staff;
  if (isAdmin && (superAdmin || !isModuleAdmin)) {
    return GROUPS.flatMap((g) => g.parts.map((p) => p.module)).filter(Boolean);
  }
  const mods = [...(isAdmin ? allowed : (user?.modules || []))];
  if (!mods.includes('Channel Partner') && canAccessChannelPartner(user)) mods.push('Channel Partner');
  return mods;
}

const partHref = (p, mods) => (typeof p.href === 'function' ? p.href(mods) : p.href);

// Departments with the parts this person may open (coming-soon parts are kept for
// show, never counted as something to open).
export function groupsFor(user) {
  const mods = modulesFor(user);
  const { superAdmin, isModuleAdmin } = moduleAccess(user);
  const fullAdmin = (user?.role === 'Admin' || user?.is_staff) && (superAdmin || !isModuleAdmin);
  return GROUPS.map((g) => {
    const parts = g.parts
      .filter((p) => (g.adminOnly ? fullAdmin : p.soon || (p.module ? mods.includes(p.module) : hasAny(mods, p.anyOf || []))))
      .map((p) => ({ ...p, href: p.soon ? null : partHref(p, mods) }));
    const open = parts.filter((p) => !p.soon);
    // `modules`: the real modules among them — what decides whether a department
    // has one thing to open or several.
    return { ...g, parts, open, modules: g.adminOnly ? open : open.filter((p) => p.module) };
  }).filter((g) => g.open.length);
}

// Where a department tile goes: straight into its only part, or to its page.
export function groupHref(g, base) {
  return g.modules.length === 1 ? g.modules[0].href : `${base}/g/${g.key}`;
}

// The department a module slug (/m/<slug>) or path belongs to, for the sidebar switcher.
const SLUG_PART = { accounts: 'accounts', ar: 'ar', cp: 'cp', hr: 'hr', execution: 'execution', purchase: 'purchase', land: 'land' };
export function groupOfSlug(user, slug) {
  const key = SLUG_PART[slug];
  if (!key) return null;
  return groupsFor(user).find((g) => g.parts.some((p) => p.key === key)) || null;
}
