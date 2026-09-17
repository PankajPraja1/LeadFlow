import { combineReducers, configureStore } from "@reduxjs/toolkit";

import authReducer from "../features/auth/authSlice";
import crmReducer from "../features/crm/crmSlice";
import leadDetailsReducer from "../features/leads/leadDetailsSlice";
import planReducer from "../features/plans/planSlice";
import taskReducer, { resetTasks } from "../features/tasks/taskSlice";
import notificationReducer, { resetNotifications, } from "../features/notifications/notificationSlice";

const appReducer = combineReducers({
  auth: authReducer,
  crm: crmReducer,
  leadDetails: leadDetailsReducer,
  plans: planReducer,
  tasks: taskReducer,
  notifications: notificationReducer,
});

const userId = (user) => user?.id ?? user?._id ?? null;

export const rootReducer = (state, action) => {
  const nextState = appReducer(state, action);
  const previousAuth = state?.auth;
  const nextAuth = nextState.auth;

  const taskAccessChanged = previousAuth && (
    previousAuth.token !== nextAuth.token ||
    userId(previousAuth.user) !== userId(nextAuth.user) ||
    previousAuth.user?.systemRole !== nextAuth.user?.systemRole ||
    previousAuth.user?.isActive !== nextAuth.user?.isActive ||
    previousAuth.user?.isEmailVerified !== nextAuth.user?.isEmailVerified
  );

  // Compare the auth reducer's accepted result, so an obsolete failed
  // session check cannot clear the current user's task state.
  return taskAccessChanged
    ? {
      ...nextState,
      tasks: taskReducer(undefined, resetTasks()),
      notifications: notificationReducer(undefined, resetNotifications()),
    }
    : nextState;
};

export const store = configureStore({ reducer: rootReducer });