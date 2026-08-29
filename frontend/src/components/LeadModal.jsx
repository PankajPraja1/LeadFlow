import { useEffect, useState } from "react";

import { X } from "lucide-react";

const emptyForm = {
    name: "",
    email: "",
    phone: "",
    source: "Other",
    status: "new",
    notes: "",
    nextFollowUp: "",
};

function LeadModal({
    isOpen,
    lead,
    isSaving,
    error,
    onClose,
    onSave,
}) {
    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => {
        if (lead) {
            setFormData({
                name: lead.name || "",
                email: lead.email || "",
                phone: lead.phone || "",
                source: lead.source || "Other",
                status: lead.status || "new",
                notes: lead.notes || "",
                nextFollowUp: lead.nextFollowUp ? lead.nextFollowUp.split("T")[0] : "",
            });
        } else {
            setFormData(emptyForm);
        }
    }, [lead, isOpen]);

    if (!isOpen) {
        return null;
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
        await onSave({
            ...formData,
            nextFollowUp: formData.nextFollowUp || null,
        });
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
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {error}
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
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Next follow-up
                            </label>

                            <input
                                name="nextFollowUp"
                                type="date"
                                value={formData.nextFollowUp}
                                onChange={handleChange}
                                className="cursor-pointer w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500"
                            />
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
