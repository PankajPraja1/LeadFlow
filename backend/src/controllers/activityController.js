const Activity = require("../models/Activity");
const { isValidLeadId, buildLeadAccessFilter, } = require("../utils/leadAccess");
const Lead = require("../models/Lead");

// Get activities for a specific lead
const getLeadActivities = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidLeadId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid lead ID",
            });
        }

        const accessibleLead = await Lead.findOne(buildLeadAccessFilter(req.user, id)).select("_id");

        if (!accessibleLead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found or access denied",
            });
        }

        const activities = await Activity.find({ lead: accessibleLead._id, }).populate("performedBy", "name email systemRole").sort({ createdAt: -1, }).limit(100);

        return res.status(200).json({
            success: true,
            count: activities.length,
            activities,
        });
    } catch (error) {
        console.error("Get activities error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve activities",
        });
    }
};

module.exports = {
    getLeadActivities,
};
