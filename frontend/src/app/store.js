import { configureStore } from "@reduxjs/toolkit";

import authReducer from "../features/auth/authSlice";
import crmReducer from "../features/crm/crmSlice";
import leadDetailsReducer from "../features/leads/leadDetailsSlice";

// Create the Redux store with the combined reducers for authentication, CRM, and lead details
export const store = configureStore({
  reducer: {
    auth: authReducer,
    crm: crmReducer,
    leadDetails: leadDetailsReducer,
  },
});
