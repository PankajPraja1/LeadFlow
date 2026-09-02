import { ArrowLeft, CalendarDays, Clock3, Mail, MapPin, Pencil, Phone, Plus, RefreshCw, Save, Trash2, UserPlus, UserRound, X, } from "lucide-react";

import { useEffect, useState, } from "react";
import { useDispatch, useSelector, } from "react-redux";
import { useNavigate, useParams, } from "react-router-dom";
import LeadModal from "../components/LeadModal";
import { deleteLead, updateLead, } from "../features/crm/crmSlice";
import { clearLeadDetails, createLeadNote, deleteLeadNote, fetchLeadDetails, updateLeadNote, } from "../features/leads/leadDetailsSlice";

// Define styles for different lead statuses
const statusStyles = {
    new: "bg-blue-100 text-blue-700",
    contacted: "bg-amber-100 text-amber-700",
    qualified: "bg-purple-100 text-purple-700",
    converted: "bg-emerald-100 text-emerald-700",
    lost: "bg-red-100 text-red-700",
};

// Define styles and icons for different activity types in the activity timeline
const activityStyles = {
    lead_created: {
        icon: UserPlus,
        style: "bg-emerald-100 text-emerald-700",
    },

    lead_updated: {
        icon: Pencil,
        style: "bg-blue-100 text-blue-700",
    },

    status_changed: {
        icon: RefreshCw,
        style: "bg-purple-100 text-purple-700",
    },

    followup_updated: {
        icon: CalendarDays,
        style: "bg-amber-100 text-amber-700",
    },

    lead_assigned: {
        icon: UserRound,
        style: "bg-cyan-100 text-cyan-700",
    },

    note_added: {
        icon: Plus,
        style: "bg-emerald-100 text-emerald-700",
    },

    note_updated: {
        icon: Pencil,
        style: "bg-blue-100 text-blue-700",
    },

    note_deleted: {
        icon: Trash2,
        style: "bg-red-100 text-red-700",
    },
};

// Check if the user has permission to modify a note based on their role and the note's author
const canModifyNote = (user, note) => {
    const currentUserId = user?._id || user?.id;
    const authorId = note.author?._id || note.author?.id || note.author;
    const hasElevatedAccess = [
        "admin",
        "leader",
    ].includes(user?.systemRole);

    return (hasElevatedAccess || authorId?.toString() === currentUserId?.toString());
};

const formatDate = (date) => {
    if (!date) {
        return "Not scheduled";
    }

    return new Date(date).toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric",
        }
    );
};

const formatDateTime = (date) => {
    if (!date) {
        return "";
    }

    return new Date(date).toLocaleString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }
    );
};

// LeadDetailsPage component displays detailed information about a specific lead, including contact information, general notes, interaction notes, and an activity timeline. It allows users to add new notes and edit lead details through a modal. The component fetches lead details from the Redux store and handles loading states and errors appropriately.
function LeadDetailsPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { leadId } = useParams();

    const [newNote, setNewNote] = useState("");
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingNoteContent, setEditingNoteContent] = useState("");
    const [isEditModalOpen, setIsEditModalOpen,] = useState(false);

    const {
        lead,
        notes,
        activities,
        isLoading,
        isNoteSaving,
        error: detailsError,
    } = useSelector((state) => state.leadDetails);

    const { isSavingLead, error: crmError, } = useSelector((state) => state.crm);

    const { user } = useSelector((state) => state.auth);

    useEffect(() => {
        dispatch(fetchLeadDetails(leadId));
        return () => {
            dispatch(clearLeadDetails());
        };
    }, [dispatch, leadId]);

    // Handle adding a new note for the lead
    const handleAddNote = async (event) => {
        event.preventDefault();
        const content = newNote.trim();

        if (!content) {
            return;
        }

        try {
            await dispatch(createLeadNote({
                leadId,
                content,
            })).unwrap();

            setNewNote("");
        } catch {
            // Redux displays the API error.
        }
    };

    // Start editing an existing note by setting the editing state
    const startEditingNote = (note) => {
        setEditingNoteId(note._id);
        setEditingNoteContent(note.content);
    };

    // Cancel editing a note by resetting the editing state
    const cancelEditingNote = () => {
        setEditingNoteId(null);
        setEditingNoteContent("");
    };

    // Handle updating an existing note for the lead
    const handleUpdateNote = async (event) => {
        event.preventDefault();

        const content = editingNoteContent.trim();

        if (!content || !editingNoteId) {
            return;
        }

        try {
            await dispatch(updateLeadNote({
                leadId,
                noteId: editingNoteId,
                content,
            })).unwrap();

            cancelEditingNote();
        } catch {
            // Redux displays the API error.
        }
    };

    // Handle deleting an existing note for the lead after user confirmation
    const handleDeleteNote = async (note) => {
        const shouldDelete = window.confirm("Delete this note?");

        if (!shouldDelete) {
            return;
        }

        try {
            await dispatch(deleteLeadNote({
                leadId,
                noteId: note._id,
            })).unwrap();

            if (editingNoteId === note._id) {
                cancelEditingNote();
            }
        } catch {
            // Redux displays the API error.
        }
    };

    // Handle saving updated lead details
    const handleSaveLead = async (leadData) => {
        try {
            await dispatch(updateLead({
                id: leadId,
                leadData,
            })).unwrap();

            setIsEditModalOpen(false);

            await dispatch(fetchLeadDetails(leadId)).unwrap();
        } catch {
            // Redux displays the API error.
        }
    };

    // Handle deleting the lead after user confirmation
    const handleDeleteLead = async () => {
        const shouldDelete = window.confirm(`Delete the lead "${lead.name}"?`);

        if (!shouldDelete) {
            return;
        }

        try {
            await dispatch(deleteLead(leadId)).unwrap();

            navigate("/dashboard");
        } catch {
            // Redux displays the API error.
        }
    };

    // Render loading state if lead details are being fetched and no lead data is available
    if (isLoading && !lead) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100">
                <p className="text-slate-500">
                    Loading lead details...
                </p>
            </div>
        );
    }

    // Render error state if lead details could not be fetched and no lead data is available
    if (!lead) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
                <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 text-center shadow-sm">
                    <h1 className="text-xl font-bold text-slate-900">
                        Lead unavailable
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        {detailsError || "This lead could not be found."}
                    </p>

                    <button type="button" onClick={() => navigate("/dashboard")}
                        className="mt-6 cursor-pointer rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800"
                    >
                        Return to dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
                    <button type="button" onClick={() => navigate("/dashboard")}
                        className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-700"
                    >
                        <ArrowLeft size={18} />
                        Back to dashboard
                    </button>

                    <div className="flex items-center gap-3">
                        <img src="/leadflow-logo.svg" alt="LeadFlow logo" className="h-9 w-9" />

                        <span className="hidden font-bold text-slate-900 sm:inline">
                            LeadFlow
                        </span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-5 py-8">
                {(detailsError || crmError) && (
                    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {detailsError || crmError}
                    </div>
                )}

                <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-3xl font-bold text-slate-900">
                                {lead.name}
                            </h1>

                            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyles[lead.status] || "bg-slate-200 text-slate-700"}`}>
                                {lead.status}
                            </span>
                        </div>

                        <p className="mt-2 text-slate-500">
                            Lead created{" "}
                            {formatDate(lead.createdAt)}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <button type="button" onClick={handleDeleteLead} disabled={isSavingLead}
                            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Trash2 size={17} />
                            Delete lead
                        </button>

                        <button type="button" onClick={() => setIsEditModalOpen(true)} disabled={isSavingLead}
                            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Pencil size={17} />
                            Edit lead
                        </button>
                    </div>
                </section>

                <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_1.25fr]">
                    <div className="space-y-6">
                        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900">
                                Lead information
                            </h2>

                            <div className="mt-5 space-y-5">
                                <div className="flex items-start gap-3">
                                    <Phone size={19} className="mt-0.5 text-slate-400" />

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                            Phone
                                        </p>

                                        <a href={`tel:${lead.phone}`} className="mt-1 block text-sm font-medium text-slate-700 hover:text-blue-700">
                                            {lead.phone}
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Mail size={19} className="mt-0.5 text-slate-400" />

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                            Email
                                        </p>

                                        {lead.email ? (
                                            <a href={`mailto:${lead.email}`} className="mt-1 block break-all text-sm font-medium text-slate-700 hover:text-blue-700"
                                            >
                                                {lead.email}
                                            </a>
                                        ) : (
                                            <p className="mt-1 text-sm text-slate-500">
                                                No email provided
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <MapPin size={19} className="mt-0.5 text-slate-400" />

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                            Source
                                        </p>

                                        <p className="mt-1 text-sm font-medium text-slate-700">
                                            {lead.source}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <CalendarDays size={19} className="mt-0.5 text-slate-400" />

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                            Next follow-up
                                        </p>

                                        <p className="mt-1 text-sm font-medium text-slate-700">
                                            {formatDate(lead.nextFollowUp)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <UserRound size={19} className="mt-0.5 text-slate-400" />

                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                            Assigned to
                                        </p>

                                        <p className="mt-1 text-sm font-medium text-slate-700">
                                            {lead.assignedTo?.name || "Unassigned"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900">
                                General information
                            </h2>

                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                {lead.notes || "No general information has been added."}
                            </p>
                        </section>

                        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Notes
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Add dated updates and interaction
                                    details.
                                </p>
                            </div>

                            <form onSubmit={handleAddNote} className="mt-5">
                                <textarea value={newNote} onChange={(event) => setNewNote(event.target.value)}
                                    maxLength="2000" rows="4" placeholder="Write a note about this lead..." className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />

                                <div className="mt-3 flex items-center justify-between gap-4">
                                    <p className="text-xs text-slate-400">
                                        {newNote.length}/2000
                                    </p>

                                    <button type="submit" disabled={isNoteSaving || !newNote.trim()}
                                        className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Plus size={17} />

                                        {isNoteSaving ? "Adding..." : "Add note"}
                                    </button>
                                </div>
                            </form>

                            <div className="mt-6 space-y-4">
                                {notes.length === 0 ? (
                                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                                        No interaction notes yet.
                                    </p>
                                ) : (
                                    notes.map((note) => {
                                        const isEditing = editingNoteId === note._id;

                                        const userCanModify = canModifyNote(user, note);

                                        return (
                                            <article key={note._id} className="rounded-lg border border-slate-200 p-4" >
                                                {isEditing ? (
                                                    <form onSubmit={handleUpdateNote} >
                                                        <textarea value={editingNoteContent} onChange={(event) =>
                                                            setEditingNoteContent(event.target.value)
                                                        } maxLength="2000" rows="4" className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />

                                                        <div className="mt-3 flex justify-end gap-2">
                                                            <button type="button" onClick={cancelEditingNote} disabled={isNoteSaving} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60" >
                                                                <X size={16} />
                                                                Cancel
                                                            </button>

                                                            <button type="submit" disabled={isNoteSaving || !editingNoteContent.trim()} className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60" >
                                                                <Save size={16} />

                                                                {isNoteSaving ? "Saving..." : "Save"}
                                                            </button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <>
                                                        <div className="flex items-start justify-between gap-4">
                                                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                                                {note.content}
                                                            </p>

                                                            {userCanModify && (
                                                                <div className="flex shrink-0 gap-1">
                                                                    <button type="button" onClick={() => startEditingNote(note)} disabled={isNoteSaving} title="Edit note"
                                                                        className="cursor-pointer rounded-lg p-2 text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                                    >
                                                                        <Pencil size={15} />
                                                                    </button>

                                                                    <button type="button" onClick={() => handleDeleteNote(note)} disabled={isNoteSaving} title="Delete note"
                                                                        className="cursor-pointer rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                                            <span className="font-medium text-slate-500">
                                                                {note.author?.name || "Unknown user"}
                                                            </span>

                                                            <span>•</span>

                                                            <span>
                                                                {formatDateTime(note.createdAt)}
                                                            </span>

                                                            {note.editedAt && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>Edited</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </article>
                                        );
                                    })
                                )}
                            </div>
                        </section>
                    </div>

                    <section className="h-fit rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Activity timeline
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Recent changes made to this lead.
                            </p>
                        </div>

                        <div className="mt-6">
                            {activities.length === 0 ? (
                                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                                    No activities recorded yet.
                                </p>
                            ) : (
                                <div className="space-y-0">
                                    {
                                        activities.map((activity, index) => {
                                            const config = activityStyles[activity.type] || {
                                                icon: Clock3,
                                                style: "bg-slate-100 text-slate-600",
                                            };

                                            const ActivityIcon = config.icon;

                                            return (
                                                <article key={activity._id} className="relative flex gap-4 pb-7" >
                                                    {index !== activities.length - 1 && (
                                                        <div className="absolute left-[17px] top-9 h-[calc(100%-20px)] w-px bg-slate-200" />
                                                    )}

                                                    <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.style}`} >
                                                        <ActivityIcon size={17} />
                                                    </div>

                                                    <div className="pt-0.5">
                                                        <p className="text-sm font-medium text-slate-700">
                                                            {activity.description}
                                                        </p>

                                                        <p className="mt-1 text-xs text-slate-400">
                                                            {activity.performedBy?.name || "Unknown user"}
                                                            {" • "}
                                                            {formatDateTime(activity.createdAt)}
                                                        </p>
                                                    </div>
                                                </article>
                                            );
                                        }
                                        )
                                    }
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>

            <LeadModal
                isOpen={isEditModalOpen}
                lead={lead}
                isSaving={isSavingLead}
                error={crmError}
                onClose={() => {
                    if (!isSavingLead) {
                        setIsEditModalOpen(false);
                    }
                }}
                onSave={handleSaveLead}
            />
        </div>
    );
}

export default LeadDetailsPage;
