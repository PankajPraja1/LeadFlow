const Activity = require("../models/Activity");

// Service function to record an activity related to a lead
const recordActivity = async ({
    leadId,
    userId,
    type,
    description,
    changes = null,
}) => {
    try {
        return await Activity.create({
            lead: leadId,
            performedBy: userId,
            type,
            description,
            changes,
        });
    } catch (error) {
        console.error("Activity recording error:", error);

        return null;
    }
};

module.exports = {
    recordActivity,
};
