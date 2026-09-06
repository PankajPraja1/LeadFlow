import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";

import api from "../services/api";

// ForgotPasswordPage component
function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Handle form submission
    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            setIsSubmitting(true);
            setMessage("");
            setError("");

            const response = await api.post("/auth/forgot-password", { email });

            setMessage(response.data.message);
            setEmail("");
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Unable to request password reset");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
            <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-7">
                    <img src="/leadflow-logo.svg" alt="LeadFlow logo" className="mb-5 h-12 w-12" />

                    <h1 className="text-3xl font-bold text-slate-900">
                        Forgot password?
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Enter your account email and we will send you a secure password-reset link.
                    </p>
                </div>

                {message && (
                    <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                            Email address
                        </label>

                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)}
                                required autoComplete="email" placeholder="you@example.com" className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="w-full cursor-pointer rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60" >
                        {isSubmitting ? "Sending link..." : "Send reset link"}
                    </button>
                </form>

                <Link to="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800">
                    <ArrowLeft size={16} />
                    Back to login
                </Link>
            </section>
        </main>
    );
}

export default ForgotPasswordPage;