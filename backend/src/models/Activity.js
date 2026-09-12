const mongoose = require("mongoose");

const FOLLOW_UP_TASK_EVENTS = [
    "followup_created",
    "followup_rescheduled",
    "followup_completed",
    "followup_cancelled",
];

// Activity model to track changes and actions performed on leads
const activitySchema = new mongoose.Schema(
    {
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
            required: true,
        },

        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            default: null,
            required: [
                function () {
                    return FOLLOW_UP_TASK_EVENTS.includes(this.type);
                },
                "A follow-up task event must reference its task",
            ],
        },

        type: {
            type: String,
            enum: [
                "lead_created",
                "lead_updated",
                "status_changed",
                "followup_updated",
                "lead_assigned",
                "note_added",
                "note_updated",
                "note_deleted",
                ...FOLLOW_UP_TASK_EVENTS,
            ],
            required: true,
        },

        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: [
                300,
                "Activity description cannot exceed 300 characters",
            ],
        },

        changes: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
    },
    {
        // Automatically add createdAt and updatedAt fields
        timestamps: true,
    }
);

activitySchema.index({ lead: 1, createdAt: -1 });
activitySchema.index({ performedBy: 1, createdAt: -1 });
activitySchema.index({ task: 1, createdAt: -1 });

module.exports = mongoose.models.Activity || mongoose.model("Activity", activitySchema);
