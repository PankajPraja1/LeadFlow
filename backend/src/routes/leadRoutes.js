const express = require("express");
const { createLead, getLeads, getLeadById, updateLead, deleteLead, } = require("../controllers/leadController");
const { getLeadActivities, } = require("../controllers/activityController");
const { getLeadNotes, createLeadNote, updateLeadNote, deleteLeadNote, } = require("../controllers/leadNoteController");
const { protect, } = require("../middleware/authMiddleware");

const requireLeadWriteAccess = (req, res, next) => {
    if (!["admin", "leader", "member"].includes(req.user?.systemRole)) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to modify leads or notes",
        });
    }

    return next();
};

const router = express.Router();

// Lead routes
router.route("/")
    .post(protect, requireLeadWriteAccess, createLead)
    .get(protect, getLeads);

// Lead-specific routes
router.route("/:id/activities")
    .get(protect, getLeadActivities);

// Lead note routes
router.route("/:id/notes")
    .get(protect, getLeadNotes)
    .post(protect, requireLeadWriteAccess, createLeadNote);

// Lead note modification routes
router.route("/:id/notes/:noteId")
    .patch(protect, requireLeadWriteAccess, updateLeadNote)
    .delete(protect, requireLeadWriteAccess, deleteLeadNote);

// Lead CRUD routes
router.route("/:id")
    .get(protect, getLeadById)
    .patch(protect, requireLeadWriteAccess, updateLead)
    .delete(protect, requireLeadWriteAccess, deleteLead);

module.exports = router;
