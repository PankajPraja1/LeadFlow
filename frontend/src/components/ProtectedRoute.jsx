import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

function ProtectedRoute({ children }) {
  const {
    token,
    isCheckingAuth,
  } = useSelector((state) => state.auth);

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">
          Loading LeadFlow...
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}

export default ProtectedRoute;