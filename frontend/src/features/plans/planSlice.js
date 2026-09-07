import { createAsyncThunk, createSlice, } from "@reduxjs/toolkit";

import api from "../../services/api";

// Async thunks for plan-related operations
export const fetchPlans = createAsyncThunk("plans/fetchPlans", async (filters = {}, thunkAPI) => {
    try {
        const params = new URLSearchParams();

        if (filters.status) {
            params.set("status", filters.status);
        }

        if (filters.search?.trim()) {
            params.set("search", filters.search.trim());
        }

        params.set("page", filters.page || 1);
        params.set("limit", filters.limit || 10);

        const response = await api.get(`/plans?${params.toString()}`);
        return response.data;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "Unable to retrieve marketing plans");
    }
});

// Async thunk to fetch a single plan by ID
export const fetchPlanById = createAsyncThunk("plans/fetchPlanById", async (planId, thunkAPI) => {
    try {
        const response = await api.get(`/plans/${planId}`);
        return response.data.plan;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "Unable to retrieve marketing plan");
    }
});

// Async thunk to create a new plan
export const createPlan = createAsyncThunk("plans/createPlan", async (planData, thunkAPI) => {
    try {
        const response = await api.post("/plans", planData);
        return response.data.plan;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "Unable to create marketing plan");
    }
});

// Async thunk to update an existing plan
export const updatePlan = createAsyncThunk("plans/updatePlan", async ({ planId, planData }, thunkAPI) => {
    try {
        const response = await api.patch(`/plans/${planId}`, planData);
        return response.data.plan;
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "Unable to update marketing plan");
    }
});

// Async thunk to archive a plan
export const archivePlan = createAsyncThunk("plans/archivePlan", async (planId, thunkAPI) => {
    try {
        const response = await api.delete(`/plans/${planId}`);

        return {
            planId,
            message: response.data.message,
        };
    } catch (error) {
        return thunkAPI.rejectWithValue(error.response?.data?.message || "Unable to archive marketing plan");
    }
});

const initialState = {
    plans: [],
    selectedPlan: null,

    total: 0,
    page: 1,
    totalPages: 1,

    isLoading: false,
    isSubmitting: false,

    error: null,
    successMessage: null,
}; // initial state for the plan slice

// Create the plan slice using Redux Toolkit's createSlice
const planSlice = createSlice({
    name: "plans",
    initialState,

    // Reducers for synchronous actions
    reducers: {
        clearPlanFeedback: (state) => {
            state.error = null;
            state.successMessage = null;
        },

        clearSelectedPlan: (state) => {
            state.selectedPlan = null;
        },
    },

    // Handle async actions using extraReducers
    extraReducers: (builder) => {
        builder
            // Fetch plans
            .addCase(fetchPlans.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchPlans.fulfilled, (state, action) => {
                state.isLoading = false;
                state.plans = action.payload.plans;
                state.total = action.payload.total;
                state.page = action.payload.page;
                state.totalPages = action.payload.totalPages || 1;
            })
            .addCase(fetchPlans.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            // Fetch one plan
            .addCase(fetchPlanById.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchPlanById.fulfilled, (state, action) => {
                state.isLoading = false;
                state.selectedPlan = action.payload;
            })
            .addCase(fetchPlanById.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            // Create plan
            .addCase(createPlan.pending, (state) => {
                state.isSubmitting = true;
                state.error = null;
                state.successMessage = null;
            })
            .addCase(createPlan.fulfilled, (state, action) => {
                state.isSubmitting = false;
                state.plans.unshift(action.payload);
                state.total += 1;
                state.successMessage = "Marketing plan created successfully";
            })
            .addCase(createPlan.rejected, (state, action) => {
                state.isSubmitting = false;
                state.error = action.payload;
            })
            // Update plan
            .addCase(updatePlan.pending, (state) => {
                state.isSubmitting = true;
                state.error = null;
                state.successMessage = null;
            })
            .addCase(updatePlan.fulfilled, (state, action) => {
                state.isSubmitting = false;

                const updatedPlan = action.payload;

                state.plans = state.plans.map((plan) => plan._id === updatedPlan._id ? updatedPlan : plan);

                state.selectedPlan = updatedPlan;
                state.successMessage = "Marketing plan updated successfully";
            })
            .addCase(updatePlan.rejected, (state, action) => {
                state.isSubmitting = false;
                state.error = action.payload;
            })
            // Archive plan
            .addCase(archivePlan.pending, (state) => {
                state.isSubmitting = true;
                state.error = null;
                state.successMessage = null;
            })
            .addCase(archivePlan.fulfilled, (state, action) => {
                state.isSubmitting = false;

                const archivedPlan = state.plans.find((plan) => plan._id === action.payload.planId);

                if (archivedPlan) {
                    archivedPlan.status = "archived";
                }

                if (state.selectedPlan?._id === action.payload.planId) {
                    state.selectedPlan.status = "archived";
                }
                state.successMessage = action.payload.message;
            })
            .addCase(archivePlan.rejected, (state, action) => {
                state.isSubmitting = false;
                state.error = action.payload;
            });
    },
});

export const {
    clearPlanFeedback,
    clearSelectedPlan,
} = planSlice.actions;

export default planSlice.reducer;
