const mongoose = require("mongoose");

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

activitySchema.index({
    lead: 1,
    createdAt: -1,
});

activitySchema.index({
    performedBy: 1,
    createdAt: -1,
});

const Activity = mongoose.model("Activity", activitySchema);

module.exports = Activity;
