export const RAILWAY_URL = 'https://vistararealtybackend-production.up.railway.app';

let BASE_URL = process.env.NEXT_PUBLIC_API_URL || RAILWAY_URL;

export const setBaseUrl = (url) => { BASE_URL = url; };
export const getBaseUrl = () => BASE_URL;
// LOI document URL — already absolute when stored in Supabase; otherwise prefix the backend.
export const loiHref = (doc) => (!doc ? '' : (/^https?:\/\//.test(doc) ? doc : getBaseUrl() + doc));

// Standard JSON + bearer-token headers for authenticated requests. SSR-safe
// (localStorage only exists in the browser). Shared so the auth header format
// lives in one place instead of being redefined in every page/action.
export function authHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export const COMPANY_ENDPOINTS = {
  get verify() { return `${BASE_URL}/api/company/verify/`; },
  get list()   { return `${BASE_URL}/api/company/all/`; },
  detail: (id) => `${BASE_URL}/api/company/${id}/`,
};

export const AUTH_ENDPOINTS = {
  get login()   { return `${BASE_URL}/api/auth/login/`; },
  get me()      { return `${BASE_URL}/api/auth/me/`; },
  get refresh() { return `${BASE_URL}/api/auth/token/refresh/`; },
  get notifications()        { return `${BASE_URL}/api/auth/notifications/`; },
  get notificationsReadAll() { return `${BASE_URL}/api/auth/notifications/read/`; },
  notificationRead: (id)     => `${BASE_URL}/api/auth/notifications/${id}/read/`,
};

export const USER_ENDPOINTS = {
  get list()   { return `${BASE_URL}/api/auth/users/`; },
  detail: (id) => `${BASE_URL}/api/auth/users/${id}/`,
};

export const SALES_ENDPOINTS = {
  get stats()      { return `${BASE_URL}/api/sales/stats/`; },
  get leads()      { return `${BASE_URL}/api/sales/leads/`; },
  get bulkDelete() { return `${BASE_URL}/api/sales/leads/bulk-delete/`; },
  lead: (id)       => `${BASE_URL}/api/sales/leads/${id}/`,
  get projects()   { return `${BASE_URL}/api/sales/projects/`; },
  project: (id)    => `${BASE_URL}/api/sales/projects/${id}/`,
  get sources()    { return `${BASE_URL}/api/sales/sources/`; },
  get followUps()  { return `${BASE_URL}/api/sales/follow-ups/`; },
  followUp: (id)   => `${BASE_URL}/api/sales/follow-ups/${id}/`,
  get siteVisits() { return `${BASE_URL}/api/sales/site-visits/`; },
  siteVisit: (id)  => `${BASE_URL}/api/sales/site-visits/${id}/`,
  get closures()   { return `${BASE_URL}/api/sales/closures/`; },
  closureCancel: (id) => `${BASE_URL}/api/sales/closures/${id}/cancel/`,
  get bookings()   { return `${BASE_URL}/api/sales/bookings/`; },
  bookingLoiUrl: (id) => `${BASE_URL}/api/sales/bookings/${id}/loi-url/`,
  get telecallers(){ return `${BASE_URL}/api/sales/users/telecallers/?crm_role=telecaller`; },
  get stms()       { return `${BASE_URL}/api/sales/users/telecallers/?crm_role=stm`; },
  get cps()        { return `${BASE_URL}/api/sales/users/telecallers/?crm_role=cp`; },
  get usersSlim()  { return `${BASE_URL}/api/sales/users/slim/`; },
  get team()       { return `${BASE_URL}/api/sales/team/`; },
  teamMember: (id) => `${BASE_URL}/api/sales/team/${id}/`,
  get distribute() { return `${BASE_URL}/api/sales/distribute/`; },
  get distLog()    { return `${BASE_URL}/api/sales/distribution-log/`; },
  get import_()      { return `${BASE_URL}/api/sales/leads/import/`; },
  get reports()      { return `${BASE_URL}/api/sales/reports/`; },
  get myTeam()       { return `${BASE_URL}/api/sales/my-team/`; },
  get distSettings() { return `${BASE_URL}/api/sales/dist-settings/`; },
  get availability() { return `${BASE_URL}/api/sales/availability/`; },
  get availabilityMe() { return `${BASE_URL}/api/sales/availability/me/`; },
  get distWeight()   { return `${BASE_URL}/api/sales/dist-weight/`; },
  get plots()           { return `${BASE_URL}/api/sales/plots/`; },
  get plotsBulk()       { return `${BASE_URL}/api/sales/plots/bulk/`; },
  get plotsBulkDelete() { return `${BASE_URL}/api/sales/plots/bulk-delete/`; },
  get plotsRenameType() { return `${BASE_URL}/api/sales/plots/rename-type/`; },
  plot: (id)            => `${BASE_URL}/api/sales/plots/${id}/`,
  get metaWebhook()      { return `${BASE_URL}/api/sales/webhooks/meta/`; },
  get metaWebhookConfig(){ return `${BASE_URL}/api/sales/webhooks/meta/config/`; },
  get metaMappings()     { return `${BASE_URL}/api/sales/webhooks/meta/mappings/`; },
  get userProjects()     { return `${BASE_URL}/api/sales/user-projects/`; },
  get mediaUpload()      { return `${BASE_URL}/api/sales/media/upload/`; },
  get mediaDelete()      { return `${BASE_URL}/api/sales/media/delete/`; },
  get dataReset()        { return `${BASE_URL}/api/sales/admin/reset-trial-data/`; },
};
