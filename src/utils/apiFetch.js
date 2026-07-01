import { LOGOUT } from '../redux/types/authTypes';
import store from '../redux/store';

const REFRESH_URL = () => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'https://vistararealtybackend-production.up.railway.app';
  return `${base}/api/auth/token/refresh/`;
};

async function refreshAccessToken() {
  try {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return null;
    const res = await fetch(REFRESH_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem('access_token', data.access);
    if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
    return data.access;
  } catch {
    return null;
  }
}

function forceLogout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('company');
  store.dispatch({ type: LOGOUT });
}

// Drop-in fetch wrapper for authenticated web requests.
// On 401: tries token refresh once, then forces logout if that also fails.
export async function apiFetch(url, options = {}) {
  if (typeof window === 'undefined') return fetch(url, options);

  const token = localStorage.getItem('access_token');
  const buildHeaders = (t) => ({
    'Content-Type': 'application/json',
    ...options.headers,
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  });

  let res = await fetch(url, { ...options, headers: buildHeaders(token) });
  if (res.status !== 401) return res;

  const newToken = await refreshAccessToken();
  if (newToken) {
    return fetch(url, { ...options, headers: buildHeaders(newToken) });
  }

  forceLogout();
  return res;
}
