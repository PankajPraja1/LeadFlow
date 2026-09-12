const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Task title is required"],
            trim: true,
            maxlength: [120, "Title cannot exceed 120 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [2000, "Description cannot exceed 2000 characters"],
            default: "",
        },
        kind: {
            type: String,
            enum: ["personal", "follow_up"],
            required: true,
            immutable: true,
        },
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
            default: null,
            immutable: true,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
        },
        dueAt: {
            type: Date,
            default: null,
        },
        status: {
            type: String,
            enum: ["pending", "completed", "cancelled"],
            default: "pending",
            required: true,
        },
        completedAt: {
            type: Date,
            default: null,
        },
        completionNote: {
            type: String,
            trim: true,
            maxlength: [1000, "Completion note cannot exceed 1000 characters"],
            default: "",
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        // Set only by the future migration of Lead.nextFollowUp.
        legacyImported: {
            type: Boolean,
            default: false,
            immutable: true,
            select: false,
        },
    },
    {
        timestamps: true,
        optimisticConcurrency: true,
        toJSON: {
            transform: (_document, result) => {
                delete result.legacyImported;
                return result;
            },
        },
    }
);

taskSchema.pre("validate", function () {
    if (this.kind === "follow_up") {
        if (!this.lead) {
            this.invalidate("lead", "A follow-up must be linked to a lead");
        }
        if (!this.dueAt) {
            this.invalidate("dueAt", "A follow-up must have a due date");
        }
    }

    if (this.kind === "personal" && this.lead) {
        this.invalidate("lead", "A personal task cannot be linked to a lead");
    }

    if (this.status === "completed" && !this.completedAt) {
        this.invalidate("completedAt", "A completed task needs a completion time");
    }
    if (this.status !== "completed" && this.completedAt) {
        this.invalidate("completedAt", "Only completed tasks have a completion time");
    }
    if (this.status !== "completed" && this.completionNote) {
        this.invalidate("completionNote", "Complete the task before saving its outcome");
    }

    if (this.status === "cancelled" && !this.cancelledAt) {
        this.invalidate("cancelledAt", "A cancelled task needs a cancellation time");
    }
    if (this.status !== "cancelled" && this.cancelledAt) {
        this.invalidate("cancelledAt", "Only cancelled tasks have a cancellation time");
    }

    if (this.legacyImported && this.kind !== "follow_up") {
        this.invalidate("legacyImported", "Only lead follow-ups can be imported");
    }
});

taskSchema.index({ assignedTo: 1, status: 1, dueAt: 1 });
taskSchema.index({ assignedTo: 1, status: 1, completedAt: -1 });
taskSchema.index({ lead: 1, status: 1, dueAt: 1 });

// One imported record per lead; ordinary follow-ups are not restricted by this index.
taskSchema.index(
    { lead: 1 },
    {
        name: "one_imported_follow_up_per_lead",
        unique: true,
        partialFilterExpression: { legacyImported: true },
    }
);

module.exports = mongoose.models.Task || mongoose.model("Task", taskSchema);