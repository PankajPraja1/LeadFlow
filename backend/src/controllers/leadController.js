const Lead = require("../models/Lead");
const Activity = require("../models/Activity");
const LeadNote = require("../models/LeadNote");

const { recordActivity, } = require("../services/activityService");

const { hasTeamAccess, isValidLeadId, buildLeadAccessFilter, } = require("../utils/leadAccess");

// Utility functions and constants for lead management
const allowedUpdateFields = [
  "name",
  "email",
  "phone",
  "source",
  "status",
  "notes",
  "nextFollowUp",
];

const fieldLabels = {
  name: "name",
  email: "email",
  phone: "phone number",
  source: "source",
  notes: "general notes",
};

const formatStatus = (status) => {
  if (!status) {
    return "None";
  }

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1)
  );
};

const serializeValue = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === undefined) {
    return null;
  }

  return value;
};

const sendValidationError = (error, res) => {
  const messages = Object.values(error.errors).map((item) => item.message);

  return res.status(400).json({
    success: false,
    message: messages[0] || "Validation failed",
    errors: messages,
  });
};

// Create lead ...
const createLead = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      source,
      status,
      notes,
      nextFollowUp,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Lead name and phone number are required",
      });
    }

    const lead = await Lead.create({
      name,
      email,
      phone,
      source,
      status,
      notes,
      nextFollowUp,
      assignedTo: req.user._id,
      createdBy: req.user._id,
    });

    await recordActivity({
      leadId: lead._id,
      userId: req.user._id,
      type: "lead_created",
      description: `Created lead ${lead.name}`,
      changes: {
        status: {
          from: null,
          to: lead.status,
        },
      },
    });

    await lead.populate([
      {
        path: "assignedTo",
        select: "name email systemRole",
      },
      {
        path: "createdBy",
        select: "name email systemRole",
      },
    ]);

    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead,
    });
  } catch (error) {
    console.error("Create lead error:", error);

    if (error.name === "ValidationError") {
      return sendValidationError(error, res);
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create lead",
    });
  }
};

// Get all accessible leads 
const getLeads = async (req, res) => {
  try {
    const { status, search } = req.query;

    const filter = {};

    if (!hasTeamAccess(req.user)) {
      filter.assignedTo = req.user._id;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const leads = await Lead.find(filter).populate("assignedTo", "name email systemRole").sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: leads.length,
      leads,
    });
  } catch (error) {
    console.error("Get leads error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve leads",
    });
  }
};

// Get one accessible lead
const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidLeadId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    const filter = buildLeadAccessFilter(req.user, id);

    const lead = await Lead.findOne(filter).populate("assignedTo", "name email systemRole").populate("createdBy", "name email systemRole");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      lead,
    });
  } catch (error) {
    console.error("Get lead details error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve lead details",
    });
  }
};

// Update accessible lead
const updateLead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidLeadId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    const filter = buildLeadAccessFilter(req.user, id);

    const lead = await Lead.findOne(filter);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or access denied",
      });
    }

    const changes = {};

    allowedUpdateFields.forEach((field) => {
      if (req.body[field] === undefined) {
        return;
      }

      const previousValue = serializeValue(lead.get(field));

      lead.set(field, req.body[field]);

      const nextValue = serializeValue(lead.get(field));

      if (JSON.stringify(previousValue) !== JSON.stringify(nextValue)) {
        changes[field] = {
          from: previousValue,
          to: nextValue,
        };
      }
    });

    await lead.save();

    const activityPromises = [];

    if (changes.status) {
      activityPromises.push(recordActivity({
        leadId: lead._id,
        userId: req.user._id,
        type: "status_changed",
        description: `Changed status from ` + `${formatStatus(changes.status.from)} to ` + `${formatStatus(changes.status.to)}`,
        changes: {
          status: changes.status,
        },
      })
      );
    }

    if (changes.nextFollowUp) {
      const hasNewFollowUp = changes.nextFollowUp.to !== null;

      activityPromises.push(recordActivity({
        leadId: lead._id,
        userId: req.user._id,
        type: "followup_updated",
        description: hasNewFollowUp ? "Updated the follow-up date" : "Cleared the follow-up date",
        changes: {
          nextFollowUp: changes.nextFollowUp,
        },
      }));
    }

    const generalChanges = Object.fromEntries(Object.entries(changes).filter(([field]) => ![
      "status",
      "nextFollowUp",
    ].includes(field)));

    const generalFields = Object.keys(generalChanges);

    if (generalFields.length > 0) {
      const labels = generalFields.map((field) => fieldLabels[field] || field);

      activityPromises.push(recordActivity({
        leadId: lead._id,
        userId: req.user._id,
        type: "lead_updated",
        description: `Updated ${labels.join(", ")}`,
        changes: generalChanges,
      }));
    }

    await Promise.all(activityPromises);

    await lead.populate([
      {
        path: "assignedTo",
        select: "name email systemRole",
      },
      {
        path: "createdBy",
        select: "name email systemRole",
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead,
    });
  } catch (error) {
    console.error("Update lead error:", error);

    if (error.name === "ValidationError") {
      return sendValidationError(error, res);
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update lead",
    });
  }
};

// Delete accessible lead
const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidLeadId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    const filter = buildLeadAccessFilter(req.user, id);

    const lead = await Lead.findOneAndDelete(filter);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or access denied",
      });
    }

    await Promise.all([
      Activity.deleteMany({
        lead: lead._id,
      }),
      LeadNote.deleteMany({
        lead: lead._id,
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    console.error("Delete lead error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete lead",
    });
  }
};

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
};
