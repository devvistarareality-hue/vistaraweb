import { COMPANY_ENDPOINTS, authHeaders } from '../../constants/api';
import { setAdminCompany } from '../reducers/adminFilterReducer';
import {
  COMPANIES_FETCH_REQUEST, COMPANIES_FETCH_SUCCESS, COMPANIES_FETCH_FAILURE,
  COMPANY_UPDATE_REQUEST, COMPANY_UPDATE_SUCCESS, COMPANY_UPDATE_FAILURE, COMPANY_UPDATE_RESET,
  COMPANY_CREATE_REQUEST, COMPANY_CREATE_SUCCESS, COMPANY_CREATE_FAILURE, COMPANY_CREATE_RESET,
  COMPANY_DELETE_SUCCESS,
} from '../types/companiesTypes';


const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// A saved "Viewing company" that is not in the company list (deleted, or saved in
// this browser against a different database) filtered every page down to nothing:
// AR read ₹0 with only a "Filtered" badge to hint why. Once the real list is in,
// such a choice is dropped back to All Companies.
export const dropMissingAdminCompany = () => (dispatch, getState) => {
  const { companyId } = getState().adminFilter || {};
  const list = getState().companies?.companies;
  if (companyId == null || !Array.isArray(list) || !list.length) return;
  if (!list.some((c) => String(c.id) === String(companyId))) dispatch(setAdminCompany(null));
};

export const fetchCompanies = (force = false) => async (dispatch, getState) => {
  const { lastFetched, companies } = getState().companies;
  if (!force && lastFetched && companies.length > 0 && Date.now() - lastFetched < CACHE_TTL) return;
  dispatch({ type: COMPANIES_FETCH_REQUEST });
  try {
    const res  = await fetch(COMPANY_ENDPOINTS.list, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok) {
      dispatch({ type: COMPANIES_FETCH_SUCCESS, payload: data });
      dispatch(dropMissingAdminCompany());
    } else {
      dispatch({ type: COMPANIES_FETCH_FAILURE, payload: data.detail || 'Failed to load companies.' });
    }
  } catch {
    dispatch({ type: COMPANIES_FETCH_FAILURE, payload: 'Network error.' });
  }
};

export const updateCompany = (id, payload) => async (dispatch) => {
  dispatch({ type: COMPANY_UPDATE_REQUEST });
  try {
    const res  = await fetch(COMPANY_ENDPOINTS.detail(id), {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      dispatch({ type: COMPANY_UPDATE_SUCCESS, payload: data });
    } else {
      const msg = data.code?.[0] || data.detail || JSON.stringify(data);
      dispatch({ type: COMPANY_UPDATE_FAILURE, payload: msg });
    }
  } catch {
    dispatch({ type: COMPANY_UPDATE_FAILURE, payload: 'Network error.' });
  }
};

export const resetUpdateCompany = () => ({ type: COMPANY_UPDATE_RESET });

export const createCompany = (payload) => async (dispatch) => {
  dispatch({ type: COMPANY_CREATE_REQUEST });
  try {
    const res  = await fetch(COMPANY_ENDPOINTS.list, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      dispatch({ type: COMPANY_CREATE_SUCCESS, payload: data });
      dispatch(fetchCompanies());
    } else {
      const msg = data.code?.[0] || data.detail || JSON.stringify(data);
      dispatch({ type: COMPANY_CREATE_FAILURE, payload: msg });
    }
  } catch {
    dispatch({ type: COMPANY_CREATE_FAILURE, payload: 'Network error.' });
  }
};

export const resetCreateCompany = () => ({ type: COMPANY_CREATE_RESET });

export const deleteCompany = (id) => async (dispatch) => {
  try {
    const res = await fetch(COMPANY_ENDPOINTS.detail(id), { method: 'DELETE', headers: authHeaders() });
    if (res.ok || res.status === 204) {
      dispatch({ type: COMPANY_DELETE_SUCCESS, payload: id });
    }
  } catch {
    // silently ignore — list will re-sync on next poll
  }
};
