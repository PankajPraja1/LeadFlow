import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarClock, ListTodo, RefreshCw, Search, } from "lucide-react";

import { clearTaskFeedback, fetchTasks, } from "../features/tasks/taskSlice";

import TaskActionDialog from "../components/tasks/TaskActionDialog";

import {
    buildTaskQuery,
    defaultTaskFilters,
    formatTaskDate,
    taskViewDescriptions,
    taskViews,
} from "../features/tasks/taskFilters";

const statusColors = {
    pending: "bg-amber-50 text-amber-800",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-600",
};

function FollowUpsPage() {
    const dispatch = useDispatch();

    const {
        token,
        user,
        isCheckingAuth,
        authCheckError,
    } = useSelector((state) => state.auth);

    const {
        items,
        pagination,
        listStatus,
        listError,
        listQueryKey,
        refreshKey,
        mutationStatus,
    } = useSelector((state) => state.tasks);

    const [filters, setFilters] = useState(defaultTaskFilters);
    const [searchDraft, setSearchDraft] = useState("");
    const [now, setNow] = useState(() => new Date());
    const [reloadKey, setReloadKey] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [notice, setNotice] = useState(null);

    const userId = user?.id ?? user?._id;
    const role = user?.systemRole;

    const canRead = Boolean(user?.isEmailVerified && user?.isActive !== false && ["admin", "leader", "member", "viewer"].includes(role));

    const canLoad = Boolean(token && canRead && !isCheckingAuth && !authCheckError);

    const canWrite = canLoad && ["admin", "leader", "member"].includes(role);

    const sessionKey = JSON.stringify([token, userId, role,]);

    const filterKey = JSON.stringify(filters);
    const queryKey = JSON.stringify(buildTaskQuery(filters, now));

    const matchingQuery = canLoad && listQueryKey === queryKey;

    const correctingPage = matchingQuery && listStatus === "succeeded" && pagination?.page > pagination?.pages;

    const loading = !matchingQuery || listStatus === "idle" || listStatus === "loading" || correctingPage;

    const failed = matchingQuery && listStatus === "failed";

    const ready = matchingQuery && listStatus === "succeeded" && !correctingPage;

    // Refresh time-sensitive filters and overdue indicators.
    useEffect(() => {
        const updateClock = () => setNow(new Date());

        const timer = window.setInterval(updateClock, 60000);

        window.addEventListener("focus", updateClock);
        document.addEventListener("visibilitychange", updateClock);

        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", updateClock);
            document.removeEventListener("visibilitychange", updateClock);
        };
    }, []);

    // Load the selected task view.
    useEffect(() => {
        if (!canLoad) return;

        let active = true;

        const query = JSON.parse(queryKey);
        const request = dispatch(fetchTasks(query));

        request.then((action) => {
            if (!active || !fetchTasks.fulfilled.match(action)) {
                return;
            }

            const lastPage = Math.max(1, action.payload.pagination.pages);

            if (query.page > lastPage) {
                setFilters((current) =>
                    JSON.stringify(current) === filterKey ? { ...current, page: lastPage } : current
                );
            }
        });

        return () => {
            active = false;
            request.abort();
        };
    }, [
        dispatch,
        canLoad,
        token,
        userId,
        role,
        queryKey,
        filterKey,
        refreshKey,
        reloadKey,
    ]);

    const changeFilter = (name, value) => {
        setFilters((current) => ({
            ...current,
            [name]: value,
            page: 1,
        }));
    };

    const refresh = () => {
        setNow(new Date());
        setReloadKey((current) => current + 1);
    };

    const openTaskDialog = (mode, task = null) => {
        if (!canWrite || mutationStatus === "loading") return;

        dispatch(clearTaskFeedback());
        setNotice(null);

        setDialog({
            mode,
            task,
            sessionKey,
        });
    };

    const taskSaved = (task) => {
        setDialog(null);
        setSearchDraft("");
        setNow(new Date());

        setFilters({
            ...defaultTaskFilters,
            view: task.status === "completed"
                ? "completed" : task.status === "cancelled"
                    ? "cancelled" : task.dueAt
                        ? "pending" : "undated",
            completedPeriod: task.status === "completed" ? "today" : "all",
        });

        setNotice({
            sessionKey,
            message: task.status === "completed"
                ? "Task completed." : task.status === "cancelled"
                    ? "Task cancelled." : "Task saved.",
        });
    };

    return (
        <main className="mx-auto max-w-6xl px-5 py-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 id="tasks-heading" tabIndex={-1} className="text-3xl font-bold text-slate-900" >
                        Follow-ups & Tasks
                    </h1>

                    <p className="mt-2 text-slate-500">
                        Your lead follow-ups, personal tasks, and work history.
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        Dates and times use your device’s timezone.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={refresh} disabled={!canLoad || loading}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <RefreshCw size={17} aria-hidden="true" />
                        Refresh
                    </button>

                    {canWrite && (
                        <button type="button" onClick={() => openTaskDialog("create")} disabled={mutationStatus === "loading"}
                            className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            New personal task
                        </button>
                    )}
                </div>
            </div>

            {canLoad && notice?.sessionKey === sessionKey && (
                <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" >
                    {notice.message}
                </p>
            )}

            <div role="group" aria-label="Task view" className="mt-7 flex flex-wrap gap-2" >
                {taskViews.map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={filters.view === value} onClick={() => changeFilter("view", value)}
                        className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${filters.view === value
                            ? "bg-blue-700 text-white"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <section aria-label="Task filters" className="mt-5 rounded-xl border border-slate-200 bg-white p-5" >
                <div className="flex flex-wrap items-end gap-4">
                    <form className="min-w-0 flex-1 basis-72"
                        onSubmit={(event) => {
                            event.preventDefault();
                            changeFilter("search", searchDraft.trim());
                        }}
                    >
                        <label htmlFor="task-search" className="mb-2 block text-sm font-medium text-slate-700" >
                            Search tasks
                        </label>

                        <div className="flex gap-2">
                            <input id="task-search" type="search" value={searchDraft} maxLength={120}
                                onChange={(event) =>
                                    setSearchDraft(event.target.value)
                                }
                                placeholder="Title or description" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                            />

                            <button type="submit" className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-3 py-2.5 font-semibold text-white hover:bg-blue-800" >
                                <Search size={16} aria-hidden="true" />
                                Search
                            </button>
                        </div>
                    </form>

                    <div>
                        <label htmlFor="task-kind" className="mb-2 block text-sm font-medium text-slate-700" >
                            Filter by type
                        </label>

                        <select id="task-kind"
                            value={
                                filters.view === "undated"
                                    ? "personal" : filters.kind
                            }
                            disabled={filters.view === "undated"}
                            onChange={(event) =>
                                changeFilter("kind", event.target.value)
                            }
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100"
                        >
                            <option value="all">All types</option>
                            <option value="follow_up">Lead follow-ups</option>
                            <option value="personal">Personal tasks</option>
                        </select>
                    </div>

                    {filters.view === "completed" && (
                        <div>
                            <label htmlFor="completion-period" className="mb-2 block text-sm font-medium text-slate-700" >
                                Completed when
                            </label>

                            <select id="completion-period" value={filters.completedPeriod}
                                onChange={(event) =>
                                    changeFilter("completedPeriod", event.target.value)
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                            >
                                <option value="all">Any time</option>
                                <option value="today">Today</option>
                                <option value="yesterday">Yesterday</option>
                            </select>
                        </div>
                    )}

                    <button type="button"
                        onClick={() => {
                            setSearchDraft("");
                            setFilters(defaultTaskFilters);
                        }}
                        className="cursor-pointer px-1 py-2.5 text-sm font-semibold text-blue-700 hover:underline"
                    >
                        Reset filters
                    </button>
                </div>

                <p className="mt-3 text-sm text-slate-500">
                    {taskViewDescriptions[filters.view]}
                </p>
            </section>

            <section aria-label="Task results" aria-busy={loading && canRead} className="mt-6" >
                {user && !canRead ? (
                    <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700" >
                        Tasks are unavailable for this account.
                    </p>
                ) : failed ? (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" >
                        <p>
                            {listError?.message || "Unable to load tasks"}
                        </p>

                        <button type="button" onClick={refresh} className="mt-2 cursor-pointer font-semibold underline" >
                            Try again
                        </button>
                    </div>
                ) : loading ? (
                    <p role="status" className="py-10 text-center text-slate-500" >
                        Loading tasks...
                    </p>
                ) : ready && items.length === 0 ? (
                    <div role="status" className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center" >
                        <ListTodo size={32} aria-hidden="true" className="mx-auto text-slate-400" />

                        <p className="mt-3 font-semibold text-slate-700">
                            No tasks match these filters.
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            Try another view or clear your search.
                        </p>
                    </div>
                ) : ready && (
                    <>
                        <p role="status" className="mb-3 text-sm text-slate-500" >
                            {pagination.total}{" "}
                            {pagination.total === 1 ? "task" : "tasks"} found
                        </p>

                        <ul className="grid gap-4 xl:grid-cols-2">
                            {items.map((task) => {
                                const overdue =
                                    task.status === "pending" &&
                                    task.dueAt &&
                                    new Date(task.dueAt) < now;

                                return (
                                    <li key={task._id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" >
                                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                                                {task.kind === "follow_up"
                                                    ? "Lead follow-up" : "Personal task"}
                                            </span>

                                            <span className={`rounded-full px-2.5 py-1 capitalize ${statusColors[task.status] ||
                                                statusColors.pending
                                                }`}
                                            >
                                                {task.status}
                                            </span>

                                            {overdue && (
                                                <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
                                                    Overdue
                                                </span>
                                            )}
                                        </div>

                                        <h2 className="mt-3 break-words text-lg font-bold text-slate-900">
                                            {task.title}
                                        </h2>

                                        {task.description && (
                                            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
                                                {task.description}
                                            </p>
                                        )}

                                        <p className="mt-4 flex items-start gap-2 text-sm text-slate-600">
                                            <CalendarClock size={17} aria-hidden="true" className="mt-0.5 shrink-0" />

                                            {task.dueAt
                                                ? `Due ${formatTaskDate(task.dueAt)}`
                                                : "No due date"}
                                        </p>

                                        {task.status === "completed" && (
                                            <div className="mt-3 text-sm text-emerald-700">
                                                <p>
                                                    Completed{" "}
                                                    {formatTaskDate(task.completedAt)}
                                                </p>

                                                {task.completionNote && (
                                                    <p className="mt-1 whitespace-pre-wrap break-words">
                                                        Outcome: {task.completionNote}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {task.status === "cancelled" && (
                                            <p className="mt-3 text-sm text-slate-500">
                                                Cancelled{" "}
                                                {formatTaskDate(task.cancelledAt)}
                                            </p>
                                        )}

                                        {task.lead && (
                                            <Link to={`/leads/${task.lead._id}`}
                                                className="mt-4 inline-flex max-w-full items-start gap-1 break-words text-sm font-semibold text-blue-700 hover:underline"
                                            >
                                                <span className="min-w-0 break-words">
                                                    View lead: {task.lead.name}
                                                </span>

                                                <ArrowUpRight size={16} aria-hidden="true" className="shrink-0" />
                                            </Link>
                                        )}

                                        {canWrite && task.status === "pending" && (
                                            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                                                {[
                                                    ["edit", "Edit"],
                                                    ["complete", "Complete"],
                                                    ["cancel", "Cancel"],
                                                ].map(([mode, label]) => (
                                                    <button key={mode} type="button" onClick={() => openTaskDialog(mode, task)} disabled={mutationStatus === "loading"}
                                                        className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}

                {ready && pagination.total > 0 && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
                        <p className="text-slate-600">
                            Page {pagination.page} of {pagination.pages}
                        </p>

                        <div className="flex gap-2">
                            <button type="button" disabled={filters.page <= 1}
                                onClick={() =>
                                    setFilters((current) => ({
                                        ...current,
                                        page: current.page - 1,
                                    }))
                                }
                                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Previous
                            </button>

                            <button type="button" disabled={filters.page >= pagination.pages}
                                onClick={() =>
                                    setFilters((current) => ({
                                        ...current,
                                        page: current.page + 1,
                                    }))
                                }
                                className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {canWrite && dialog?.sessionKey === sessionKey && (
                <TaskActionDialog
                    key={`${dialog.mode}:${dialog.task?._id || "new"}`}
                    mode={dialog.mode}
                    task={dialog.task}
                    sessionKey={sessionKey}
                    onClose={() => setDialog(null)}
                    onSaved={taskSaved}
                />
            )}
        </main>
    );
}

export default FollowUpsPage;