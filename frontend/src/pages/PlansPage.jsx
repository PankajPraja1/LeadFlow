import { useEffect, useState } from "react";
import { Archive, Edit3, Plus, Search, Target, UserRound, } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import PlanFormModal from "../components/plans/PlanFormModal";
import { archivePlan, clearPlanFeedback, fetchPlans, } from "../features/plans/planSlice";

const statusStyles = {
    draft: "bg-amber-100 text-amber-700",
    active: "bg-emerald-100 text-emerald-700",
    archived: "bg-slate-200 text-slate-600",
};

// PlansPage component 
function PlansPage() {
    const dispatch = useDispatch();

    const { user } = useSelector((state) => state.auth);

    const {
        plans,
        total,
        page,
        totalPages,
        isLoading,
        isSubmitting,
        error,
        successMessage, } = useSelector((state) => state.plans);

    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);

    const canCreate = ["admin", "leader"].includes(user?.systemRole);

    useEffect(() => {
        dispatch(fetchPlans({
            search,
            status,
            page: currentPage,
            limit: 9,
        }));
    }, [dispatch, search, status, currentPage]);

    useEffect(() => {
        if (!error && !successMessage) return;

        const timeout = setTimeout(() => {
            dispatch(clearPlanFeedback());
        }, 4000);

        return () => clearTimeout(timeout);
    }, [dispatch, error, successMessage]); // Clear feedback messages after 4 seconds

    const handleSearch = (event) => {
        event.preventDefault();
        setCurrentPage(1);
        setSearch(searchInput.trim());
    }; // Handle search form submission

    const handleOpenCreate = () => {
        setEditingPlan(null);
        setIsModalOpen(true);
    }; // Open modal for creating a new plan

    const handleOpenEdit = (plan) => {
        setEditingPlan(plan);
        setIsModalOpen(true);
    }; // Open modal for editing an existing plan

    const handleCloseModal = (didSave = false) => {
        setIsModalOpen(false);
        setEditingPlan(null);

        if (didSave) {
            dispatch(fetchPlans({
                search,
                status,
                page: currentPage,
                limit: 9,
            }));
        }
    }; // Close the plan form modal

    const canModify = (plan) => {
        if (user?.systemRole === "admin") {
            return true;
        }

        const currentUserId = user?.id || user?._id;

        const creatorId = typeof plan.createdBy === "object" ? plan.createdBy?._id : plan.createdBy;

        return (user?.systemRole === "leader" && currentUserId === creatorId);
    }; // Check if the current user can modify a plan (edit or archive) based on their role and ownership

    const handleArchive = async (plan) => {
        const confirmed = window.confirm(`Archive "${plan.name}"? Members will no longer be able to view it.`);

        if (!confirmed) return;

        try {
            await dispatch(archivePlan(plan._id)).unwrap();

            dispatch(fetchPlans({
                search,
                status,
                page: currentPage,
                limit: 9,
            }));
        } catch {
            // Redux displays the backend error.
        }
    }; // Handle archiving a plan after user confirmation, and refresh the plans list afterward

    return (
        <main className="p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">
                            Marketing Plans
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Reusable strategies for engaging and converting leads.
                        </p>
                    </div>

                    {canCreate && (
                        <button type="button" onClick={handleOpenCreate} className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800">
                            <Plus size={18} />
                            Create plan
                        </button>
                    )}
                </div>

                {successMessage && (
                    <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        {successMessage}
                    </div>
                )}

                {error && (
                    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row">
                        <form onSubmit={handleSearch} className="flex flex-1 gap-2" >
                            <div className="relative flex-1">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                                <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search marketing plans..." className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                            </div>

                            <button type="submit" className="cursor-pointer rounded-lg bg-slate-800 px-4 py-2.5 font-semibold text-white hover:bg-slate-900">
                                Search
                            </button>
                        </form>

                        {user?.systemRole !== "member" && (
                            <select value={status} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-blue-500"
                                onChange={(event) => {
                                    setStatus(event.target.value);
                                    setCurrentPage(1);
                                }}
                            >
                                <option value="">All statuses</option>
                                <option value="draft">Draft</option>
                                <option value="active">Active</option>
                                <option value="archived">Archived</option>
                            </select>
                        )}
                    </div>
                </section>

                <div className="mb-4 text-sm text-slate-500">
                    {total} {total === 1 ? "plan" : "plans"} found
                </div>

                {isLoading ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                        Loading marketing plans...
                    </div>
                ) : plans.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                        <Target size={40} className="mx-auto text-slate-300" />

                        <h2 className="mt-4 text-lg font-semibold text-slate-800">
                            No marketing plans found
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            {canCreate ? "Create your first reusable marketing plan." : "No active plans are currently available."}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {plans.map((plan) => (
                            <article key={plan._id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm" >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">
                                            {plan.name}
                                        </h2>

                                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[plan.status]}`} >
                                            {plan.status}
                                        </span>
                                    </div>

                                    <Target className="shrink-0 text-blue-700" />
                                </div>

                                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                                    {plan.description}
                                </p>

                                {plan.targetAudience && (
                                    <div className="mt-4 rounded-lg bg-slate-50 p-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                            Target audience
                                        </p>

                                        <p className="mt-1 text-sm text-slate-700">
                                            {plan.targetAudience}
                                        </p>
                                    </div>
                                )}

                                {plan.followUpSteps?.length > 0 && (
                                    <p className="mt-4 text-sm text-slate-500">
                                        {plan.followUpSteps.length} follow-up{" "}
                                        {plan.followUpSteps.length === 1 ? "step" : "steps"}
                                    </p>
                                )}

                                <div className="mt-auto border-t border-slate-100 pt-4">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <UserRound size={14} />

                                        <span>
                                            Created by{" "}
                                            {plan.createdBy?.name || "Unknown"}
                                        </span>
                                    </div>

                                    {canModify(plan) && (
                                        <div className="mt-4 flex gap-2">
                                            <button type="button" className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                onClick={() => handleOpenEdit(plan)}
                                            >
                                                <Edit3 size={15} />
                                                Edit
                                            </button>

                                            {plan.status !== "archived" && (
                                                <button type="button" disabled={isSubmitting} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                    onClick={() => handleArchive(plan)}
                                                >
                                                    <Archive size={15} />
                                                    Archive
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="mt-7 flex items-center justify-center gap-3">
                        <button type="button" disabled={page <= 1 || isLoading} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => setCurrentPage((current) => Math.max(current - 1, 1))}
                        >
                            Previous
                        </button>

                        <span className="text-sm text-slate-600">
                            Page {page} of {totalPages}
                        </span>

                        <button type="button" disabled={page >= totalPages || isLoading} className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => setCurrentPage((current) => Math.min(current + 1, totalPages))}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <PlanFormModal
                    key={editingPlan?._id || "new-plan"}
                    isOpen
                    onClose={handleCloseModal}
                    plan={editingPlan}
                />
            )}
        </main>
    );
}

export default PlansPage;
