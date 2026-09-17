import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { getCurrentUser } from "./features/auth/authSlice";

import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import DashboardPage from "./pages/DashboardPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LeadDetailsPage from "./pages/LeadDetailsPage";
import LoginPage from "./pages/LoginPage";
import PlansPage from "./pages/PlansPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import FollowUpsPage from "./pages/FollowUpsPage";
import NotificationPreferencesPage from "./pages/NotificationPreferencesPage";

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

      <Route
        path="/verify-email"
        element={<VerifyEmailPage />}
      />

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
          path="/follow-ups"
          element={<FollowUpsPage />}
        />

        <Route
          path="/plans"
          element={<PlansPage />}
        />

        <Route
          path="/profile"
          element={<ProfilePage />}
        />

        <Route
          path="/settings/notifications"
          element={<NotificationPreferencesPage />}
        />
      </Route>

      <Route
        path="/"
        element={<HomePage />} />

      <Route
        path="*"
        element={<NotFoundPage />} />

    </Routes>
  );
}

export default App;