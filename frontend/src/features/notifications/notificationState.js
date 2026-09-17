import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { makePreferencePatch, readPreferenceResponse } from "./notificationPreferenceValues.js";

const roles = ["admin", "leader", "member", "viewer"];
const pageSize = 10;
const maxSyncBatches = 3;

export const canUseNotifications = (auth) => Boolean(
  auth.token && (auth.user?.id || auth.user?._id) &&
  auth.user.isActive === true && auth.user.isEmailVerified === true &&
  roles.includes(auth.user.systemRole) &&
  !auth.isCheckingAuth && !auth.authCheckError
);

// Kept only in request closures, never persisted in notification state.
const sessionKey = (auth) => JSON.stringify([
  auth.token, auth.user?.id ?? auth.user?._id, auth.user?.systemRole,
  auth.user?.isActive, auth.user?.isEmailVerified,
]);

const initialState = () => ({
  items: [],
  unreadCount: null,
  pagination: null,
  query: { page: 1, limit: pageSize, unread: false },
  refreshStatus: "idle",
  refreshRequestId: null,
  refreshError: null,
  readStatus: "idle",
  readRequestId: null,
  readingId: null,
  readError: null,
  refreshKey: 0,
  hasMore: false,
  inAppEnabled: null,
  lastUpdated: null,
  preferences: null,
  preferencesStatus: "idle",
  preferencesRequestId: null,
  preferencesError: null,
  preferencesMessage: null,
  preferencesNeedsReload: false,
});

const isId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const isDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;

const isNotification = (item) => Boolean(
  isId(item?._id) && item.type === "task_reminder" &&
  isDate(item.createdAt) && isDate(item.scheduledFor) &&
  (item.readAt === null || isDate(item.readAt)) &&
  isId(item.task?._id) && typeof item.task.title === "string" &&
  isDate(item.task.dueAt) && item.task.status === "pending" &&
  (item.task.kind === "personal" && item.task.lead === null ||
    item.task.kind === "follow_up" && isId(item.task.lead?._id) &&
    typeof item.task.lead.name === "string")
);

const requireResponse = (valid) => {
  if (!valid) throw new Error("Unable to confirm the notification response. Refresh and try again.");
};

const validateInbox = (data, query) => {
  const pagination = data?.pagination;

  requireResponse(
    data?.success === true && Array.isArray(data.notifications) &&
    data.notifications.every(isNotification) &&
    data.notifications.length <= query.limit && isCount(data.unreadCount) &&
    pagination?.page === query.page && pagination.limit === query.limit &&
    isCount(pagination.total) && Number.isSafeInteger(pagination.pages) &&
    pagination.pages === Math.max(1, Math.ceil(pagination.total / query.limit))
  );

  return data;
};

const discardInbox = (state) => {
  state.items = [];
  state.unreadCount = null;
  state.pagination = null;
  state.lastUpdated = null;
  state.refreshRequestId = null;
  state.refreshStatus = "idle";
};

// The app supplies its existing Axios client and session-check thunk.
// This also allows the same state logic to be tested without real accounts.
export const createNotificationState = ({ api, getCurrentUser }) => {
  const requestContext = (thunkAPI, scope) => {
    const { getState, requestId, signal } = thunkAPI;
    const auth = getState().auth;
    const identity = sessionKey(auth);
    return {
      config: {
        signal,
        timeout: 15000,
        headers: { Authorization: `Bearer ${auth.token}` },
      },
      isCurrent: () => !signal.aborted &&
        sessionKey(getState().auth) === identity &&
        canUseNotifications(getState().auth) &&
        getState().notifications[`${scope}RequestId`] === requestId,
    };
  };

  const rejectRequest = (error, context, thunkAPI) => {
    if (!context.isCurrent()) return thunkAPI.rejectWithValue({ stale: true });

    const status = error.response?.status ?? error.statusCode ?? null;

    if (status === 401 || status === 403) thunkAPI.dispatch(getCurrentUser());

    return thunkAPI.rejectWithValue({
      status,
      code: typeof error.response?.data?.code === "string" ? error.response.data.code : null,
      message: typeof error.response?.data?.message === "string"
        ? error.response.data.message
        : !error.isAxiosError && error.message
          ? error.message
          : "Unable to update notifications. Refresh when your connection is available.",
    });
  };

  const refreshNotifications = createAsyncThunk(
    "notifications/refresh",
    async (_, thunkAPI) => {
      const context = requestContext(thunkAPI, "refresh");
      const query = { ...thunkAPI.getState().notifications.query };

      try {
        let sync;
        // A finite number of requests per refresh; the poller handles more later.
        for (let batch = 0; batch < maxSyncBatches; batch += 1) {
          if (!context.isCurrent()) return thunkAPI.rejectWithValue({ stale: true });

          sync = (await api.post("/notifications/sync", {}, context.config)).data;

          if (!context.isCurrent()) return thunkAPI.rejectWithValue({ stale: true });

          requireResponse(sync?.success === true &&
            typeof sync.inAppEnabled === "boolean" && typeof sync.hasMore === "boolean" &&
            isCount(sync.processed) && isCount(sync.created));

          if (!sync.hasMore || !sync.inAppEnabled) break;
        }

        const readInbox = async () => validateInbox(
          (await api.get("/notifications", { ...context.config, params: { ...query } })).data,
          query
        );

        let inbox = await readInbox();
        if (!context.isCurrent()) return thunkAPI.rejectWithValue({ stale: true });

        // Completing a task or marking the last unread row can remove a page.
        if (query.page > inbox.pagination.pages) {
          query.page = inbox.pagination.pages;
          inbox = await readInbox();
          if (!context.isCurrent()) return thunkAPI.rejectWithValue({ stale: true });
        }

        return {
          ...inbox, query, hasMore: sync.hasMore,
          inAppEnabled: sync.inAppEnabled, checkedAt: Date.now(),
        };
      } catch (error) {
        return rejectRequest(error, context, thunkAPI);
      }
    },
    {
      condition: (_, { getState }) => {
        const { auth, notifications } = getState();
        return canUseNotifications(auth) &&
          notifications.refreshStatus !== "loading" && notifications.readStatus !== "loading" &&
          notifications.preferencesStatus !== "saving";
      },
    }
  );

  const setNotificationRead = createAsyncThunk(
    "notifications/setRead",
    async ({ id, isRead }, thunkAPI) => {
      const context = requestContext(thunkAPI, "read");
      try {
        const { data } = await api.patch(
          `/notifications/${encodeURIComponent(id)}/read`, { isRead }, context.config
        );

        if (!context.isCurrent()) return thunkAPI.rejectWithValue({ stale: true });

        requireResponse(data?.success === true && isNotification(data.notification) &&
          data.notification._id === id && Boolean(data.notification.readAt) === isRead);

        return data.notification;
      } catch (error) {
        return rejectRequest(error, context, thunkAPI);
      }
    },
    {
      condition: (argument, { getState }) => canUseNotifications(getState().auth) &&
        isId(argument?.id) && typeof argument.isRead === "boolean" &&
        getState().notifications.readStatus !== "loading",
    }
  );

  const fetchNotificationPreferences = createAsyncThunk(
    "notifications/fetchPreferences",
    async (_, thunkAPI) => {
      const context = requestContext(thunkAPI, "preferences");

      try {
        const { data } = await api.get("/notifications/preferences", context.config);

        if (!context.isCurrent()) return thunkAPI.rejectWithValue({ stale: true });

        return readPreferenceResponse(data);
      } catch (error) {
        return rejectRequest(error, context, thunkAPI);
      }
    },
    {
      condition: (_, { getState }) => canUseNotifications(getState().auth) &&
        !["loading", "saving"].includes(getState().notifications.preferencesStatus),
    }
  );

  const saveNotificationPreferences = createAsyncThunk(
    "notifications/savePreferences",
    async (argument, thunkAPI) => {
      const context = requestContext(thunkAPI, "preferences");

      try {
        const body = makePreferencePatch(argument);
        const { data } = await api.patch("/notifications/preferences", body, context.config);
        if (!context.isCurrent()) return thunkAPI.rejectWithValue({ stale: true });

        const preferences = readPreferenceResponse(data);

        requireResponse(preferences.version === body.version + 1 &&
          Object.keys(body).every((field) => field === "version" || preferences[field] === body[field]));

        return preferences;
      } catch (error) {
        return rejectRequest(error, context, thunkAPI);
      }
    },
    {
      condition: (_, { getState }) => {
        const { auth, notifications } = getState();
        return canUseNotifications(auth) && notifications.preferences !== null &&
          !notifications.preferencesNeedsReload &&
          !["loading", "saving"].includes(notifications.preferencesStatus);
      },
    }
  );

  const slice = createSlice({
    name: "notifications",
    initialState,
    reducers: {
      resetNotifications: () => initialState(),
      clearPreferenceFeedback: (state) => {
        state.preferencesMessage = null;
        if (!state.preferencesNeedsReload) state.preferencesError = null;
      },
      requestNotificationRefresh: (state) => {
        state.refreshKey += 1;
      },
      setNotificationView: (state, action) => {
        const page = action.payload?.page;
        const unread = action.payload?.unread;
        if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || typeof unread !== "boolean") return;
        state.query = { page, unread, limit: pageSize };
        state.items = [];
        state.pagination = null;
        state.refreshError = null;
        state.readError = null;
        state.refreshRequestId = null;
        state.refreshStatus = "idle";
        state.refreshKey += 1;
      },
    },

    extraReducers: (builder) => builder
      .addCase(refreshNotifications.pending, (state, action) => {
        state.refreshRequestId = action.meta.requestId;
        state.refreshStatus = "loading";
        state.refreshError = null;
      })
      .addCase(refreshNotifications.fulfilled, (state, action) => {
        if (state.refreshRequestId !== action.meta.requestId) return;
        state.refreshRequestId = null;
        state.refreshStatus = "succeeded";
        state.items = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
        state.pagination = action.payload.pagination;
        state.query = action.payload.query;
        state.hasMore = action.payload.hasMore;
        state.inAppEnabled = action.payload.inAppEnabled;
        state.lastUpdated = action.payload.checkedAt;
      })
      .addCase(refreshNotifications.rejected, (state, action) => {
        if (state.refreshRequestId !== action.meta.requestId) return;
        state.refreshRequestId = null;
        const ignored = action.meta.aborted || action.payload?.stale;
        state.refreshStatus = ignored ? "idle" : "failed";
        state.refreshError = ignored ? null : action.payload?.message || "Unable to load notifications.";
        // Do not display an old badge or private task text as a current result.
        if (!ignored) discardInbox(state);
        if (!ignored) state.refreshStatus = "failed";
      })
      .addCase(setNotificationRead.pending, (state, action) => {
        state.readRequestId = action.meta.requestId;
        state.readStatus = "loading";
        state.readingId = action.meta.arg.id;
        state.readError = null;
        // An earlier GET cannot restore the old read flag after this write.
        state.refreshRequestId = null;
        state.refreshStatus = "idle";
      })
      .addCase(setNotificationRead.fulfilled, (state, action) => {
        if (state.readRequestId !== action.meta.requestId) return;
        state.readRequestId = null;
        state.readStatus = "succeeded";
        state.readingId = null;
        state.items = state.items.map((item) =>
          item._id === action.payload._id ? action.payload : item
        ).filter((item) => !state.query.unread || item.readAt === null);
        state.unreadCount = null;
        state.pagination = null;
        state.refreshKey += 1;
      })
      .addCase(setNotificationRead.rejected, (state, action) => {
        if (state.readRequestId !== action.meta.requestId) return;
        const ignored = action.meta.aborted || action.payload?.stale;
        state.readRequestId = null;
        state.readStatus = ignored ? "idle" : "failed";
        state.readingId = null;
        state.readError = ignored ? null : action.payload?.message || "Unable to change read status.";
        discardInbox(state);
        // Recover by reading; never automatically retry a user write.
        state.refreshKey += 1;
      })
      .addCase(fetchNotificationPreferences.pending, (state, action) => {
        state.preferencesRequestId = action.meta.requestId;
        state.preferencesStatus = "loading";
        state.preferences = null;
        state.preferencesError = null;
        state.preferencesMessage = null;
        state.preferencesNeedsReload = false;
      })
      .addCase(fetchNotificationPreferences.fulfilled, (state, action) => {
        if (state.preferencesRequestId !== action.meta.requestId) return;
        state.preferencesRequestId = null;
        state.preferencesStatus = "succeeded";
        state.preferences = action.payload;
        state.preferencesNeedsReload = false;
      })
      .addCase(fetchNotificationPreferences.rejected, (state, action) => {
        if (state.preferencesRequestId !== action.meta.requestId) return;
        state.preferencesRequestId = null;
        const ignored = action.meta.aborted || action.payload?.stale;
        state.preferencesStatus = ignored ? "idle" : "failed";
        state.preferencesError = ignored ? null : action.payload?.message || "Unable to load notification settings.";
      })
      .addCase(saveNotificationPreferences.pending, (state, action) => {
        state.preferencesRequestId = action.meta.requestId;
        state.preferencesStatus = "saving";
        state.preferencesError = null;
        state.preferencesMessage = null;
        // In-flight sync responses must not restore the pre-save enabled flag.
        state.refreshRequestId = null;
        state.refreshStatus = "idle";
      })
      .addCase(saveNotificationPreferences.fulfilled, (state, action) => {
        if (state.preferencesRequestId !== action.meta.requestId) return;
        state.preferencesRequestId = null;
        state.preferencesStatus = "succeeded";
        state.preferences = action.payload;
        state.preferencesNeedsReload = false;
        state.preferencesMessage = "Notification settings saved.";
        state.inAppEnabled = action.payload.inAppEnabled;
        if (!action.payload.inAppEnabled) state.hasMore = false;
        state.refreshKey += 1;
      })
      .addCase(saveNotificationPreferences.rejected, (state, action) => {
        if (state.preferencesRequestId !== action.meta.requestId) return;
        state.preferencesRequestId = null;
        state.preferencesStatus = "failed";
        // A timeout/abort may happen after the server committed the write.
        // Read the current version before another save; never retry the PATCH.
        state.preferencesNeedsReload = action.payload?.status !== 400;
        state.preferencesError = action.payload?.status === 409
          ? "These settings changed in another tab or session. Reload saved settings, then reapply your changes."
          : action.meta.aborted || action.payload?.stale
            ? "The save was interrupted. Reload saved settings before trying again."
            : action.payload?.message || "Unable to save settings. Reload them to check the current values.";
        state.refreshKey += 1;
      }),
  });

  return {
    ...slice, refreshNotifications, setNotificationRead,
    fetchNotificationPreferences, saveNotificationPreferences,
  };
};
