import { useState } from "react";

import { X } from "lucide-react";

const getInitialFormData = (lead) => ({
    name: lead?.name || "",
    email: lead?.email || "",
    phone: lead?.phone || "",
    source: lead?.source || "Other",
    status: lead?.status || "new",
    notes: lead?.notes || "",
    nextFollowUp: "",
});

function LeadModal(props) {
    if (!props.isOpen) return null;

    return (
        <LeadForm
            key={props.lead?._id || props.lead?.id || "create"}
            {...props}
        />
    );
}

function LeadForm({
    lead,
    isSaving,
    error,
    onClose,
    onSave, }) {

    const [formData, setFormData] = useState(
        () => getInitialFormData(lead)
    );

    const [validationError, setValidationError] = useState("");

    const handleChange = (event) => {
        const { name, value } = event.target;

        setValidationError("");

        setFormData((currentData) => ({
            ...currentData,
            [name]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isSaving) return;

        setValidationError("");

        // Existing-lead edits contain only general lead information.
        const payload = {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            source: formData.source,
            status: formData.status,
            notes: formData.notes,
        };

        try {
            // Initial scheduling remains available when creating a lead.
            if (!lead) {
                const dueAt = formData.nextFollowUp
                    ? new Date(formData.nextFollowUp) : null;

                if (dueAt && Number.isNaN(dueAt.getTime())) {
                    setValidationError("Enter a valid follow-up date and time");
                    return;
                }

                payload.nextFollowUp = dueAt?.toISOString() ?? null;
            }

            await onSave(payload);
        } catch (saveError) {
            setValidationError(saveError?.message || "Unable to save lead");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">
                            {lead ? "Edit Lead" : "Add New Lead"}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            {lead ? "Update the lead information." : "Enter the new lead information."}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100" >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-6" >
                    {(validationError || error) && (
                        <div role="alert"
                            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                        >
                            {validationError || error}
                        </div>
                    )}

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Name *
                            </label>

                            <input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Phone *
                            </label>

                            <input
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Email
                            </label>

                            <input
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Source
                            </label>

                            <select name="source" value={formData.source} onChange={handleChange} className="cursor-pointer w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-blue-500" >
                                <option value="Other">Other</option>
                                <option value="Facebook">Facebook</option>
                                <option value="Instagram">Instagram</option>
                                <option value="Website">Website</option>
                                <option value="Referral">Referral</option>
                                <option value="WhatsApp">WhatsApp</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Status
                            </label>

                            <select name="status" value={formData.status} onChange={handleChange} className="cursor-pointer w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-blue-500" >
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="qualified">Qualified</option>
                                <option value="converted">Converted</option>
                                <option value="lost">Lost</option>
                            </select>
                        </div>

                        <div>
                            {lead ? (
                                <>
                                    <p className="mb-2 text-sm font-medium text-slate-700">
                                        Next follow-up
                                    </p>

                                    <p className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                                        {lead.nextFollowUp
                                            ? new Date(lead.nextFollowUp).toLocaleString()
                                            : "Not scheduled"}
                                    </p>

                                    <p className="mt-2 text-xs text-slate-500">
                                        Follow-up dates are managed separately from lead details.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <label htmlFor="lead-first-follow-up"
                                        className="mb-2 block text-sm font-medium text-slate-700"
                                    >
                                        First follow-up (optional)
                                    </label>

                                    <input
                                        id="lead-first-follow-up"
                                        name="nextFollowUp"
                                        type="datetime-local"
                                        step="60"
                                        value={formData.nextFollowUp}
                                        onChange={handleChange}
                                        disabled={isSaving}
                                        className="cursor-pointer w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500"
                                    />

                                    <p className="mt-2 text-xs text-slate-500">
                                        Uses your device's local time.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Notes
                        </label>

                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows="4"
                            placeholder="Add notes about the lead..."
                            className="w-full resize-none rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                        <button type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50" >
                            Cancel
                        </button>

                        <button type="submit" disabled={isSaving}
                            className="cursor-pointer rounded-lg bg-blue-700 px-5 py-2.5 font-medium text-white hover:bg-blue-800 disabled:opacity-60" >
                            {isSaving ? "Saving..." : lead ? "Save Changes" : "Create Lead"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default LeadModal;
