import { DESIG_FETCH_SUCCESS, DESIG_CREATE_SUCCESS, DESIG_DELETE_SUCCESS, DESIG_ERROR } from '../actions/designationActions';

const init = { designations: [], error: null };

export default function designationReducer(state = init, action) {
  switch (action.type) {
    case DESIG_FETCH_SUCCESS:
      return { ...state, designations: action.payload, error: null };
    case DESIG_CREATE_SUCCESS:
      return { ...state, designations: [...state.designations, action.payload], error: null };
    case DESIG_DELETE_SUCCESS:
      return { ...state, designations: state.designations.filter((d) => d.id !== action.payload) };
    case DESIG_ERROR:
      return { ...state, error: action.payload };
    default:
      return state;
  }
}
