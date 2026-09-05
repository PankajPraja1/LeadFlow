import { createAsyncThunk, createSlice, } from "@reduxjs/toolkit";
import api from "../../services/api";
// Retrieve the token from localStorage if it exists
const savedToken = localStorage.getItem("leadflow_token");

const getErrorMessage = (error, fallbackMessage) => {
  return (error.response?.data?.message || fallbackMessage);
};

// Exported async thunks for user registration, login, fetching current user, updating profile, and changing password
export const registerUser = createAsyncThunk("auth/register", async (userData, thunkAPI) => {
  try {
    const response = await api.post("/auth/register", userData);

    localStorage.setItem("leadflow_token", response.data.token);

    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to create account"));
  }
});

// Exported async thunk for user login
export const loginUser = createAsyncThunk("auth/login", async (credentials, thunkAPI) => {
  try {
    const response = await api.post("/auth/login", credentials);

    localStorage.setItem("leadflow_token", response.data.token);

    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to log in"));
  }
});

// Exported async thunk for fetching the current authenticated user
export const getCurrentUser = createAsyncThunk("auth/getCurrentUser", async (_, thunkAPI) => {
  try {
    const response = await api.get("/auth/me");

    return response.data.user;
  } catch (error) {
    localStorage.removeItem("leadflow_token");

    return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to authenticate user"));
  }
});

// Exported async thunk for updating the user's profile
export const updateUserProfile = createAsyncThunk("auth/updateUserProfile", async (profileData, thunkAPI) => {
  try {
    const response = await api.patch("/auth/profile", profileData);

    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to update profile"));
  }
});

// Exported async thunk for changing the user's password
export const changeUserPassword = createAsyncThunk("auth/changeUserPassword", async (passwordData, thunkAPI) => {
  try {
    const response = await api.patch("/auth/password", passwordData);

    localStorage.setItem("leadflow_token", response.data.token);

    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(getErrorMessage(error, "Unable to change password"));
  }
});

// Create the auth slice with initial state, reducers, and extra reducers for handling async thunks
const authSlice = createSlice({
  name: "auth",

  initialState: {
    user: null,
    token: savedToken,

    isLoading: false,
    isCheckingAuth: Boolean(savedToken),

    isUpdatingProfile: false,
    isChangingPassword: false,

    error: null,
    profileError: null,
    profileMessage: null,
  },

  // 
  reducers: {
    logout: (state) => {
      localStorage.removeItem("leadflow_token");

      state.user = null;
      state.token = null;
      state.isLoading = false;
      state.isCheckingAuth = false;
      state.isUpdatingProfile = false;
      state.isChangingPassword = false;
      state.error = null;
      state.profileError = null;
      state.profileMessage = null;
    },

    clearAuthError: (state) => {
      state.error = null;
    },

    clearProfileFeedback: (state) => {
      state.profileError = null;
      state.profileMessage = null;
    },
  },

  // 
  extraReducers: (builder) => {
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Unable to create account";
      })
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Unable to log in";
      })
      .addCase(getCurrentUser.pending, (state) => {
        state.isCheckingAuth = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isCheckingAuth = false;
        state.user = action.payload;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isCheckingAuth = false;
        state.user = null;
        state.token = null;
        state.error = action.payload || "Unable to authenticate user";
      })
      .addCase(updateUserProfile.pending, (state) => {
        state.isUpdatingProfile = true;
        state.profileError = null;
        state.profileMessage = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.isUpdatingProfile = false;
        state.user = action.payload.user;
        state.profileMessage = action.payload.message;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.isUpdatingProfile = false;
        state.profileError = action.payload || "Unable to update profile";
      })
      .addCase(changeUserPassword.pending, (state) => {
        state.isChangingPassword = true;
        state.profileError = null;
        state.profileMessage = null;
      })
      .addCase(changeUserPassword.fulfilled, (state, action) => {
        state.isChangingPassword = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.profileMessage = action.payload.message;
      })
      .addCase(changeUserPassword.rejected, (state, action) => {
        state.isChangingPassword = false;
        state.profileError = action.payload || "Unable to change password";
      });
  },
});

export const {
  logout,
  clearAuthError,
  clearProfileFeedback,
} = authSlice.actions;

export default authSlice.reducer;