// Who may sit at the top of the reporting tree: leadership, and the unattended
// kiosk account, which belongs to no one by design. Mirrors TOP_LEVEL_ROLES in
// backend/accounts/serializers.py — keep the two in step.
export const TOP_LEVEL_ROLES = ['Admin', 'Director', 'General Manager', 'Manager', 'Kiosk'];

// Visibility runs on the reporting tree, so anyone below leadership with no manager
// is invisible to every manager in the company. It happened: an STM with 78 bookings
// reached no manager's list at all, and the same figure read 67 in one module and 65
// in another because only the CP pool reaches past the hierarchy.
export function needsReportingManager(role) {
  return !TOP_LEVEL_ROLES.includes(role || '');
}
