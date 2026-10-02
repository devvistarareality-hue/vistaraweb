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

export const restoreAdminFilter = () => (dispatch, getState) => {
  const saved = loadFromStorage();
  if (saved === null) return;
  // The company list may already be loaded: a saved company that is not in it is
  // stale (see companiesActions.dropMissingAdminCompany) — forget it, don't apply it.
  const list = getState?.().companies?.companies;
  if (Array.isArray(list) && list.length && !list.some((c) => String(c.id) === String(saved))) {
    dispatch(setAdminCompany(null));
    return;
  }
  dispatch({ type: SET_ADMIN_COMPANY, payload: saved });
};
