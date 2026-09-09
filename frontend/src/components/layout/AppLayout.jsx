import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, LogOut, Menu, Target, UserRound, X, } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, Outlet, useLocation, useNavigate, } from "react-router-dom";

import { logout } from "../../features/auth/authSlice";

const navigationItems = [
    {
        label: "Dashboard & Leads",
        path: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        label: "Marketing Plans",
        path: "/plans",
        icon: Target,
    },
    {
        label: "Profile & Security",
        path: "/profile",
        icon: UserRound,
    },
]; // Navigationitem array for the sidebar and mobile drawer

// function to render navigation links
function NavigationLinks({ onNavigate }) {
    return (
        <nav className="space-y-1 px-3">
            {navigationItems.map((item) => {
                const Icon = item.icon;

                return (
                    <NavLink key={item.path} to={item.path} onClick={onNavigate} className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`
                    }>
                        <Icon size={19} />
                        {item.label}
                    </NavLink>
                );
            })}
        </nav>
    );
}

// Main layout component for the app
function AppLayout() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { pathname } = useLocation();

    const pageTitle = pathname.startsWith("/leads/") ? "Lead Details"
        : {
            "/dashboard": "Dashboard & Leads",
            "/plans": "Marketing Plans",
            "/profile": "Profile & Security",
        }[pathname] || "Workspace";

    const { user } = useSelector((state) => state.auth);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const mobileDialogRef = useRef(null);
    const menuButtonRef = useRef(null);
    const closeButtonRef = useRef(null);

    useEffect(() => {
        if (!isMobileMenuOpen) return;

        const dialog = mobileDialogRef.current;
        const menuButton = menuButtonRef.current;

        if (!dialog) return;

        const previousOverflow = document.body.style.overflow;
        const desktopQuery = window.matchMedia(
            "(min-width: 1024px)"
        );

        if (!dialog.open) {
            dialog.showModal();
        }

        document.body.style.overflow = "hidden";

        closeButtonRef.current?.focus({
            preventScroll: true,
        });

        const handleResize = (event) => {
            if (event.matches) {
                setIsMobileMenuOpen(false);
            }
        };

        desktopQuery.addEventListener("change", handleResize);

        return () => {
            desktopQuery.removeEventListener(
                "change",
                handleResize
            );

            if (dialog.open) {
                dialog.close();
            }

            document.body.style.overflow = previousOverflow;

            // Restore focus if the menu button still exists and is visible.
            if (
                menuButton?.isConnected &&
                menuButton.getClientRects().length > 0
            ) {
                menuButton.focus({
                    preventScroll: true,
                });
            }
        };
    }, [isMobileMenuOpen]); // Effect to handle mobile menu open state, escape key, and window resize events

    useEffect(() => {
        document.title = `${pageTitle} | LeadFlow`;
    }, [pageTitle]);

    const handleLogout = () => {
        dispatch(logout());
        navigate("/login", {
            replace: true,
        });
    };

    return (
        <div className="min-h-screen bg-slate-100">
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
                <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5">
                    <img src="/leadflow-logo.svg" alt="LeadFlow logo" className="h-10 w-10" />

                    <div>
                        <p className="font-bold text-slate-900">
                            LeadFlow
                        </p>

                        <p className="text-xs text-slate-500">
                            CRM workspace
                        </p>
                    </div>
                </div>

                <div className="flex-1 py-5">
                    <NavigationLinks />
                </div>

                <div className="border-t border-slate-200 p-4">
                    <div className="flex items-center gap-3 px-2">
                        {user?.profilePicture ? (
                            <img src={user.profilePicture} alt={`${user.name || "User"} profile`} referrerPolicy="no-referrer"
                                className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                            />
                        ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                <UserRound size={19} />
                            </div>
                        )}

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">
                                {user?.name || "LeadFlow user"}
                            </p>

                            <p className="truncate text-xs capitalize text-slate-500">
                                {user?.systemRole || "member"}
                            </p>
                        </div>
                    </div>

                    <button type="button" onClick={handleLogout}
                        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                        <LogOut size={17} />
                        Log out
                    </button>
                </div>
            </aside>

            {/* Mobile header */}
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
                <div className="flex items-center gap-3">
                    <img src="/leadflow-logo.svg" alt="LeadFlow logo" className="h-9 w-9" />

                    <div>
                        <p className="font-bold text-slate-900">
                            LeadFlow
                        </p>

                        <p className="text-xs text-slate-500">
                            {pageTitle}
                        </p>
                    </div>
                </div>

                <button
                    ref={menuButtonRef}
                    type="button"
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="cursor-pointer rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    aria-label="Open navigation menu"
                    aria-haspopup="dialog"
                    aria-controls="mobile-navigation"
                    aria-expanded={isMobileMenuOpen}
                >
                    <Menu size={21} />
                </button>
            </header>

            {/* Mobile drawer */}
            <dialog
                ref={mobileDialogRef}
                id="mobile-navigation"
                aria-labelledby="mobile-navigation-title"
                onCancel={(event) => {
                    event.preventDefault();
                    setIsMobileMenuOpen(false);
                }}
                onClick={(event) => {
                    if (event.target !== event.currentTarget) return;

                    const bounds = event.currentTarget.getBoundingClientRect();

                    const clickedOutside =
                        event.clientX < bounds.left ||
                        event.clientX > bounds.right ||
                        event.clientY < bounds.top ||
                        event.clientY > bounds.bottom;

                    if (clickedOutside) {
                        setIsMobileMenuOpen(false);
                    }
                }}
                className="fixed inset-y-0 left-0 right-auto m-0 h-[100dvh] max-h-none w-72 max-w-[85vw] overflow-hidden border-0 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40"
            >
                <div className="flex h-full flex-col">
                    <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                        <div className="flex items-center gap-3">
                            <img
                                src="/leadflow-logo.svg"
                                alt=""
                                className="h-9 w-9"
                            />

                            <h2
                                id="mobile-navigation-title"
                                className="font-bold text-slate-900"
                            >
                                LeadFlow navigation
                            </h2>
                        </div>

                        <button
                            ref={closeButtonRef}
                            type="button"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                            aria-label="Close navigation menu"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto py-5">
                        <NavigationLinks
                            onNavigate={() => setIsMobileMenuOpen(false)}
                        />
                    </div>

                    <div className="shrink-0 border-t border-slate-200 p-4">
                        <div className="flex items-center gap-3 px-2">
                            {user?.profilePicture ? (
                                <img
                                    src={user.profilePicture}
                                    alt={`${user.name || "User"} profile`}
                                    referrerPolicy="no-referrer"
                                    className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover"
                                />
                            ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                    <UserRound size={19} />
                                </div>
                            )}

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                    {user?.name || "LeadFlow user"}
                                </p>

                                <p className="truncate text-xs capitalize text-slate-500">
                                    {user?.systemRole || "member"}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleLogout}
                            className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                        >
                            <LogOut size={17} />
                            Log out
                        </button>
                    </div>
                </div>
            </dialog>

            {/* Protected page content */}
            <div className="lg:pl-64">
                <Outlet />
            </div>
        </div>
    );
}

export default AppLayout;
