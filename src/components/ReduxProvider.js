'use client';
import { useEffect } from 'react';
import { Provider, useDispatch } from 'react-redux';
import store from '../redux/store';
import { LOGIN_SUCCESS, COMPANY_VERIFY_SUCCESS } from '../redux/types/authTypes';

// Reads localStorage on first render and restores auth + company state into Redux
function AuthHydrator({ children }) {
  const dispatch = useDispatch();

  useEffect(() => {
    try {
      const token    = localStorage.getItem('access_token');
      const userJson = localStorage.getItem('user');
      if (token && userJson) {
        dispatch({ type: LOGIN_SUCCESS, payload: JSON.parse(userJson) });
      }
      const companyJson = localStorage.getItem('company');
      if (companyJson) {
        dispatch({ type: COMPANY_VERIFY_SUCCESS, payload: JSON.parse(companyJson) });
      }
    } catch {}
  }, []);

  return children;
}

export default function ReduxProvider({ children }) {
  return (
    <Provider store={store}>
      <AuthHydrator>{children}</AuthHydrator>
    </Provider>
  );
}
