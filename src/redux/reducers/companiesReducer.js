import {
  COMPANIES_FETCH_REQUEST, COMPANIES_FETCH_SUCCESS, COMPANIES_FETCH_FAILURE,
  COMPANY_UPDATE_REQUEST, COMPANY_UPDATE_SUCCESS, COMPANY_UPDATE_FAILURE, COMPANY_UPDATE_RESET,
  COMPANY_CREATE_REQUEST, COMPANY_CREATE_SUCCESS, COMPANY_CREATE_FAILURE, COMPANY_CREATE_RESET,
  COMPANY_DELETE_SUCCESS,
} from '../types/companiesTypes';

const initialState = {
  companies:     [],
  loading:       false,
  error:         null,
  updating:      false,
  updateError:   null,
  updateSuccess: false,
  creating:      false,
  createError:   null,
  createSuccess: false,
};

export default function companiesReducer(state = initialState, action) {
  switch (action.type) {
    case COMPANIES_FETCH_REQUEST:
      return { ...state, loading: true, error: null };
    case COMPANIES_FETCH_SUCCESS:
      return { ...state, loading: false, companies: action.payload };
    case COMPANIES_FETCH_FAILURE:
      return { ...state, loading: false, error: action.payload };

    case COMPANY_UPDATE_REQUEST:
      return { ...state, updating: true, updateError: null, updateSuccess: false };
    case COMPANY_UPDATE_SUCCESS:
      return {
        ...state,
        updating:      false,
        updateSuccess: true,
        companies: state.companies.map((c) => c.id === action.payload.id ? action.payload : c),
      };
    case COMPANY_UPDATE_FAILURE:
      return { ...state, updating: false, updateError: action.payload };
    case COMPANY_UPDATE_RESET:
      return { ...state, updating: false, updateError: null, updateSuccess: false };

    case COMPANY_CREATE_REQUEST:
      return { ...state, creating: true, createError: null, createSuccess: false };
    case COMPANY_CREATE_SUCCESS:
      return { ...state, creating: false, createSuccess: true, companies: [...state.companies, action.payload] };
    case COMPANY_CREATE_FAILURE:
      return { ...state, creating: false, createError: action.payload };
    case COMPANY_CREATE_RESET:
      return { ...state, creating: false, createError: null, createSuccess: false };

    case COMPANY_DELETE_SUCCESS:
      return { ...state, companies: state.companies.filter((c) => c.id !== action.payload) };

    default:
      return state;
  }
}
