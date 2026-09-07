const mongoose = require("mongoose");

// Define the Plan schema
const planSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Plan name is required"],
            trim: true,
            maxlength: [80, "Plan name cannot exceed 80 characters"],
        },

        description: {
            type: String,
            required: [true, "Plan description is required"],
            trim: true,
            maxlength: [1000, "Description cannot exceed 1000 characters"],
        },

        targetAudience: {
            type: String,
            trim: true,
            maxlength: [300, "Target audience cannot exceed 300 characters"],
            default: "",
        },

        pitch: {
            type: String,
            trim: true,
            maxlength: [2000, "Marketing pitch cannot exceed 2000 characters"],
            default: "",
        },

        followUpSteps: [
            {
                type: String,
                trim: true,
                maxlength: [300, "A follow-up step cannot exceed 300 characters"],
            },
        ],

        status: {
            type: String,
            enum: ["draft", "active", "archived"],
            default: "draft",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

planSchema.index({
    status: 1,
    createdAt: -1,
});

planSchema.index({
    name: "text",
    description: "text",
    targetAudience: "text",
});

module.exports = mongoose.model("Plan", planSchema);
