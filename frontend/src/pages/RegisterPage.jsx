import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { clearAuthError, registerUser } from "../features/auth/authSlice";
import GoogleLoginButton from "../components/GoogleLoginButton";

// RegisterPage component handles user registration functionality, including form state management, dispatching the registerUser action, and navigation upon successful registration.
function RegisterPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { token, isLoading, error } = useSelector((state) => state.auth);

    const [validationError, setValidationError] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    useEffect(() => { dispatch(clearAuthError()) }, [dispatch]);

    if (token) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleChange = (event) => {
        const { name, value } = event.target;
        setValidationError("");
        setFormData((currentData) => ({
            ...currentData,
            [name]: value,
        }));
    }; // handleChange updates the formData state

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            setValidationError("Passwords do not match");
            return;
        }

        if (formData.password.length < 6) {
            setValidationError("Password must contain at least 6 characters");
            return;
        }

        try {
            await dispatch(
                registerUser({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                })
            ).unwrap();

            navigate("/dashboard");
        } catch {
            // The Redux state displays the API error.
        }
    }; // HandleSubmit validates the form data and dispatches the registerUser action

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
                        Build a more organized sales pipeline.
                    </p>

                    <p className="mt-5 max-w-md text-blue-100">
                        Capture leads, schedule follow-ups and monitor
                        conversions from one workspace.
                    </p>
                </div>

                <p className="text-sm text-blue-200">
                    Start managing leads today.
                </p>
            </section>

            <section className="flex w-full items-center justify-center p-6 lg:w-1/2">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
                    <div className="mb-7">
                        <p className="font-semibold text-blue-700 lg:hidden">
                            LeadFlow
                        </p>

                        <h2 className="mt-2 text-3xl font-bold text-slate-900">
                            Create account
                        </h2>

                        <p className="mt-2 text-slate-500">
                            Get started with your lead-management workspace.
                        </p>
                    </div>

                    {(error || validationError) && (
                        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {validationError || error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4" >
                        <div>
                            <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700" >
                                Full name
                            </label>

                            <input
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                autoComplete="name"
                                placeholder="Your full name"
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

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
                                required
                                autoComplete="email"
                                placeholder="you@example.com"
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700" >
                                Password
                            </label>

                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength="6"
                                autoComplete="new-password"
                                placeholder="Minimum 6 characters"
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700" >
                                Confirm password
                            </label>

                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                autoComplete="new-password"
                                placeholder="Enter password again"
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <button type="submit" disabled={isLoading}
                            className="cursor-pointer w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60" >
                            {isLoading
                                ? "Creating account..."
                                : "Create account"}
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />

                        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Or
                        </span>

                        <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <GoogleLoginButton />

                    <p className="mt-6 text-center text-sm text-slate-600">
                        Already have an account?{" "}
                        <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800" >
                            Sign in
                        </Link>
                    </p>
                </div>
            </section>
        </main>
    ); // The component renders a registration form with fields for name, email, password, and confirm password. It displays validation errors and API errors, and handles form submission to register a new user. Upon successful registration, it navigates the user to the dashboard.
}

export default RegisterPage;
