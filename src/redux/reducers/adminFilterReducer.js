import { SET_ADMIN_COMPANY } from '../types/adminFilterTypes';

const STORAGE_KEY = 'vistara_admin_company_id';

function loadFromStorage() {
  try {
    if (typeof window === 'undefined') return null;
    const val = localStorage.getItem(STORAGE_KEY);
    return val ? parseInt(val, 10) : null;
  } catch { return null; }
}

const initialState = { companyId: null };

export default function adminFilterReducer(state = initialState, action) {
  switch (action.type) {
    case SET_ADMIN_COMPANY:
      return { ...state, companyId: action.payload };
    default:
      return state;
  }
}

export const setAdminCompany = (companyId) => (dispatch) => {
  dispatch({ type: SET_ADMIN_COMPANY, payload: companyId });
  try {
    if (typeof window === 'undefined') return;
    if (companyId == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(companyId));
  } catch {}
};

export const restoreAdminFilter = () => (dispatch) => {
  const saved = loadFromStorage();
  if (saved !== null) dispatch({ type: SET_ADMIN_COMPANY, payload: saved });
};
