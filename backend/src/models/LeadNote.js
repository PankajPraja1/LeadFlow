const mongoose = require("mongoose");

// LeadNote model to store notes associated with leads
const leadNoteSchema = new mongoose.Schema(
    {
        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Lead",
            required: true,
        },

        content: {
            type: String,
            required: [
                true,
                "Note content is required",
            ],
            trim: true,
            maxlength: [
                2000,
                "Note cannot exceed 2000 characters",
            ],
        },

        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        editedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes to optimize queries for lead notes
leadNoteSchema.index({
    lead: 1,
    createdAt: -1,
});

leadNoteSchema.index({
    author: 1,
    createdAt: -1,
});

const LeadNote = mongoose.model("LeadNote", leadNoteSchema);

module.exports = LeadNote;
