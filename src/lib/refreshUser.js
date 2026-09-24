import { AUTH_ENDPOINTS } from '../constants/api';
import { LOGIN_SUCCESS } from '../redux/types/authTypes';
import { clearAllCache } from '../app/sales/_cache';

// The signed-in person's permissions are decided by their designation, which an
// admin can change while they are working. The stored copy is written at login,
// so without this they would keep the old menu until they signed out and in
// again. Every session check already asks the server who they are — this takes
// the answer and puts it back into Redux and localStorage.
//
// Only the fields the server owns are replaced; the token and anything the
// client added stay as they were.
// The fields that decide what a person may see. A change to any of them makes
// every cached list suspect.
const PERMISSION_FIELDS = ['capabilities', 'screens', 'screen_modules', 'dashboard', 'role_dashboards',
                           'modules', 'manager_modules', 'admin_modules', 'role', 'designation'];

function permissionsChanged(before, after) {
  return PERMISSION_FIELDS.some((f) => JSON.stringify(before?.[f]) !== JSON.stringify(after?.[f]));
}

export async function refreshUser(dispatch, res) {
  try {
    const r = res || await fetch(AUTH_ENDPOINTS.me, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    });
    if (!r || !r.ok) return null;
    const fresh = await r.json();
    if (!fresh || !fresh.id) return null;
    const storedRaw = localStorage.getItem('user') || '{}';
    const stored = JSON.parse(storedRaw);
    const merged = { ...stored, ...fresh };
    const mergedRaw = JSON.stringify(merged);
    // Nothing changed — and this runs every 30 seconds, so handing Redux a new
    // object each time would re-render every screen that reads the user and
    // re-run its fetches.
    if (mergedRaw === JSON.stringify(stored)) return stored;
    localStorage.setItem('user', mergedRaw);
    // Their permissions may have just changed: everything cached in this browser
    // was worked out under the old ones, so it goes.
    if (permissionsChanged(stored, merged)) clearAllCache();
    dispatch({ type: LOGIN_SUCCESS, payload: merged });
    return merged;
  } catch {
    return null;
  }
}

export default refreshUser;
