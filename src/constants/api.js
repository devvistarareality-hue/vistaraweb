export const RAILWAY_URL = 'https://vistararealtybackend-production.up.railway.app';

let BASE_URL = process.env.NEXT_PUBLIC_API_URL || RAILWAY_URL;

export const setBaseUrl = (url) => { BASE_URL = url; };
export const getBaseUrl = () => BASE_URL;

export const COMPANY_ENDPOINTS = {
  get verify() { return `${BASE_URL}/api/company/verify/`; },
  get list()   { return `${BASE_URL}/api/company/all/`; },
  detail: (id) => `${BASE_URL}/api/company/${id}/`,
};

export const AUTH_ENDPOINTS = {
  get login()   { return `${BASE_URL}/api/auth/login/`; },
  get me()      { return `${BASE_URL}/api/auth/me/`; },
  get refresh() { return `${BASE_URL}/api/auth/token/refresh/`; },
};

export const USER_ENDPOINTS = {
  get list()   { return `${BASE_URL}/api/auth/users/`; },
  detail: (id) => `${BASE_URL}/api/auth/users/${id}/`,
};
