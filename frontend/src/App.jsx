import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import ProtectedRoute from "./components/ProtectedRoute";
import { getCurrentUser } from "./features/auth/authSlice";
import DashboardPage from "./pages/DashboardPage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";

function App() {
  const dispatch = useDispatch();

  const { token } = useSelector(
    (state) => state.auth
  );

  useEffect(() => {
    if (token) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, token]);

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
        element={<ProtectedRoute> <DashboardPage /> </ProtectedRoute>} />

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