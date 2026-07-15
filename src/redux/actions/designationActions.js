import { authHeaders } from '../../constants/api';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const DESIGNATION_ENDPOINTS = {
  list:   `${BASE_URL}/api/auth/designations/`,
  detail: (id) => `${BASE_URL}/api/auth/designations/${id}/`,
};

export const DESIG_FETCH_SUCCESS  = 'DESIG_FETCH_SUCCESS';
export const DESIG_CREATE_SUCCESS = 'DESIG_CREATE_SUCCESS';
export const DESIG_DELETE_SUCCESS = 'DESIG_DELETE_SUCCESS';
export const DESIG_ERROR          = 'DESIG_ERROR';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes — designations rarely change

export const fetchDesignations = (force = false, companyId = null) => async (dispatch, getState) => {
  const { lastFetched, designations } = getState().designations;
  if (!force && lastFetched && designations.length > 0 && Date.now() - lastFetched < CACHE_TTL) return;
  try {
    // Platform admins pass the selected company so designations are company-specific.
    const url  = DESIGNATION_ENDPOINTS.list + (companyId ? `?company_id=${companyId}` : '');
    const res  = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok) dispatch({ type: DESIG_FETCH_SUCCESS, payload: data });
    else dispatch({ type: DESIG_ERROR, payload: data.detail || 'Failed to load designations.' });
  } catch {
    dispatch({ type: DESIG_ERROR, payload: 'Network error.' });
  }
};

export const createDesignation = (payload) => async (dispatch) => {
  try {
    const res  = await fetch(DESIGNATION_ENDPOINTS.list, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) dispatch({ type: DESIG_CREATE_SUCCESS, payload: data });
    else dispatch({ type: DESIG_ERROR, payload: data.detail || JSON.stringify(data) });
  } catch {
    dispatch({ type: DESIG_ERROR, payload: 'Network error.' });
  }
};

export const deleteDesignation = (id) => async (dispatch) => {
  try {
    await fetch(DESIGNATION_ENDPOINTS.detail(id), { method: 'DELETE', headers: authHeaders() });
    dispatch({ type: DESIG_DELETE_SUCCESS, payload: id });
  } catch {
    dispatch({ type: DESIG_ERROR, payload: 'Network error.' });
  }
};
