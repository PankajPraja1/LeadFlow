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
        element={<LoginPage />} />

      <Route
        path="/register"
        element={<RegisterPage />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>}
      />

      <Route
        path="/leads/:leadId"
        element={
          <ProtectedRoute>
            <LeadDetailsPage />
          </ProtectedRoute>}
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />} />

      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />} />
    </Routes>
  ); // Returns the defined routes for the application, including protected routes and redirects for undefined paths.
}

export default App;