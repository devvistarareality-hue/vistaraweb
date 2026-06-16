import {
  USERS_FETCH_REQUEST, USERS_FETCH_SUCCESS, USERS_FETCH_FAILURE,
  USER_CREATE_REQUEST, USER_CREATE_SUCCESS, USER_CREATE_FAILURE, USER_CREATE_RESET,
  USER_UPDATE_REQUEST, USER_UPDATE_SUCCESS, USER_UPDATE_FAILURE, USER_UPDATE_RESET,
  USER_DELETE_SUCCESS,
} from '../types/userManagementTypes';

const initialState = {
  users:         [],
  loading:       false,
  error:         null,
  creating:      false,
  createError:   null,
  createSuccess: false,
  updating:      false,
  updateError:   null,
  updateSuccess: false,
};

export default function userManagementReducer(state = initialState, action) {
  switch (action.type) {
    case USERS_FETCH_REQUEST:
      return { ...state, loading: true, error: null };
    case USERS_FETCH_SUCCESS:
      return { ...state, loading: false, users: action.payload };
    case USERS_FETCH_FAILURE:
      return { ...state, loading: false, error: action.payload };

    case USER_CREATE_REQUEST:
      return { ...state, creating: true, createError: null, createSuccess: false };
    case USER_CREATE_SUCCESS:
      return { ...state, creating: false, createSuccess: true, users: [...state.users, action.payload] };
    case USER_CREATE_FAILURE:
      return { ...state, creating: false, createError: action.payload };
    case USER_CREATE_RESET:
      return { ...state, creating: false, createError: null, createSuccess: false };

    case USER_UPDATE_REQUEST:
      return { ...state, updating: true, updateError: null, updateSuccess: false };
    case USER_UPDATE_SUCCESS:
      return {
        ...state,
        updating:      false,
        updateSuccess: true,
        users: state.users.map((u) => u.id === action.payload.id ? action.payload : u),
      };
    case USER_UPDATE_FAILURE:
      return { ...state, updating: false, updateError: action.payload };
    case USER_UPDATE_RESET:
      return { ...state, updating: false, updateError: null, updateSuccess: false };

    case USER_DELETE_SUCCESS:
      return { ...state, users: state.users.filter((u) => u.id !== action.payload) };

    default:
      return state;
  }
}
