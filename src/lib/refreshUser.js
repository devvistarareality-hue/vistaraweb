import { AUTH_ENDPOINTS } from '../constants/api';
import { LOGIN_SUCCESS } from '../redux/types/authTypes';

// The signed-in person's permissions are decided by their designation, which an
// admin can change while they are working. The stored copy is written at login,
// so without this they would keep the old menu until they signed out and in
// again. Every session check already asks the server who they are — this takes
// the answer and puts it back into Redux and localStorage.
//
// Only the fields the server owns are replaced; the token and anything the
// client added stay as they were.
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
    dispatch({ type: LOGIN_SUCCESS, payload: merged });
    return merged;
  } catch {
    return null;
  }
}

export default refreshUser;
