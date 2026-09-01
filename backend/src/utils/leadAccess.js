const mongoose = require("mongoose");

// Utility functions for lead access control
const hasTeamAccess = (user) => {
    return ["admin", "leader"].includes(user.systemRole);
};

// Validate if the provided leadId is a valid MongoDB ObjectId
const isValidLeadId = (leadId) => {
    return mongoose.Types.ObjectId.isValid(leadId);
};

// Build a filter for lead access based on user role and leadId
const buildLeadAccessFilter = (user, leadId) => {
    const filter = {
        _id: leadId,
    };

    if (!hasTeamAccess(user)) {
        filter.assignedTo = user._id;
    }

    return filter;
};

module.exports = {
    hasTeamAccess,
    isValidLeadId,
    buildLeadAccessFilter,
};
