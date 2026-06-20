import { combineReducers } from 'redux';
import authReducer           from './authReducer';
import userManagementReducer from './userManagementReducer';
import companiesReducer      from './companiesReducer';
import designationReducer    from './designationReducer';
import adminFilterReducer    from './adminFilterReducer';

export default combineReducers({
  auth:           authReducer,
  userManagement: userManagementReducer,
  companies:      companiesReducer,
  designations:   designationReducer,
  adminFilter:    adminFilterReducer,
});
