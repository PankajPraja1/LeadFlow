import { ChevronRight, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import NotificationBell from "../notifications/NotificationBell";

function WorkspaceHeader({ pageTitle, user }) {
    return (
        <header className="hidden items-center justify-between gap-6 border-b border-slate-200 bg-white px-6 py-3 lg:flex">
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                <ol className="flex min-w-0 items-center gap-2 text-sm">
                    <li className="shrink-0">
                        <Link to="/" className="rounded text-slate-500 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                            Home
                        </Link>
                    </li>

                    <li className="flex min-w-0 items-center gap-2">
                        <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-slate-400" />
                        <span aria-current="page" className="truncate font-semibold text-slate-700">
                            {pageTitle}
                        </span>
                    </li>
                </ol>
            </nav>

            <div className="flex shrink-0 items-center gap-4">
                <NotificationBell />

                <div aria-hidden="true" className="h-8 w-px bg-slate-200" />
                <Link to="/profile" aria-label="Open your profile"
                    className="flex items-center gap-2.5 rounded-lg p-1 text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                    {user?.profilePicture ? (
                        <img src={user.profilePicture} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
                    ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                            <UserRound size={18} aria-hidden="true" />
                        </span>
                    )}
                    
                    <span className="max-w-36 truncate text-sm font-semibold">
                        {user?.name || "My profile"}
                    </span>
                </Link>
            </div>
        </header>
    );
}

export default WorkspaceHeader;
