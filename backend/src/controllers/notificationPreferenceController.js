const service = require("../services/notificationPreferenceService");

const handle = (operation, message) => async (req, res) => {
    try {
        if (Object.keys(req.query).length) {
            return res.status(400).json({
                success: false,
                message: "This endpoint does not accept query parameters",
            });
        }

        const preferences = await operation({
            user: req.user,
            body: req.body,
        });

        return res.status(200).json({
            success: true,
            ...(message && { message }),
            preferences,
        });
    } catch (error) {
        let status = error.statusCode;
        let failureMessage = error.message;

        if (error.name === "ValidationError") {
            status = 400;
            failureMessage = Object.values(error.errors)[0]?.message || "Invalid settings";
        } else if (error.name === "CastError") {
            status = 400;
            failureMessage = "Invalid settings";
        } else if (
            ["VersionError", "DocumentNotFoundError"].includes(error.name)
        ) {
            status = 409;
            failureMessage = "These settings changed. Refresh them before saving again.";
        }

        if (![400, 401, 403, 409, 503].includes(status)) {
            console.error("Notification preferences failed:", {
                name: error.name,
                code: error.code,
            });

            status = 500;
            failureMessage = "Unable to process notification preferences";
        }

        return res.status(status).json({
            success: false,
            ...(status === 409 && { code: "PREFERENCES_CONFLICT" }),
            message: failureMessage,
        });
    }
};

module.exports = {
    getPreferences: handle(service.getPreferences),
    updatePreferences: handle(service.updatePreferences, "Notification settings saved"),
};