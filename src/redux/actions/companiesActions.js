import { COMPANY_ENDPOINTS } from '../../constants/api';
import {
  COMPANIES_FETCH_REQUEST, COMPANIES_FETCH_SUCCESS, COMPANIES_FETCH_FAILURE,
  COMPANY_UPDATE_REQUEST, COMPANY_UPDATE_SUCCESS, COMPANY_UPDATE_FAILURE, COMPANY_UPDATE_RESET,
  COMPANY_CREATE_REQUEST, COMPANY_CREATE_SUCCESS, COMPANY_CREATE_FAILURE, COMPANY_CREATE_RESET,
  COMPANY_DELETE_SUCCESS,
} from '../types/companiesTypes';

const authHeaders = () => {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
};

export const fetchCompanies = () => async (dispatch) => {
  dispatch({ type: COMPANIES_FETCH_REQUEST });
  try {
    const res  = await fetch(COMPANY_ENDPOINTS.list, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok) {
      dispatch({ type: COMPANIES_FETCH_SUCCESS, payload: data });
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
