import {
  COMPANY_VERIFY_REQUEST, COMPANY_VERIFY_SUCCESS, COMPANY_VERIFY_FAILURE,
  LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, CLEAR_COMPANY,
} from '../types/authTypes';

const initialState = {
  companyLoading: false,
  company:        null,
  companyError:   null,
  loginLoading:   false,
  user:           null,
  token:          null,
  loginError:     null,
};

export default function authReducer(state = initialState, action) {
  switch (action.type) {
    case COMPANY_VERIFY_REQUEST:
      return { ...state, companyLoading: true, companyError: null, company: null };
    case COMPANY_VERIFY_SUCCESS:
      return { ...state, companyLoading: false, company: action.payload };
    case COMPANY_VERIFY_FAILURE:
      return { ...state, companyLoading: false, companyError: action.payload };

    case LOGIN_REQUEST:
      return { ...state, loginLoading: true, loginError: null };
    case LOGIN_SUCCESS:
      return { ...state, loginLoading: false, user: action.payload, token: action.payload.token };
    case LOGIN_FAILURE:
      return { ...state, loginLoading: false, loginError: action.payload };

    case CLEAR_COMPANY:
      return { ...state, company: null, companyError: null, companyLoading: false };

    case LOGOUT:
      return { ...initialState };

    default:
      return state;
  }
}
