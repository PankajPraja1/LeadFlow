import { useState } from "react";
import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import { createPlan, updatePlan, } from "../../features/plans/planSlice";

const emptyForm = {
    name: "",
    description: "",
    targetAudience: "",
    pitch: "",
    followUpSteps: "",
    status: "draft",
};

const getInitialForm = (plan) => {
    if (!plan) {
        return { ...emptyForm };
    }

    return {
        name: plan.name || "",
        description: plan.description || "",
        targetAudience: plan.targetAudience || "",
        pitch: plan.pitch || "",
        followUpSteps:
            plan.followUpSteps?.join("\n") || "",
        status: plan.status || "draft",
    };
};

// PlanFormModal component
function PlanFormModal({ isOpen, onClose, plan = null, }) {
    const dispatch = useDispatch();

    const { isSubmitting } = useSelector((state) => state.plans);

    const [formData, setFormData] = useState(
        () => getInitialForm(plan)
    );
    const [localError, setLocalError] = useState("");

    const isEditing = Boolean(plan);

    if (!isOpen) return null;

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((current) => ({
            ...current,
            [name]: value,
        }));

        setLocalError("");
    }; // Handle input changes

    // Handle form submission
    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!formData.name.trim() || !formData.description.trim()) {
            setLocalError("Plan name and description are required");
            return;
        }

        const planData = {
            name: formData.name.trim(),
            description: formData.description.trim(),
            targetAudience: formData.targetAudience.trim(),
            pitch: formData.pitch.trim(),
            followUpSteps: formData.followUpSteps.split("\n").map((step) => step.trim()).filter(Boolean),
            status: formData.status,
        };

        try {
            if (isEditing) {
                await dispatch(updatePlan({
                    planId: plan._id,
                    planData,
                })).unwrap();
            } else {
                await dispatch(createPlan(planData)).unwrap();
            }

            onClose(true);
        } catch (error) {
            setLocalError(error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
                <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">
                            {isEditing ? "Edit marketing plan" : "Create marketing plan"}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Build a reusable plan for lead conversion.
                        </p>
                    </div>

                    <button type="button" onClick={() => onClose(false)} disabled={isSubmitting} className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close plan form">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-6">
                    {localError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {localError}
                        </div>
                    )}

                    <div>
                        <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-700">
                            Plan name
                        </label>

                        <input id="name" name="name" value={formData.name} onChange={handleChange} required maxLength={80} placeholder="Social Media Lead Conversion"
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-700">
                            Description
                        </label>

                        <textarea id="description" name="description" value={formData.description} onChange={handleChange} required maxLength={1000} rows={3} placeholder="Explain the purpose of this plan..."
                            className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <div>
                        <label htmlFor="targetAudience" className="mb-2 block text-sm font-medium text-slate-700">
                            Target audience
                        </label>

                        <textarea id="targetAudience" name="targetAudience" value={formData.targetAudience} onChange={handleChange} maxLength={300} rows={2} placeholder="Who is this plan intended for?"
                            className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <div>
                        <label htmlFor="pitch" className="mb-2 block text-sm font-medium text-slate-700">
                            Marketing pitch
                        </label>

                        <textarea id="pitch" name="pitch" value={formData.pitch} onChange={handleChange} maxLength={2000} rows={4} placeholder="Write the recommended pitch..."
                            className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <div>
                        <label htmlFor="followUpSteps" className="mb-2 block text-sm font-medium text-slate-700">
                            Follow-up steps
                        </label>

                        <textarea id="followUpSteps" name="followUpSteps" value={formData.followUpSteps} onChange={handleChange} rows={5}
                            placeholder={"Enter one step per line\nSend introduction\nSchedule discovery call"}
                            className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />

                        <p className="mt-1 text-xs text-slate-500">
                            Enter one follow-up step per line.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="status" className="mb-2 block text-sm font-medium text-slate-700">
                            Status
                        </label>

                        <select id="status" name="status" value={formData.status} onChange={handleChange}
                            className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>

                            {isEditing && (
                                <option value="archived">
                                    Archived
                                </option>
                            )}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                        <button type="button" onClick={() => onClose(false)} disabled={isSubmitting}
                            className="cursor-pointer rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Cancel
                        </button>

                        <button type="submit" disabled={isSubmitting} className="cursor-pointer rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
                            {isSubmitting ? "Saving..." : isEditing ? "Save changes" : "Create plan"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default PlanFormModal;
