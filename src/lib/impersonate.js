/**
 * Viewing the app as another user, for a platform admin.
 *
 * The admin's own tokens are set aside under `admin_*` keys rather than thrown
 * away, so "Exit" is a local swap back — no second login, and no way to get
 * stranded in someone else's account if the network drops mid-exit.
 */
import { AUTH_ENDPOINTS } from '../constants/api';
import { apiFetch } from '../utils/apiFetch';
import { clearAllCache } from '../app/sales/_cache';

const OWN = ['access_token', 'refresh_token', 'user', 'company'];
const key = (k) => `admin_${k}`;

/** The admin behind the current session, or null when this is an ordinary one. */
export function impersonating() {
  try { return JSON.parse(localStorage.getItem('impersonated_by') || 'null'); }
  catch { return null; }
}

export async function startImpersonation(userId) {
  const res = await apiFetch(AUTH_ENDPOINTS.impersonate, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, platform: 'web' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Could not open that user’s view.');

  // Stash the admin's own session before overwriting it.
  OWN.forEach((k) => {
    const v = localStorage.getItem(k);
    if (v !== null) localStorage.setItem(key(k), v); else localStorage.removeItem(key(k));
  });

  // sc_* entries are keyed by company, not by user — the admin's cached rows
  // would otherwise show up inside the impersonated view (and vice versa).
  clearAllCache();
  localStorage.setItem('access_token',  data.tokens.access);
  localStorage.setItem('refresh_token', data.tokens.refresh);
  localStorage.setItem('user',          JSON.stringify(data.user));
  if (data.user.company_code) {
    localStorage.setItem('company', JSON.stringify({
      code: data.user.company_code, name: data.user.company_name,
    }));
  }
  localStorage.setItem('impersonated_by', JSON.stringify(data.impersonated_by));
  return data;
}

/** Put the admin back in their own account. */
export function stopImpersonation() {
  clearAllCache();
  OWN.forEach((k) => {
    const v = localStorage.getItem(key(k));
    if (v !== null) localStorage.setItem(k, v); else localStorage.removeItem(k);
    localStorage.removeItem(key(k));
  });
  localStorage.removeItem('impersonated_by');
}
