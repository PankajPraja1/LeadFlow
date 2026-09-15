import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

function NotFoundPage() {
    const headingRef = useRef(null);

    const {
        token,
        user,
        isCheckingAuth,
        authCheckError, } = useSelector((state) => state.auth);

    const hasVerifiedSession = Boolean(
        token &&
        user?.isEmailVerified === true &&
        user?.isActive !== false &&
        !isCheckingAuth &&
        !authCheckError
    );

    useEffect(() => {
        const previousTitle = document.title;

        document.title = "Page not found — LeadFlow";
        headingRef.current?.focus({ preventScroll: true });

        return () => {
            document.title = previousTitle;
        };
    }, []);

    return (
        <main className="min-h-screen bg-[#f8f9f5] px-6 py-8 text-slate-900">
            <div className="mx-auto max-w-5xl">
                <Link to="/" aria-label="LeadFlow home"
                    className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
                >
                    <img src="/leadflow-logo.svg" alt="" className="h-10 w-10" />

                    <span className="text-xl font-bold">
                        LeadFlow
                    </span>
                </Link>

                <section aria-labelledby="not-found-heading" className="mx-auto max-w-xl py-20 text-center sm:py-28" >
                    <p className="text-8xl font-black tracking-tight text-blue-700 sm:text-9xl">
                        404
                    </p>

                    <h1 id="not-found-heading" ref={headingRef} tabIndex={-1}
                        className="mt-6 text-3xl font-bold tracking-tight focus:outline-none sm:text-4xl"
                    >
                        This page took a wrong turn.
                    </h1>

                    <p className="mt-4 leading-7 text-slate-600">
                        We couldn’t find that page. The link may be incorrect or the page may have moved. Let’s get you somewhere useful.
                    </p>

                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link to="/"
                            className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
                        >
                            Back to home
                        </Link>

                        <Link to={hasVerifiedSession ? "/dashboard" : "/login"}
                            className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
                        >
                            {hasVerifiedSession ? "Open dashboard" : "Log in"}
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}

export default NotFoundPage;