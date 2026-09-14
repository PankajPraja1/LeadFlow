import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";
import { getCurrentUser } from "../auth/authSlice";

const readRoles = ["admin", "leader", "member", "viewer"];
const writeRoles = ["admin", "leader", "member"];

const initialState = () => ({
    items: [],
    pagination: null,
    listQueryKey: null,
    selectedTask: null,
    listStatus: "idle",
    detailStatus: "idle",
    mutationStatus: "idle",
    listError: null,
    detailError: null,
    mutationError: null,
    listRequestId: null,
    detailRequestId: null,
    mutationRequestId: null,
    refreshKey: 0,
});

// Every operation uses the token captured when that operation started.
const makeTaskThunk = (name, scope, request) => createAsyncThunk(
    `tasks/${name}`,
    async (argument, thunkAPI) => {
        const { getState, requestId, signal, dispatch, rejectWithValue } = thunkAPI;
        const token = getState().auth.token;
        const isCurrent = () => getState().auth.token === token && getState().tasks[`${scope}RequestId`] === requestId;

        try {
            const response = await request(argument, {
                signal,
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!isCurrent() || signal.aborted) {
                return rejectWithValue({ stale: true });
            }

            const data = response.data;
            const validData = scope === "list"
                ? Array.isArray(data?.tasks) && Number.isInteger(data.pagination?.pages)
                : typeof data?.task?._id === "string" && Number.isSafeInteger(data.task.version);

            if (data?.success !== true || !validData) {
                return rejectWithValue({
                    status: null,
                    message: "Unable to confirm the server response. Refresh and try again.",
                });
            }

            return data;
        } catch (error) {
            if (!isCurrent() || signal.aborted) {
                return rejectWithValue({ stale: true });
            }

            const status = error.response?.status ?? null;

            // Check the session through /auth/me; task permission errors alone
            // must not log out a valid user.
            if (status === 401 || status === 403) {
                dispatch(getCurrentUser());
            }

            return rejectWithValue({
                status,
                message: typeof error.response?.data?.message === "string"
                    ? error.response.data.message
                    : "Unable to complete the task request. Refresh and try again.",
            });
        }
    },
    {
        condition: (_, { getState }) => {
            const { auth, tasks } = getState();
            const roles = scope === "mutation" ? writeRoles : readRoles;

            return Boolean(
                auth.token && auth.user?.isEmailVerified === true &&
                auth.user?.isActive !== false && roles.includes(auth.user?.systemRole) &&
                !auth.isCheckingAuth && !auth.authCheckError &&
                (scope !== "mutation" || tasks.mutationStatus !== "loading")
            );
        },
    }
);

export const fetchTasks = makeTaskThunk("fetchTasks", "list", (query = {}, config) => {
    const params = Object.fromEntries(Object.entries(query).filter(
        ([, value]) => value !== undefined && value !== null && value !== ""
    ));

    return api.get("/tasks", { ...config, params });
});

export const fetchTask = makeTaskThunk("fetchTask", "detail", (id, config) =>
    api.get(`/tasks/${encodeURIComponent(id)}`, config)
);

export const createTask = makeTaskThunk("createTask", "mutation", (data, config) =>
    api.post("/tasks", data, config)
);

export const updateTask = makeTaskThunk("updateTask", "mutation", ({ id, version, changes }, config) =>
    api.patch(`/tasks/${encodeURIComponent(id)}`, { ...changes, version }, config)
);

export const completeTask = makeTaskThunk("completeTask", "mutation", ({ id, version, completionNote = "" }, config) =>
    api.post(`/tasks/${encodeURIComponent(id)}/complete`, {
        version, completionNote,
    }, config)
);

export const cancelTask = makeTaskThunk("cancelTask", "mutation", ({ id, version }, config) =>
    api.post(`/tasks/${encodeURIComponent(id)}/cancel`, { version }, config)
);

const failure = (action) => action.payload ?? {
    status: null,
    message: action.error?.message || "Unable to complete the task request",
};

// A changed task may no longer match the active filter or page.
// The workspace will refetch when refreshKey changes.
const invalidateReads = (state) => {
    state.items = [];
    state.pagination = null;
    state.listQueryKey = null;
    state.selectedTask = null;
    state.listStatus = "idle";
    state.detailStatus = "idle";
    state.listError = null;
    state.detailError = null;
    state.listRequestId = null;
    state.detailRequestId = null;
    state.refreshKey += 1;
};

const addReadCases = (builder, thunk, scope) => {
    const requestKey = `${scope}RequestId`;
    const statusKey = `${scope}Status`;
    const errorKey = `${scope}Error`;

    builder
        .addCase(thunk.pending, (state, action) => {
            state[requestKey] = action.meta.requestId;
            state[statusKey] = "loading";
            state[errorKey] = null;

            if (scope === "list") {
                state.listQueryKey = JSON.stringify(action.meta.arg ?? {});
                state.items = [];
                state.pagination = null;
            } else {
                state.selectedTask = null;
            }
        })
        .addCase(thunk.fulfilled, (state, action) => {
            if (state[requestKey] !== action.meta.requestId) return;
            state[requestKey] = null;
            state[statusKey] = "succeeded";

            if (scope === "list") {
                state.items = action.payload.tasks;
                state.pagination = action.payload.pagination;
            } else {
                state.selectedTask = action.payload.task;
            }
        })
        .addCase(thunk.rejected, (state, action) => {
            if (state[requestKey] !== action.meta.requestId) return;
            const ignored = action.meta.aborted || action.payload?.stale;
            state[requestKey] = null;
            state[statusKey] = ignored ? "idle" : "failed";
            state[errorKey] = ignored ? null : failure(action);
        });
};

const taskSlice = createSlice({
    name: "tasks",
    initialState,
    reducers: {
        resetTasks: () => initialState(),
        clearTaskFeedback: (state) => {
            state.mutationError = null;
            if (state.mutationStatus !== "loading") state.mutationStatus = "idle";
        },
    },
    extraReducers: (builder) => {
        addReadCases(builder, fetchTasks, "list");
        addReadCases(builder, fetchTask, "detail");

        for (const thunk of [createTask, updateTask, completeTask, cancelTask]) {
            builder
                .addCase(thunk.pending, (state, action) => {
                    state.mutationRequestId = action.meta.requestId;
                    state.mutationStatus = "loading";
                    state.mutationError = null;
                })
                .addCase(thunk.fulfilled, (state, action) => {
                    if (state.mutationRequestId !== action.meta.requestId) return;
                    state.mutationRequestId = null;
                    state.mutationStatus = "succeeded";
                    invalidateReads(state);
                })
                .addCase(thunk.rejected, (state, action) => {
                    if (state.mutationRequestId !== action.meta.requestId) return;
                    const ignored = action.meta.aborted || action.payload?.stale;
                    state.mutationRequestId = null;
                    state.mutationStatus = ignored ? "idle" : "failed";
                    state.mutationError = ignored ? null : failure(action);
                    // Refresh after conflicts or uncertain results; never retry writes automatically.
                    invalidateReads(state);
                });
        }
    },
});

export const { resetTasks, clearTaskFeedback } = taskSlice.actions;
export default taskSlice.reducer;
