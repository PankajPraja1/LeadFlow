import { createAsyncThunk, createSlice, } from "@reduxjs/toolkit";
import api from "../../services/api";

// Helper function to extract error message from API response
const getErrorMessage = (error, fallbackMessage) => {
    return (error.response?.data?.message || fallbackMessage);
};

// Async thunk to fetch lead details, notes, and activities
export const fetchLeadDetails = createAsyncThunk("leadDetails/fetchLeadDetails", async (leadId, thunkAPI) => {
    try {
        const [
            leadResponse,
            notesResponse,
            activitiesResponse,
        ] = await Promise.all([
            api.get(`/leads/${leadId}`),
            api.get(`/leads/${leadId}/notes`),
            api.get(`/leads/${leadId}/activities`),
        ]);

        return {
            lead: leadResponse.data.lead,
            notes: notesResponse.data.notes,
            activities: activitiesResponse.data.activities,
        };
    } catch (error) {
        return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to load lead details"));
    }
});

// Async thunk to create a new lead note
export const createLeadNote = createAsyncThunk("leadDetails/createLeadNote", async (
    {
        leadId,
        content,
    }, thunkAPI) => {
    try {
        const noteResponse = await api.post(`/leads/${leadId}/notes`, { content, });

        const activitiesResponse = await api.get(`/leads/${leadId}/activities`);

        return {
            note: noteResponse.data.note,
            activities: activitiesResponse.data.activities,
        };
    } catch (error) {
        return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to add note"));
    }
});

// Async thunk to update an existing lead note
export const updateLeadNote = createAsyncThunk("leadDetails/updateLeadNote", async (
    {
        leadId,
        noteId,
        content,
    }, thunkAPI) => {
    try {
        const noteResponse = await api.patch(`/leads/${leadId}/notes/${noteId}`, { content, });

        const activitiesResponse = await api.get(`/leads/${leadId}/activities`);

        return {
            note: noteResponse.data.note,
            activities: activitiesResponse.data.activities,
        };
    } catch (error) {
        return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to update note"));
    }
});

// Async thunk to delete a lead note
export const deleteLeadNote = createAsyncThunk("leadDetails/deleteLeadNote", async (
    {
        leadId,
        noteId,
    }, thunkAPI) => {
    try {
        await api.delete(`/leads/${leadId}/notes/${noteId}`);

        const activitiesResponse = await api.get(`/leads/${leadId}/activities`);

        return {
            noteId,
            activities: activitiesResponse.data.activities,
        };
    } catch (error) {
        return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to delete note"));
    }
});

// Initial state for the lead details slice
const initialState = {
    lead: null,
    notes: [],
    activities: [],
    isLoading: false,
    isNoteSaving: false,
    error: null,
};

// Create the lead details slice using createSlice
const leadDetailsSlice = createSlice({
    name: "leadDetails",
    initialState,

    // Reducers for clearing lead details and errors
    reducers: {
        clearLeadDetails: (state) => {
            state.lead = null;
            state.notes = [];
            state.activities = [];
            state.isLoading = false;
            state.isNoteSaving = false;
            state.error = null;
        },

        clearLeadDetailsError: (state) => {
            state.error = null;
        },
    },

    // Extra reducers to handle async thunk actions
    extraReducers: (builder) => {
        builder.addCase(fetchLeadDetails.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        }).addCase(fetchLeadDetails.fulfilled, (state, action) => {
            state.isLoading = false;
            state.lead = action.payload.lead;
            state.notes = action.payload.notes;
            state.activities = action.payload.activities;
        }).addCase(fetchLeadDetails.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.payload || "Unable to load lead details";
        }).addCase(createLeadNote.pending, (state) => {
            state.isNoteSaving = true;
            state.error = null;
        }).addCase(createLeadNote.fulfilled, (state, action) => {
            state.isNoteSaving = false;

            state.notes.unshift(action.payload.note);

            state.activities = action.payload.activities;
        }).addCase(createLeadNote.rejected, (state, action) => {
            state.isNoteSaving = false;
            state.error = action.payload || "Unable to add note";
        }).addCase(updateLeadNote.pending, (state) => {
            state.isNoteSaving = true;
            state.error = null;
        }).addCase(updateLeadNote.fulfilled, (state, action) => {
            state.isNoteSaving = false;

            const noteIndex = state.notes.findIndex((note) => note._id === action.payload.note._id);

            if (noteIndex !== -1) {
                state.notes[noteIndex] = action.payload.note;
            }

            state.activities = action.payload.activities;
        }).addCase(updateLeadNote.rejected, (state, action) => {
            state.isNoteSaving = false;
            state.error = action.payload || "Unable to update note";
        }).addCase(deleteLeadNote.pending, (state) => {
            state.isNoteSaving = true;
            state.error = null;
        }).addCase(deleteLeadNote.fulfilled, (state, action) => {
            state.isNoteSaving = false;

            state.notes = state.notes.filter((note) => note._id !== action.payload.noteId);

            state.activities = action.payload.activities;
        }).addCase(deleteLeadNote.rejected, (state, action) => {
            state.isNoteSaving = false;
            state.error = action.payload || "Unable to delete note";
        });
    },
});

export const {
    clearLeadDetails,
    clearLeadDetailsError,
} = leadDetailsSlice.actions;

export default leadDetailsSlice.reducer;

