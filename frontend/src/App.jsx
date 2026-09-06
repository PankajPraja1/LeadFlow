import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import ProtectedRoute from "./components/ProtectedRoute";
import { getCurrentUser } from "./features/auth/authSlice";
import DashboardPage from "./pages/DashboardPage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import LeadDetailsPage from "./pages/LeadDetailsPage";
import ProfilePage from "./pages/ProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
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
      <Route
        path="/login"
        element={<LoginPage />} /> // Defines the route for the login page

      <Route
        path="/register"
        element={<RegisterPage />} /> // Defines the route for the registration page

      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />} /> // Defines the route for the forgot password page

      <Route
        path="/reset-password/:token"
        element={<ResetPasswordPage />} /> // Defines the route for the reset password page

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
          } /> // Defines the route for the dashboard page

      <Route
        path="/leads/:leadId"
        element={
          <ProtectedRoute>
            <LeadDetailsPage />
          </ProtectedRoute>
          } /> // Defines the route for the lead details page

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } /> // Defines the route for the profile page

      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />} /> // Redirects the root path to the dashboard page

      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />} /> // Redirects any undefined paths to the dashboard page
      
    </Routes>
  );
}

export default App;