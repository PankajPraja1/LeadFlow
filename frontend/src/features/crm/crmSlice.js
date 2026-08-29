import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import api from "../../services/api";

const getErrorMessage = (error, fallback) => {
    return error.response?.data?.message || fallback;
};

export const fetchDashboardStats = createAsyncThunk(
    "crm/fetchDashboardStats",
    async (_, thunkAPI) => {
        try {
            const response = await api.get("/dashboard/stats");
            return response.data.stats;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                getErrorMessage(error, "Unable to load dashboard statistics"));
        }
    }
);

export const fetchLeads = createAsyncThunk(
    "crm/fetchLeads",
    async ({ search = "", status = "" } = {}, thunkAPI) => {
        try {
            const response = await api.get("/leads", {
                params: {
                    ...(search && { search }),
                    ...(status && { status }),
                },
            });

            return response.data.leads;
        } catch (error) {
            return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to load leads"));
        }
    }
);

export const createLead = createAsyncThunk(
    "crm/createLead",
    async (leadData, thunkAPI) => {
        try {
            const response = await api.post("/leads", leadData);
            return response.data.lead;
        } catch (error) {
            return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to create lead"));
        }
    }
);

export const updateLead = createAsyncThunk(
    "crm/updateLead",
    async ({ id, leadData }, thunkAPI) => {
        try {
            const response = await api.patch(`/leads/${id}`, leadData);

            return response.data.lead;
        } catch (error) {
            return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to update lead"));
        }
    });

export const deleteLead = createAsyncThunk(
    "crm/deleteLead",
    async (id, thunkAPI) => {
        try {
            await api.delete(`/leads/${id}`);
            return id;
        } catch (error) {
            return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to delete lead"));
        }
    });

const crmSlice = createSlice({
    name: "crm",

    initialState: {
        leads: [],
        stats: {
            total: 0,
            new: 0,
            contacted: 0,
            qualified: 0,
            converted: 0,
            lost: 0,
            conversionRate: 0,
            overdueFollowUps: 0,
            upcomingFollowUps: 0,
        },
        isLoadingLeads: false,
        isLoadingStats: false,
        isSavingLead: false,
        error: null,
    },

    reducers: {
        clearCrmError: (state) => { state.error = null; }
    },

    extraReducers: (builder) => {
        builder.addCase(fetchDashboardStats.pending, (state) => {
            state.isLoadingStats = true;
            state.error = null;
        })

            .addCase(
                fetchDashboardStats.fulfilled,
                (state, action) => {
                    state.isLoadingStats = false;
                    state.stats = action.payload;
                }
            )

            .addCase(
                fetchDashboardStats.rejected,
                (state, action) => {
                    state.isLoadingStats = false;
                    state.error = action.payload;
                }
            )

            .addCase(fetchLeads.pending, (state) => {
                state.isLoadingLeads = true;
                state.error = null;
            })

            .addCase(fetchLeads.fulfilled, (state, action) => {
                state.isLoadingLeads = false;
                state.leads = action.payload;
            })

            .addCase(fetchLeads.rejected, (state, action) => {
                state.isLoadingLeads = false;
                state.error = action.payload;
            })

            .addCase(createLead.pending, (state) => {
                state.isSavingLead = true;
                state.error = null;
            })

            .addCase(createLead.fulfilled, (state) => {
                state.isSavingLead = false;
            })

            .addCase(createLead.rejected, (state, action) => {
                state.isSavingLead = false;
                state.error = action.payload;
            })

            .addCase(updateLead.pending, (state) => {
                state.isSavingLead = true;
                state.error = null;
            })

            .addCase(updateLead.fulfilled, (state) => {
                state.isSavingLead = false;
            })

            .addCase(updateLead.rejected, (state, action) => {
                state.isSavingLead = false;
                state.error = action.payload;
            })

            .addCase(deleteLead.pending, (state) => {
                state.isSavingLead = true;
                state.error = null;
            })

            .addCase(deleteLead.fulfilled, (state, action) => {
                state.isSavingLead = false;
                state.leads = state.leads.filter((lead) => lead._id !== action.payload);
            })

            .addCase(deleteLead.rejected, (state, action) => {
                state.isSavingLead = false;
                state.error = action.payload;
            });
    },
});

export const { clearCrmError, } = crmSlice.actions;

export default crmSlice.reducer;