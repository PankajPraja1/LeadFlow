import { useState } from "react";
import { Link, useNavigate, useParams, } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, } from "lucide-react";

import api from "../services/api";

// ResetPasswordPage component
function ResetPasswordPage() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Handle input changes
    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((currentData) => ({
            ...currentData,
            [name]: value,
        }));

        setError("");
    };

    // Handle form submission
    const handleSubmit = async (event) => {
        event.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (formData.password.length < 6) {
            setError("Password must contain at least 6 characters");
            return;
        }

        try {
            setIsSubmitting(true);
            setError("");

            const response = await api.patch(`/auth/reset-password/${token}`, formData);

            setMessage(response.data.message);

            setTimeout(() => {
                navigate("/login", {
                    replace: true,
                });
            }, 2000);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to reset password");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
            <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <img src="/leadflow-logo.svg" alt="LeadFlow logo" className="mb-5 h-12 w-12" />

                <h1 className="text-3xl font-bold text-slate-900">
                    Create new password
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                    Choose a new password for your LeadFlow account.
                </p>

                {message && (
                    <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    <div>
                        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                            New password
                        </label>

                        <div className="relative">
                            <LockKeyhole size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                            <input id="password" name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} required minLength="6" autoComplete="new-password"
                                className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-12 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />

                            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? (
                                    <EyeOff size={18} />
                                ) : (
                                    <Eye size={18} />
                                )}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
                            Confirm new password
                        </label>

                        <input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} value={formData.confirmPassword} onChange={handleChange} required minLength="6" autoComplete="new-password"
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <button type="submit" disabled={isSubmitting || Boolean(message)} className="w-full cursor-pointer rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                        {isSubmitting ? "Resetting password..." : "Reset password"}
                    </button>
                </form>

                <Link to="/login" className="mt-6 block text-center text-sm font-semibold text-blue-700 hover:text-blue-800">
                    Return to login
                </Link>
            </section>
        </main>
    );
}

export default ResetPasswordPage;
