'use client';
// Admin-section mirror of Booking — same component, reused directly under a
// distinct URL so it doesn't collide with the normal menu's /sales/closure link
// (both would otherwise share one href, confusing the Admin-section detection in
// sales/layout.js). Data here is already company-wide regardless of route —
// projects/plots aren't scoped by reporting hierarchy — so no admin_view flag needed.
export { default } from '../../closure/page';
