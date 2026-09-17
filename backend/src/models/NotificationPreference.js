const mongoose = require("mongoose");

const isValidTimeZone = (value) => {
    if (typeof value !== "string" || !value || /^[+-]/.test(value)) {
        return false;
    }

    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
    } catch {
        return false;
    }
};

const notificationPreferenceSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
        },

        inAppEnabled: {
            type: Boolean,
            required: true,
            default: true,
        },

        dailyEmailEnabled: {
            type: Boolean,
            required: true,
            default: false,
        },

        reminderMinutes: {
            type: Number,
            required: true,
            enum: [0, 15, 30, 60],
            default: 15,
        },

        timeZone: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
            default: "UTC",
            validate: {
                validator: isValidTimeZone,
                message: "Choose a valid time zone",
            },
        },
    },
    {
        timestamps: true,
        optimisticConcurrency: true,
    }
);

notificationPreferenceSchema.index(
    { user: 1 },
    { unique: true }
);

module.exports = mongoose.models.NotificationPreference || mongoose.model("NotificationPreference", notificationPreferenceSchema);
