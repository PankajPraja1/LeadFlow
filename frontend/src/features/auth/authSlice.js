import {
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";

import api from "../../services/api";

const savedToken = localStorage.getItem("leadflow_token");

export const registerUser = createAsyncThunk(
  "auth/register",
  async (userData, thunkAPI) => {
    try {
      const response = await api.post("/auth/register", userData);

      localStorage.setItem("leadflow_token", response.data.token);

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || "Unable to create account");
    }
  }
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async (credentials, thunkAPI) => {
    try {
      const response = await api.post(
        "/auth/login",
        credentials
      );

      localStorage.setItem(
        "leadflow_token",
        response.data.token
      );

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message ||
        "Unable to log in"
      );
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  "auth/getCurrentUser",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/auth/me");
      return response.data.user;
    } catch (error) {
      localStorage.removeItem("leadflow_token");

      return thunkAPI.rejectWithValue(
        error.response?.data?.message ||
        "Unable to authenticate user"
      );
    }
  }
);

const authSlice = createSlice({
  name: "auth",

  initialState: {
    user: null,
    token: savedToken,
    isLoading: false,
    isCheckingAuth: Boolean(savedToken),
    error: null,
  },

  reducers: {
    logout: (state) => {
      localStorage.removeItem("leadflow_token");

      state.user = null;
      state.token = null;
      state.error = null;
      state.isCheckingAuth = false;
    },

    clearAuthError: (state) => {
      state.error = null;
    },
  },

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
        state.error = action.payload;
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
        state.error = action.payload;
      })

      .addCase(getCurrentUser.pending, (state) => {
        state.isCheckingAuth = true;
      })

      .addCase(
        getCurrentUser.fulfilled,
        (state, action) => {
          state.isCheckingAuth = false;
          state.user = action.payload;
        }
      )

      .addCase(
        getCurrentUser.rejected,
        (state, action) => {
          state.isCheckingAuth = false;
          state.user = null;
          state.token = null;
          state.error = action.payload;
        }
      );
  },
});

export const {
  logout,
  clearAuthError,
} = authSlice.actions;

export default authSlice.reducer;