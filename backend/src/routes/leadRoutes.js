const express = require("express");
const { createLead, getLeads, getLeadById, updateLead, deleteLead, } = require("../controllers/leadController");
const { getLeadActivities, } = require("../controllers/activityController");
const { getLeadNotes, createLeadNote, updateLeadNote, deleteLeadNote, } = require("../controllers/leadNoteController");
const { protect, } = require("../middleware/authMiddleware");

const router = express.Router();

// Lead routes
router
    .route("/")
    .post(protect, createLead)
    .get(protect, getLeads);
// Lead-specific routes
router
    .route("/:id/activities")
    .get(protect, getLeadActivities);
// Lead note routes
router
    .route("/:id/notes")
    .get(protect, getLeadNotes)
    .post(protect, createLeadNote);
// Lead note modification routes
router
    .route("/:id/notes/:noteId")
    .patch(protect, updateLeadNote)
    .delete(protect, deleteLeadNote);
// Lead CRUD routes
router
    .route("/:id")
    .get(protect, getLeadById)
    .patch(protect, updateLead)
    .delete(protect, deleteLead);

module.exports = router;
