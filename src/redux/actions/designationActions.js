const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const DESIGNATION_ENDPOINTS = {
  list:   `${BASE_URL}/api/auth/designations/`,
  detail: (id) => `${BASE_URL}/api/auth/designations/${id}/`,
};

const authHeaders = () => {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
};

export const DESIG_FETCH_SUCCESS  = 'DESIG_FETCH_SUCCESS';
export const DESIG_CREATE_SUCCESS = 'DESIG_CREATE_SUCCESS';
export const DESIG_DELETE_SUCCESS = 'DESIG_DELETE_SUCCESS';
export const DESIG_ERROR          = 'DESIG_ERROR';

export const fetchDesignations = () => async (dispatch) => {
  try {
    const res  = await fetch(DESIGNATION_ENDPOINTS.list, { headers: authHeaders() });
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
