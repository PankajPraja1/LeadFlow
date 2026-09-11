import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { clearAuthError, loginUser } from "../features/auth/authSlice";
import GoogleLoginButton from "../components/GoogleLoginButton";

// LoginPage component handles user login functionality, including email/password login and Google OAuth login. It manages form state, dispatches login actions, and handles navigation upon successful login.
function LoginPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { token, isLoading, error } = useSelector((state) => state.auth);

    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    useEffect(() => {
        dispatch(clearAuthError());
    }, [dispatch]);

    if (token) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((currentData) => ({
            ...currentData,
            [name]: value,
        }));
    }; // handleChange updates the formData state when the user types in the email or password fields. It uses the name attribute of the input fields to determine which field to update.

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isLoading) return;

        try {
            await dispatch(loginUser(formData)).unwrap();

            navigate("/dashboard", {
                replace: true,
            });
        } catch (failure) {
            if (failure?.requiresEmailVerification) {
                navigate("/verify-email", {
                    replace: true,
                    state: {
                        email:
                            failure.email ||
                            formData.email.trim().toLowerCase(),
                        message: failure.message,
                    },
                });
            }

            // Wrong passwords and other errors remain on this page.
        }
    };

    return (
        <main className="flex min-h-screen bg-slate-100">
            <section className="hidden w-1/2 bg-blue-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
                <div className="flex items-center gap-3">
                    <img
                        src="/leadflow-logo.svg"
                        alt="LeadFlow logo"
                        className="h-10 w-10 object-contain bg-white rounded-lg"
                    />

                    <span className="text-2xl font-bold">
                        LeadFlow
                    </span>
                </div>

                <div>
                    <p className="max-w-lg text-4xl font-bold leading-tight">
                        Manage every lead from first contact to conversion.
                    </p>

                    <p className="mt-5 max-w-md text-blue-100">
                        Organize follow-ups, monitor your pipeline and
                        improve team productivity from one dashboard.
                    </p>
                </div>

                <p className="text-sm text-blue-200">
                    Lead management made simple.
                </p>
            </section>

            <section className="flex w-full items-center justify-center p-6 lg:w-1/2">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
                    <div className="mb-8">
                        <p className="font-semibold text-blue-700 lg:hidden">
                            LeadFlow
                        </p>

                        <h2 className="mt-2 text-3xl font-bold text-slate-900">
                            Welcome back
                        </h2>

                        <p className="mt-2 text-slate-500">
                            Sign in to access your CRM dashboard.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5" >
                        <div>
                            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700" >
                                Email address
                            </label>

                            <input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                autoComplete="email"
                                required
                                placeholder="you@example.com"
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                                    Password
                                </label>

                                <Link to="/forgot-password" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                                    Forgot password?
                                </Link>
                            </div>

                            <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} autoComplete="current-password" required placeholder="Enter your password"
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>



                        <button type="submit" disabled={isLoading}
                            className="cursor-pointer w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoading ? "Signing in..." : "Sign in"}
                        </button>
                    </form>

                    <Link
                        to="/verify-email"
                        state={{
                            email: formData.email.trim().toLowerCase(),
                        }}
                        className="mt-4 block text-center text-sm font-semibold text-blue-700 hover:text-blue-800"
                    >
                        Resend verification email
                    </Link>

                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />

                        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Or
                        </span>

                        <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <GoogleLoginButton />

                    <p className="mt-6 text-center text-sm text-slate-600">
                        Don&apos;t have an account?{" "}
                        <Link
                            to="/register"
                            className="font-semibold text-blue-700 hover:text-blue-800"
                        >
                            Create account
                        </Link>
                    </p>
                </div>
            </section>
        </main>
    ); // The component renders a login page with a form for email and password login, as well as a Google login button. It also displays any error messages related to the login process and provides navigation links for account creation.
}

export default LoginPage;