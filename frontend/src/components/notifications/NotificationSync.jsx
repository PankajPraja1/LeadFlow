import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { refreshNotifications } from "../../features/notifications/notificationSlice";
import { canUseNotifications } from "../../features/notifications/notificationState";
import { startNotificationPolling } from "../../features/notifications/notificationPolling";

function NotificationSync() {
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const enabled = useSelector((state) => canUseNotifications(state.auth));
  const token = useSelector((state) => state.auth.token);
  const userId = useSelector((state) => state.auth.user?.id ?? state.auth.user?._id);
  const role = useSelector((state) => state.auth.user?.systemRole);
  const refreshKey = useSelector((state) => state.notifications.refreshKey);
  const taskRefreshKey = useSelector((state) => state.tasks.refreshKey);

  useEffect(() => {
    if (!enabled) return;

    return startNotificationPolling({
      refresh: () => dispatch(refreshNotifications()),
    });
  }, [dispatch, enabled, token, userId, role, pathname, refreshKey, taskRefreshKey]);

  return null;
}

export default NotificationSync;
