const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const COMPANY_ENDPOINTS = {
  verify: `${BASE_URL}/api/company/verify/`,
  list:   `${BASE_URL}/api/company/all/`,
  detail: (id) => `${BASE_URL}/api/company/${id}/`,
};

export const AUTH_ENDPOINTS = {
  login:   `${BASE_URL}/api/auth/login/`,
  me:      `${BASE_URL}/api/auth/me/`,
  refresh: `${BASE_URL}/api/auth/token/refresh/`,
};

export const USER_ENDPOINTS = {
  list:   `${BASE_URL}/api/auth/users/`,
  detail: (id) => `${BASE_URL}/api/auth/users/${id}/`,
};
