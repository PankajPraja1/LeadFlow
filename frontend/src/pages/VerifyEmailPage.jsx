import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";

import api from "../services/api";
import { logout } from "../features/auth/authSlice";

function VerificationContent({
    token,
    initialEmail,
    initialMessage = "",
    initialError = "",
}) {
    const dispatch = useDispatch();

    const [email, setEmail] = useState(initialEmail);
    const [busyAction, setBusyAction] = useState(null);
    const [error, setError] = useState(initialError);
    const [message, setMessage] = useState(initialMessage);
    const [isVerified, setIsVerified] = useState(false);
    const [linkRejected, setLinkRejected] = useState(false);
    const [isCoolingDown, setIsCoolingDown] = useState(false);

    const activeRequest = useRef(null);

    const isValidToken = /^[a-f0-9]{64}$/.test(token);
    const isBusy = busyAction !== null;

    // Cancel an unfinished request when leaving this page.
    useEffect(() => {
        return () => {
            activeRequest.current?.abort();
        };
    }, []);

    // Allow another resend after one minute.
    useEffect(() => {
        if (!isCoolingDown) return;

        const timer = setTimeout(() => {
            setIsCoolingDown(false);
        }, 60_000);

        return () => clearTimeout(timer);
    }, [isCoolingDown]);

    const handleRequest = async (action) => {
        if (activeRequest.current || isVerified) return;

        if (
            action === "verify" &&
            (!isValidToken || linkRejected)
        ) {
            return;
        }

        if (
            action === "resend" &&
            (isCoolingDown || !email.trim())
        ) {
            return;
        }

        const controller = new AbortController();
        activeRequest.current = controller;

        setBusyAction(action);
        setError("");
        setMessage("");

        try {
            const endpoint =
                action === "verify"
                    ? "/auth/verify-email"
                    : "/auth/resend-verification";

            const body =
                action === "verify"
                    ? { token }
                    : { email: email.trim().toLowerCase() };

            const response = await api.post(endpoint, body, {
                signal: controller.signal,
                timeout: 20_000,
            });

            if (controller.signal.aborted) return;

            if (response.data?.success !== true) {
                throw new Error("Unexpected verification response");
            }

            if (action === "verify") {
                // The backend requires a fresh login after verification.
                dispatch(logout());
                setIsVerified(true);

                setMessage(
                    response.data.message ||
                    "Email verified. You can now sign in."
                );
            } else {
                setIsCoolingDown(true);

                setMessage(
                    response.data.message ||
                    "If this account needs verification, an email will be sent."
                );
            }
        } catch (requestError) {
            if (controller.signal.aborted) return;

            const status = requestError.response?.status;

            if (
                action === "verify" &&
                (status === 400 || status === 409)
            ) {
                setLinkRejected(true);
            }

            const serverMessage =
                requestError.response?.data?.message;

            setError(
                typeof serverMessage === "string"
                    ? serverMessage
                    : "Unable to complete the request. Please try again."
            );
        } finally {
            if (!controller.signal.aborted) {
                setBusyAction(null);
            }

            if (activeRequest.current === controller) {
                activeRequest.current = null;
            }
        }
    };

    const handleResend = (event) => {
        event.preventDefault();
        handleRequest("resend");
    };

    const displayedError =
        error ||
        (token && !isValidToken
            ? "This link is incomplete or invalid. Request a new link below."
            : "");

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
            <section
                aria-busy={isBusy}
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
                <img
                    src="/leadflow-logo.svg"
                    alt="LeadFlow logo"
                    className="mb-5 h-12 w-12"
                />

                <h1 className="text-3xl font-bold text-slate-900">
                    {isVerified ? "Email verified" : "Verify your email"}
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                    {isVerified
                        ? "Sign in to continue to your LeadFlow account."
                        : isValidToken
                            ? "Confirm your email address, then sign in to LeadFlow."
                            : "Open your latest verification email, or request a new link below."}
                </p>

                {displayedError && (
                    <div
                        role="alert"
                        className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                        {displayedError}
                    </div>
                )}

                {message && (
                    <div
                        role="status"
                        className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
                    >
                        {message}
                    </div>
                )}

                {!isVerified && isValidToken && !linkRejected && (
                    <button
                        type="button"
                        onClick={() => handleRequest("verify")}
                        disabled={isBusy}
                        className="mt-6 w-full cursor-pointer rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {busyAction === "verify"
                            ? "Verifying..."
                            : "Verify email"}
                    </button>
                )}

                {!isVerified && (
                    <form
                        onSubmit={handleResend}
                        className="mt-7 space-y-4 border-t border-slate-200 pt-6"
                    >
                        <h2 className="font-semibold text-slate-800">
                            Need a new verification link?
                        </h2>

                        <div>
                            <label
                                htmlFor="verification-email"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Account email
                            </label>

                            <input
                                id="verification-email"
                                name="email"
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                required
                                maxLength={254}
                                autoComplete="email"
                                disabled={isBusy}
                                placeholder="you@example.com"
                                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isBusy || isCoolingDown}
                            className="w-full cursor-pointer rounded-lg border border-blue-700 px-4 py-3 font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {busyAction === "resend"
                                ? "Requesting link..."
                                : isCoolingDown
                                    ? "Wait one minute before resending"
                                    : "Resend verification email"}
                        </button>
                    </form>
                )}

                <Link
                    to="/login"
                    className="mt-6 block text-center text-sm font-semibold text-blue-700 hover:text-blue-800"
                >
                    {isVerified ? "Continue to login" : "Back to login"}
                </Link>
            </section>
        </main>
    );
}

function VerifyEmailPage() {
    const location = useLocation();

    const token =
        new URLSearchParams(location.hash.slice(1)).get("token") ||
        "";

    return (
        <VerificationContent
            key={`${location.key}:${token}`}
            token={token}
            initialEmail={
                typeof location.state?.email === "string"
                    ? location.state.email
                    : ""
            }
            initialMessage={
                typeof location.state?.message === "string"
                    ? location.state.message
                    : ""
            }
            initialError={
                typeof location.state?.error === "string"
                    ? location.state.error
                    : ""
            }
        />
    );
}

export default VerifyEmailPage;