const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
        },

        type: {
            type: String,
            enum: ["task_reminder"],
            required: true,
            default: "task_reminder",
            immutable: true,
        },

        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: true,
            immutable: true,
        },

        taskDueAt: {
            type: Date,
            required: true,
            immutable: true,
        },

        taskReminderRevision: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
            immutable: true,
            select: false,
            validate: {
                validator: Number.isSafeInteger,
                message: "Task reminder revision must be a safe integer",
            },
        },

        scheduledFor: {
            type: Date,
            required: true,
            immutable: true,
        },

        eventKey: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160,
            immutable: true,
            select: false,
        },

        readAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_document, result) => {
                delete result.eventKey;
                delete result.taskReminderRevision;
                return result;
            },
        },
    }
);

notificationSchema.pre("validate", function () {
    if (this.scheduledFor && this.taskDueAt && this.scheduledFor > this.taskDueAt) {
        this.invalidate("scheduledFor", "The reminder time must be at or before the task due date");
    }
});

notificationSchema.index(
    { recipient: 1, eventKey: 1 },
    { unique: true }
);

notificationSchema.index({
    recipient: 1,
    createdAt: -1,
    _id: -1,
});

notificationSchema.index({
    recipient: 1,
    readAt: 1,
    createdAt: -1,
    _id: -1,
});

module.exports = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
