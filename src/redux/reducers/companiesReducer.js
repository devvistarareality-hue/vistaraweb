import {
  COMPANIES_FETCH_REQUEST, COMPANIES_FETCH_SUCCESS, COMPANIES_FETCH_FAILURE,
  COMPANY_UPDATE_REQUEST, COMPANY_UPDATE_SUCCESS, COMPANY_UPDATE_FAILURE, COMPANY_UPDATE_RESET,
} from '../types/companiesTypes';

const initialState = {
  companies:     [],
  loading:       false,
  error:         null,
  updating:      false,
  updateError:   null,
  updateSuccess: false,
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

    default:
      return state;
  }
}
