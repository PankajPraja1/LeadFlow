import { Navigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import {
  getCurrentUser,
  logout,
} from "../features/auth/authSlice";

function ProtectedRoute({ children }) {
  const dispatch = useDispatch();

  const {
    token,
    user,
    isCheckingAuth,
    authCheckError,
  } = useSelector((state) => state.auth);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isCheckingAuth) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-100"
        role="status"
      >
        <p className="text-slate-600">
          Loading LeadFlow...
        </p>
      </div>
    );
  }

  if (authCheckError || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Unable to verify your session
          </h1>

          <p role="alert" className="mt-3 text-sm text-slate-600">
            {authCheckError ||
              "Please retry to load your account."}
          </p>

          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => dispatch(getCurrentUser())}
              className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800"
            >
              Retry
            </button>

            <button
              type="button"
              onClick={() => dispatch(logout())}
              className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to login
            </button>
          </div>
        </section>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;