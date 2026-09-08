import { createAsyncThunk, createSlice, } from "@reduxjs/toolkit";
import api from "../../services/api";
// Retrieve the token from localStorage if it exists
const savedToken = localStorage.getItem("leadflow_token");

const getErrorMessage = (error, fallbackMessage) => {
  return (error.response?.data?.message || fallbackMessage);
};

// Exported async thunk for Google login
export const googleLogin = createAsyncThunk("auth/googleLogin", async (credential, thunkAPI) => {
  try {
    const response = await api.post("/auth/google", {
      credential,
    });

    localStorage.setItem("leadflow_token", response.data.token);

    return response.data;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || "Unable to continue with Google");
  }
});

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
export const getCurrentUser = createAsyncThunk(
  "auth/getCurrentUser",
  async (_, thunkAPI) => {
    const tokenAtStart = thunkAPI.getState().auth.token;

    try {
      const response = await api.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${tokenAtStart}`,
        },
      });

      if (!response.data.user) {
        return thunkAPI.rejectWithValue({
          message: "The server returned an invalid user response",
          sessionInvalid: false,
        });
      }

      return response.data.user;
    } catch (error) {
      const status = error.response?.status;

      const sessionInvalid =
        status === 401 || status === 403;

      const currentAuth = thunkAPI.getState().auth;

      // Only the current session check may remove its token.
      if (sessionInvalid &&
        currentAuth.authRequestId === thunkAPI.requestId &&
        currentAuth.token === tokenAtStart
      ) {
        localStorage.removeItem("leadflow_token");
      }

      return thunkAPI.rejectWithValue({
        message: getErrorMessage(
          error,
          "Unable to verify your session. Please try again."
        ),
        sessionInvalid,
      });
    }
  },
  {
    condition: (_, { getState }) => {
      const { token, authRequestId } = getState().auth;

      return Boolean(token) && !authRequestId;
    },
  }
);

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

    authRequestId: null,
    authRequestToken: null,
    authCheckError: null,

    isUpdatingProfile: false,
    isChangingPassword: false,

    error: null,
    profileError: null,
    profileMessage: null,
  },

  // Reducers for handling synchronous actions like logout and clearing errors
  reducers: {
    logout: (state) => {
      localStorage.removeItem("leadflow_token");

      state.user = null;
      state.token = null;
      state.isLoading = false;
      state.isCheckingAuth = false;
      state.authRequestId = null;
      state.authRequestToken = null;
      state.authCheckError = null;
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

  // Extra reducers to handle the different states of the async thunks
  extraReducers: (builder) => {
    builder
      .addCase(googleLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;

        state.isCheckingAuth = false;
        state.authRequestId = null;
        state.authRequestToken = null;
        state.authCheckError = null;
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;

        state.isCheckingAuth = false;
        state.authRequestId = null;
        state.authRequestToken = null;
        state.authCheckError = null;
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

        state.isCheckingAuth = false;
        state.authRequestId = null;
        state.authRequestToken = null;
        state.authCheckError = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Unable to log in";
      })
      .addCase(getCurrentUser.pending, (state, action) => {
        state.isCheckingAuth = true;
        state.authCheckError = null;
        state.authRequestId = action.meta.requestId;
        state.authRequestToken = state.token;
      })

      .addCase(getCurrentUser.fulfilled, (state, action) => {
        if (
          state.authRequestId !== action.meta.requestId ||
          state.authRequestToken !== state.token
        ) {
          return;
        }

        state.isCheckingAuth = false;
        state.authRequestId = null;
        state.authRequestToken = null;
        state.authCheckError = null;
        state.user = action.payload;
      })

      .addCase(getCurrentUser.rejected, (state, action) => {
        if (
          state.authRequestId !== action.meta.requestId ||
          state.authRequestToken !== state.token
        ) {
          return;
        }

        state.isCheckingAuth = false;
        state.authRequestId = null;
        state.authRequestToken = null;

        const message =
          action.payload?.message ||
          "Unable to verify your session. Please try again.";

        if (action.payload?.sessionInvalid) {
          state.user = null;
          state.token = null;
          state.authCheckError = null;
          state.error = message;
        } else {
          state.authCheckError = message;
        }
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

        state.isCheckingAuth = false;
        state.authRequestId = null;
        state.authRequestToken = null;
        state.authCheckError = null;
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