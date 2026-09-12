const Activity = require("../models/Activity");

// Service function to record an activity related to a lead
const recordActivity = async ({
    leadId,
    userId,
    taskId = null,
    type,
    description,
    changes = null,
    session = null,
    failOnError = false,
}) => {
    try {
        const activity = new Activity({
            lead: leadId,
            performedBy: userId,
            task: taskId,
            type,
            description,
            changes,
        });

        return await activity.save(session ? { session } : {});
    } catch (error) {
        // Let the caller abort/retry the whole transaction when this write fails.
        if (session || failOnError) {
            throw error;
        }

        // Preserve best-effort logging for existing callers without a session.
        console.error("Activity recording error:", {
            name: error.name,
            code: error.code,
        });
        return null;
    }
};

module.exports = { recordActivity };