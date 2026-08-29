import React from 'react'
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { clearAuthError, loginUser } from "../features/auth/authSlice";

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
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            await dispatch(loginUser(formData)).unwrap();
            navigate("/dashboard");
        } catch {
            // Reduxing stores and displays the API error.
            // No need to handle it here.
            // I will just leave this catch block empty for now.
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
                            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700" >
                                Password
                            </label>

                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                autoComplete="current-password"
                                required
                                placeholder="Enter your password"
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <button type="submit" disabled={isLoading}
                            className="cursor-pointer w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoading ? "Signing in..." : "Sign in"}
                        </button>
                    </form>

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
    );
}

export default LoginPage;