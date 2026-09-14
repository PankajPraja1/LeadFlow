import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore, } from "react-redux";

import { cancelTask, completeTask, createTask, updateTask, } from "../../features/tasks/taskSlice";

const titles = {
    create: "New personal task",
    edit: "Edit task",
    complete: "Complete task",
    cancel: "Cancel task",
    schedule: "Schedule lead follow-up",
};

const buttonLabels = {
    create: "Create task",
    edit: "Save changes",
    complete: "Mark completed",
    cancel: "Confirm cancellation",
    schedule: "Schedule follow-up",
};

const inputClass = "mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

function localInput(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const pad = (part) => String(part).padStart(2, "0");

    return `${String(date.getFullYear()).padStart(4, "0")}-${pad(
        date.getMonth() + 1
    )}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
        date.getMinutes()
    )}`;
}

function utcDate(value) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime()) || localInput(date) !== value) {
        throw new Error("Choose a valid local date and time.");
    }

    return date.toISOString();
}

function TaskActionDialog({
    mode,
    task,
    lead,
    sessionKey,
    onClose,
    onSaved,
    focusReturnId = "tasks-heading", }) {

    const dispatch = useDispatch();
    const store = useStore();

    const busy = useSelector((state) => state.tasks.mutationStatus === "loading");

    const dialogRef = useRef(null);
    const aliveRef = useRef(false);
    const submittingRef = useRef(false);

    const [error, setError] = useState("");
    const [mustReopen, setMustReopen] = useState(false);

    const isScheduling = mode === "schedule";
    const isCreating = mode === "create" || isScheduling;

    const [form, setForm] = useState(() => ({
        title: task?.title ||
            (isScheduling ? `Follow up with ${lead?.name || "lead"}` : ""),
        description: task?.description || "",
        dueAt: localInput(task?.dueAt),
        completionNote: "",
    }));

    const editingFields = isCreating || mode === "edit";

    const isFollowUp = isScheduling || task?.kind === "follow_up";

    useEffect(() => {
        aliveRef.current = true;

        const dialog = dialogRef.current;
        const opener = document.activeElement;
        const previousOverflow = document.body.style.overflow;

        if (!dialog.open) dialog.showModal();

        document.body.style.overflow = "hidden";

        dialog.querySelector("input, textarea, button")?.focus();

        return () => {
            aliveRef.current = false;

            if (dialog.open) dialog.close();

            document.body.style.overflow = previousOverflow;

            const target = opener?.isConnected
                ? opener : document.getElementById(focusReturnId);

            target?.focus({ preventScroll: true });
        };
    }, [focusReturnId]);

    const sameSession = () => {
        const auth = store.getState().auth;

        return (sessionKey === JSON.stringify([
            auth.token,
            auth.user?.id ?? auth.user?._id,
            auth.user?.systemRole,
        ]) &&
            auth.user?.isActive !== false &&
            auth.user?.isEmailVerified === true
        );
    };

    const close = () => {
        if (!busy && !submittingRef.current) {
            onClose();
        }
    };

    const change = (event) => {
        const { name, value } = event.target;

        setForm((current) => ({
            ...current,
            [name]: value,
        }));

        setError("");
    };

    const submit = async (event) => {
        event.preventDefault();

        if (busy || submittingRef.current || mustReopen || !sameSession()) {
            return;
        }

        let operation;

        try {
            if (isScheduling && !/^[a-f\d]{24}$/i.test(lead?._id || "")) {
                throw new Error("Close this form and reopen it from the lead's details page.");
            }

            if (!isCreating &&
                (
                    task?.status !== "pending" ||
                    !Number.isSafeInteger(task?.version)
                )
            ) {
                throw new Error("Close this form and reopen the current pending task.");
            }

            if (editingFields) {
                const fields = {
                    title: form.title.trim(),
                    description: form.description.trim(),
                };

                if (!fields.title || fields.title.length > 120) {
                    throw new Error("Enter a title containing 1–120 characters.");
                }

                if (fields.description.length > 2000) {
                    throw new Error("Description cannot exceed 2000 characters.");
                }

                if (isFollowUp && !form.dueAt) {
                    throw new Error("A lead follow-up needs a due date and time.");
                }

                // Preserve the original instant when only text changed.
                if (isCreating || form.dueAt !== localInput(task?.dueAt)) {
                    fields.dueAt = utcDate(form.dueAt);
                }

                operation = isCreating
                    ? createTask({
                        ...fields,
                        kind: isScheduling ? "follow_up" : "personal",
                        ...(isScheduling && {
                            leadId: lead._id,
                        }),
                    })
                    : updateTask({
                        id: task._id,
                        version: task.version,
                        changes: fields,
                    });
            } else if (mode === "complete") {
                const completionNote = form.completionNote.trim();

                if (completionNote.length > 1000) {
                    throw new Error("Outcome cannot exceed 1000 characters.");
                }

                operation = completeTask({
                    id: task._id,
                    version: task.version,
                    completionNote,
                });
            } else if (mode === "cancel") {
                operation = cancelTask({
                    id: task._id,
                    version: task.version,
                });
            } else {
                throw new Error("Unknown task action.");
            }
        } catch (validationError) {
            setError(validationError.message);
            return;
        }

        submittingRef.current = true;
        setError("");

        try {
            const result = await dispatch(operation).unwrap();

            if (aliveRef.current && sameSession()) {
                onSaved(result.task);
            }
        } catch (requestError) {
            if (!aliveRef.current || !sameSession()) return;

            const status = requestError?.status;
            const message = requestError?.message || "Unable to save this change.";

            setMustReopen(status !== 400);

            setError(status === 409
                ? `${message} Close this form and reopen the task to review its latest details.`
                : status == null || status >= 500
                    ? "The result could not be confirmed. Close this form and refresh the list before trying again; the change may already have saved."
                    : message
            );
        } finally {
            submittingRef.current = false;
        }
    };

    return (
        <dialog ref={dialogRef} aria-labelledby="task-dialog-title"
            onCancel={(event) => {
                event.preventDefault();
                close();
            }}
            className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/50"
        >
            <h2 id="task-dialog-title" className="text-xl font-bold" >
                {titles[mode]}
            </h2>

            {isScheduling && (
                <p className="mt-2 break-words text-sm text-slate-600">
                    Lead: {lead?.name}
                </p>
            )}

            {task && (
                <p className="mt-2 break-words text-sm text-slate-600">
                    {task.title}
                </p>
            )}

            {error && (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" >
                    {error}
                </p>
            )}

            <form onSubmit={submit} className="mt-5 space-y-5" aria-busy={busy} >
                <fieldset disabled={busy || mustReopen} className="space-y-4 disabled:opacity-60" >
                    {editingFields && (
                        <>
                            <div>
                                <label htmlFor="task-title" className="text-sm font-medium" >
                                    Title
                                </label>

                                <input id="task-title" name="title" value={form.title} onChange={change} required maxLength={120} className={inputClass} />
                            </div>

                            <div>
                                <label htmlFor="task-description" className="text-sm font-medium" >
                                    Description (optional)
                                </label>

                                <textarea id="task-description" name="description" value={form.description} onChange={change} rows={3} maxLength={2000} className={inputClass} />
                            </div>

                            <div>
                                <label htmlFor="task-due" className="text-sm font-medium" >
                                    Due date and time
                                    {isFollowUp ? "" : " (optional)"}
                                </label>

                                <input id="task-due" name="dueAt" type="datetime-local" step="60" value={form.dueAt} onChange={change} required={isFollowUp} className={inputClass} />

                                <p className="mt-2 text-xs text-slate-500">
                                    Use your local date and time.
                                </p>
                            </div>
                        </>
                    )}

                    {mode === "complete" && (
                        <div>
                            <label htmlFor="task-outcome" className="text-sm font-medium" >
                                Outcome (optional)
                            </label>

                            <textarea id="task-outcome" name="completionNote" value={form.completionNote} onChange={change} rows={3} maxLength={1000} className={inputClass} placeholder="What did you finish or learn?" />

                            <p className="mt-2 text-sm text-slate-500">
                                The completion time will be recorded when you confirm.
                            </p>
                        </div>
                    )}

                    {mode === "cancel" && (
                        <p className="text-sm text-slate-600">
                            This task will move to Cancelled and remain in your history.
                        </p>
                    )}
                </fieldset>

                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
                    <button type="button" onClick={close} disabled={busy}
                        className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Close
                    </button>

                    <button type="submit" disabled={busy || mustReopen}
                        className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {busy ? "Saving..." : buttonLabels[mode]}
                    </button>
                </div>
            </form>
        </dialog>
    );
}

export default TaskActionDialog;