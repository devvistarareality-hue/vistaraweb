import { combineReducers } from 'redux';
import authReducer           from './authReducer';
import userManagementReducer from './userManagementReducer';
import companiesReducer      from './companiesReducer';

export default combineReducers({
  auth:           authReducer,
  userManagement: userManagementReducer,
  companies:      companiesReducer,
});
