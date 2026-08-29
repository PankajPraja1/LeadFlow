import { configureStore } from "@reduxjs/toolkit";

import authReducer from "../features/auth/authSlice";
import crmReducer from "../features/crm/crmSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    crm: crmReducer,
  },
});