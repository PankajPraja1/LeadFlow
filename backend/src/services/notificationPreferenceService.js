const mongoose = require("mongoose");
const NotificationPreference = require("../models/NotificationPreference");

const storageByDatabase = new WeakMap();

const preferenceError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const assertUser = (user) => {
    if (!mongoose.isObjectIdOrHexString(user?._id)) {
        throw preferenceError(401, "Authentication required");
    }

    if (user.isActive !== true || user.isEmailVerified !== true || !["admin", "leader", "member", "viewer"].includes(user.systemRole)) {
        throw preferenceError(403, "An active, verified account is required");
    }
};

const prepareStorage = async () => {
    const database = mongoose.connection.db;

    if (mongoose.connection.readyState !== 1 || !database) {
        throw preferenceError(503, "Database service is temporarily unavailable");
    }

    if (!storageByDatabase.has(database)) {
        const preparation = (async () => {
            await NotificationPreference.init();
            await NotificationPreference.createCollection();
            await NotificationPreference.createIndexes();
        })();

        storageByDatabase.set(database, preparation);
    }

    try {
        await storageByDatabase.get(database);
    } catch (error) {
        storageByDatabase.delete(database);
        throw error;
    }
};

const getDocument = async (userId) => {
    await prepareStorage();

    const find = () => NotificationPreference.findOne({ user: userId }).maxTimeMS(10000);

    const existing = await find();
    if (existing) return existing;

    try {
        return await NotificationPreference.create({ user: userId });
    } catch (error) {
        // Another request may have created this user's defaults first.
        if (error.code === 11000) {
            const created = await find();
            if (created) return created;
        }

        throw error;
    }
};

const preferenceData = (document) => ({
    inAppEnabled: document.inAppEnabled,
    dailyEmailEnabled: document.dailyEmailEnabled,
    reminderMinutes: document.reminderMinutes,
    timeZone: document.timeZone,
    version: document.__v ?? 0,
});

const parseChanges = (body) => {
    const fields = [
        "inAppEnabled",
        "dailyEmailEnabled",
        "reminderMinutes",
        "timeZone",
    ];

    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw preferenceError(400, "A JSON object is required");
    }

    if (Object.keys(body).some((key) => key !== "version" && !fields.includes(key))) {
        throw preferenceError(400, "Request contains an unsupported field");
    }

    if (!Number.isSafeInteger(body.version) || body.version < 0 || body.version === Number.MAX_SAFE_INTEGER) {
        throw preferenceError(400, "Provide the settings' current version number");
    }

    const changes = {};

    for (const field of fields) {
        if (!Object.hasOwn(body, field)) continue;

        const value = body[field];

        if (field.endsWith("Enabled") && typeof value !== "boolean") {
            throw preferenceError(400, `${field} must be true or false`);
        }

        if (field === "reminderMinutes" && !Number.isSafeInteger(value)) {
            throw preferenceError(400, "reminderMinutes must be an integer");
        }

        if (field === "timeZone" && typeof value !== "string") {
            throw preferenceError(400, "timeZone must be text");
        }

        changes[field] = field === "timeZone" ? value.trim() : value;
    }

    if (!Object.keys(changes).length) {
        throw preferenceError(400, "Choose at least one setting to update");
    }

    return { version: body.version, changes };
};

const getPreferences = async ({ user }) => {
    assertUser(user);

    return preferenceData(await getDocument(user._id));
};

const updatePreferences = async ({ user, body }) => {
    assertUser(user);

    const { version, changes } = parseChanges(body);

    // Validate before creating defaults or changing stored settings.
    await new NotificationPreference({
        user: user._id,
        ...changes,
    }).validate();

    const document = await getDocument(user._id);

    if ((document.__v ?? 0) !== version) {
        throw preferenceError(409, "These settings changed. Refresh them before saving again.");
    }

    for (const [field, value] of Object.entries(changes)) {
        document.set(field, value);

        // Same-value saves also consume a version and check concurrent edits.
        document.markModified(field);
    }

    await document.save();

    return preferenceData(document);
};

module.exports = { getPreferences, updatePreferences, };
