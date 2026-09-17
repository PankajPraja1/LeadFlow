import api from "../../services/api";
import { getCurrentUser } from "../auth/authSlice";
import { createNotificationState } from "./notificationState";

const notifications = createNotificationState({ api, getCurrentUser });

export const {
  refreshNotifications,
  setNotificationRead,
  fetchNotificationPreferences,
  saveNotificationPreferences, } = notifications;

export const {
  resetNotifications,
  clearPreferenceFeedback,
  requestNotificationRefresh,
  setNotificationView, } = notifications.actions;

export default notifications.reducer;
