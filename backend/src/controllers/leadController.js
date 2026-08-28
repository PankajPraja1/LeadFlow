const Lead = require("../models/Lead");

const hasTeamAccess = (user) => {
  return ["admin", "leader"].includes(user.systemRole);
};

// Lead Controller functions for creating lead
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

    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead,
    });
  } catch (error) {
    console.error("Create lead error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (item) => item.message
      );

      return res.status(400).json({
        success: false,
        message: messages[0],
        errors: messages,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create lead",
    });
  }
};

// Lead Controller functions for getting
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

    const leads = await Lead.find(filter)
      .populate("assignedTo", "name email systemRole")
      .sort({ createdAt: -1 });

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

// Lead Controller functions for updating
const updateLead = async (req, res) => {
  try {
    const filter = {
      _id: req.params.id,
    };

    if (!hasTeamAccess(req.user)) {
      filter.assignedTo = req.user._id;
    }

    const allowedFields = [
      "name",
      "email",
      "phone",
      "source",
      "status",
      "notes",
      "nextFollowUp",
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const lead = await Lead.findOneAndUpdate(
      filter,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or access denied",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead,
    });
  } catch (error) {
    console.error("Update lead error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update lead",
    });
  }
};

// Lead Controller functions for deleting
const deleteLead = async (req, res) => {
  try {
    const filter = {
      _id: req.params.id,
    };

    if (!hasTeamAccess(req.user)) {
      filter.assignedTo = req.user._id;
    }

    const lead = await Lead.findOneAndDelete(filter);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found or access denied",
      });
    }

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
  updateLead,
  deleteLead,
};