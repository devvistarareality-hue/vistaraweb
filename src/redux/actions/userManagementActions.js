import { USER_ENDPOINTS, authHeaders } from '../../constants/api';
import {
  USERS_FETCH_REQUEST, USERS_FETCH_SUCCESS, USERS_FETCH_FAILURE,
  USER_CREATE_REQUEST, USER_CREATE_SUCCESS, USER_CREATE_FAILURE, USER_CREATE_RESET,
  USER_UPDATE_REQUEST, USER_UPDATE_SUCCESS, USER_UPDATE_FAILURE, USER_UPDATE_RESET,
  USER_DELETE_SUCCESS,
} from '../types/userManagementTypes';


const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const fetchUsers = (force = false, companyId = null) => async (dispatch, getState) => {
  const { lastFetched, users } = getState().userManagement;
  if (!force && lastFetched && users.length > 0 && Date.now() - lastFetched < CACHE_TTL) return;
  dispatch({ type: USERS_FETCH_REQUEST });
  try {
    const url  = companyId ? `${USER_ENDPOINTS.list}?company_id=${companyId}` : USER_ENDPOINTS.list;
    const res  = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    if (res.ok) {
      dispatch({ type: USERS_FETCH_SUCCESS, payload: data });
    } else {
      dispatch({ type: USERS_FETCH_FAILURE, payload: data.detail || 'Failed to load users.' });
    }
  } catch {
    dispatch({ type: USERS_FETCH_FAILURE, payload: 'Network error.' });
  }
};

export const createUser = (payload) => async (dispatch) => {
  dispatch({ type: USER_CREATE_REQUEST });
  try {
    const res  = await fetch(USER_ENDPOINTS.list, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok || res.status === 201) {
      dispatch({ type: USER_CREATE_SUCCESS, payload: data });
    } else {
      const msg = data.email?.[0] || data.detail || JSON.stringify(data);
      dispatch({ type: USER_CREATE_FAILURE, payload: msg });
    }
  } catch {
    dispatch({ type: USER_CREATE_FAILURE, payload: 'Network error.' });
  }
};

export const updateUser = (id, payload) => async (dispatch) => {
  dispatch({ type: USER_UPDATE_REQUEST });
  try {
    const res  = await fetch(USER_ENDPOINTS.detail(id), {
      method:  'PATCH',
      headers: authHeaders(),
      body:    JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      dispatch({ type: USER_UPDATE_SUCCESS, payload: data });
    } else {
      dispatch({ type: USER_UPDATE_FAILURE, payload: data.detail || JSON.stringify(data) });
    }
  } catch {
    dispatch({ type: USER_UPDATE_FAILURE, payload: 'Network error.' });
  }
};

export const deleteUser = (id) => async (dispatch) => {
  try {
    await fetch(USER_ENDPOINTS.detail(id), { method: 'DELETE', headers: authHeaders() });
    dispatch({ type: USER_DELETE_SUCCESS, payload: id });
  } catch {}
};

export const resetCreateUser = () => ({ type: USER_CREATE_RESET });
export const resetUpdateUser = () => ({ type: USER_UPDATE_RESET });
