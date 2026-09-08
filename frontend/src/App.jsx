import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { getCurrentUser } from "./features/auth/authSlice";

import DashboardPage from "./pages/DashboardPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LeadDetailsPage from "./pages/LeadDetailsPage";
import LoginPage from "./pages/LoginPage";
import PlansPage from "./pages/PlansPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

// App component that sets up the routing for the application. It checks for a valid token and fetches the current user if the token exists. It defines routes for login, registration, dashboard, lead details, and profile pages, with protected routes for authenticated access.
function App() {
  const dispatch = useDispatch();

  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, token]); // Fetch the current user if a token exists

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={<LoginPage />} />

      <Route
        path="/register"
        element={<RegisterPage />} />

      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />} />

      <Route
        path="/reset-password/:token"
        element={<ResetPasswordPage />} />

      {/* Shared protected layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={<DashboardPage />}
        />

        <Route
          path="/leads/:leadId"
          element={<LeadDetailsPage />}
        />

        <Route
          path="/plans"
          element={<PlansPage />}
        />

        <Route
          path="/profile"
          element={<ProfilePage />}
        />
      </Route>

      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />} />

      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />} />

    </Routes>
  );
}

export default App;