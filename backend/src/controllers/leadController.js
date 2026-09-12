const Lead = require("../models/Lead");

const { hasTeamAccess, isValidLeadId, buildLeadAccessFilter, } = require("../utils/leadAccess");

const { createLeadWithFollowUp, updateLeadWithFollowUps, deleteLeadWithFollowUps, } = require("../services/leadWriteService");

const sendError = (res, error, fallback) => {
  if ([400, 401, 403, 404, 409, 503].includes(error.statusCode)) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((item) => item.message);

    return res.status(400).json({
      success: false,
      message: errors[0],
      errors,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid field value",
    });
  }

  if (error.name === "VersionError") {
    return res.status(409).json({
      success: false,
      message: "This record changed. Refresh and try again.",
    });
  }

  console.error(fallback, {
    name: error.name,
    code: error.code,
  });

  return res.status(500).json({
    success: false,
    message: fallback,
  });
};

const publicLead = async (lead) => {
  // Population happens after commit, using ordinary reads.
  lead.$session(null);

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

  const result = lead.toObject();

  delete result.followUpRevision;
  delete result.followUpsMigratedAt;

  return result;
};

const createLead = async (req, res) => {
  try {
    const lead = await createLeadWithFollowUp({
      user: req.user,
      body: req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead: await publicLead(lead),
    });
  } catch (error) {
    return sendError(res, error, "Unable to create lead");
  }
};

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
      filter.$or = ["name", "email", "phone"].map((field) => ({
        [field]: {
          $regex: search,
          $options: "i",
        },
      }));
    }

    const leads = await Lead.find(filter).populate("assignedTo", "name email systemRole").sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: leads.length,
      leads,
    });
  } catch (error) {
    return sendError(res, error, "Unable to retrieve leads");
  }
};

const getLeadById = async (req, res) => {
  try {
    if (!isValidLeadId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID",
      });
    }

    const lead = await Lead.findOne(buildLeadAccessFilter(req.user, req.params.id))
      .populate("assignedTo", "name email systemRole")
      .populate("createdBy", "name email systemRole");

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
    return sendError(res, error, "Unable to retrieve lead details");
  }
};

const updateLead = async (req, res) => {
  try {
    const lead = await updateLeadWithFollowUps({
      user: req.user,
      leadId: req.params.id,
      body: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead: await publicLead(lead),
    });
  } catch (error) {
    return sendError(res, error, "Unable to update lead");
  }
};

const deleteLead = async (req, res) => {
  try {
    await deleteLeadWithFollowUps({
      user: req.user,
      leadId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    return sendError(res, error, "Unable to delete lead");
  }
};

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
};