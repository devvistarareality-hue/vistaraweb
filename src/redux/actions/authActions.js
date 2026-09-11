import { COMPANY_ENDPOINTS, AUTH_ENDPOINTS, SALES_ENDPOINTS, authHeaders } from '../../constants/api';
import { setCache, clearAllCache } from '../../app/sales/_cache';
import {
  COMPANY_VERIFY_REQUEST, COMPANY_VERIFY_SUCCESS, COMPANY_VERIFY_FAILURE,
  LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, CLEAR_COMPANY,
} from '../types/authTypes';

// localStorage replaces AsyncStorage — synchronous, no await needed

export const verifyCompany = (companyCode) => async (dispatch) => {
  dispatch({ type: COMPANY_VERIFY_REQUEST });
  try {
    const res  = await fetch(COMPANY_ENDPOINTS.verify, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ company_code: companyCode }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('company', JSON.stringify(data.company));
      dispatch({ type: COMPANY_VERIFY_SUCCESS, payload: data.company });
    } else {
      dispatch({ type: COMPANY_VERIFY_FAILURE, payload: data.detail || 'Invalid company code.' });
    }
  } catch {
    dispatch({ type: COMPANY_VERIFY_FAILURE, payload: 'Network error. Check your connection.' });
  }
};

export const login = (companyCode, userCode, password) => async (dispatch) => {
  dispatch({ type: LOGIN_REQUEST });
  try {
    const res  = await fetch(AUTH_ENDPOINTS.login, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ company_code: companyCode, user_code: userCode, password, platform: 'web' }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('access_token',  data.tokens.access);
      localStorage.setItem('refresh_token', data.tokens.refresh);
      localStorage.setItem('user',          JSON.stringify(data.user));
      // Every sc_* cache entry (projects, stats, team, …) is keyed by company,
      // never by the logged-in user — without this, logging in as a second
      // person on the same browser/device (shared machine, or switching
      // accounts without a full sign-out) reused whatever the PREVIOUS
      // person's session had cached: a restricted Manager's scoped project
      // list shown to an Admin who should see everything, or worse, an
      // Admin's full data shown to someone who shouldn't see it at all.
      clearAllCache();
      dispatch({ type: LOGIN_SUCCESS, payload: data.user });
      // Prefetch sales stats in background so Sales page loads instantly
      fetch(SALES_ENDPOINTS.stats, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.tokens.access}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setCache('stats', d); })
        .catch(() => {});
    } else {
      dispatch({ type: LOGIN_FAILURE, payload: data.detail || 'Invalid credentials.' });
    }
  } catch {
    dispatch({ type: LOGIN_FAILURE, payload: 'Network error. Check your connection.' });
  }
};

export const clearCompany = () => (dispatch) => {
  localStorage.removeItem('company');
  dispatch({ type: CLEAR_COMPANY });
};

export const logout = () => (dispatch) => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('company');
  // Same reasoning as login — don't leave this session's cached data sitting
  // around for whoever logs in next on this browser/device.
  clearAllCache();
  dispatch({ type: LOGOUT });
};
