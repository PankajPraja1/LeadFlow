const mongoose = require("mongoose");

const authRateLimitSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
        },

        scope: {
            type: String,
            required: true,
        },

        hits: {
            type: Number,
            required: true,
        },

        expiresAt: {
            type: Date,
            required: true,
        },
    },
    {
        collection: "auth_rate_limits",
        versionKey: false,
        bufferCommands: false,
        autoCreate: false,
        autoIndex: false,
    }
);

authRateLimitSchema.index(
    { expiresAt: 1 },
    {
        expireAfterSeconds: 0,
        name: "expire_auth_rate_limits",
    }
);

module.exports =
    mongoose.models.AuthRateLimit ||
    mongoose.model("AuthRateLimit", authRateLimitSchema);