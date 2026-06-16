import { COMPANY_ENDPOINTS, AUTH_ENDPOINTS } from '../../constants/api';
import {
  COMPANY_VERIFY_REQUEST, COMPANY_VERIFY_SUCCESS, COMPANY_VERIFY_FAILURE,
  LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, CLEAR_COMPANY,
} from '../types/authTypes';

// localStorage replaces AsyncStorage — synchronous, no await needed
const authHeaders = () => {
  const token = localStorage.getItem('access_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
};

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
      body:    JSON.stringify({ company_code: companyCode, user_code: userCode, password }),
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('access_token',  data.tokens.access);
      localStorage.setItem('refresh_token', data.tokens.refresh);
      localStorage.setItem('user',          JSON.stringify(data.user));
      dispatch({ type: LOGIN_SUCCESS, payload: data.user });
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
  dispatch({ type: LOGOUT });
};
