const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const LeadNote = require("../models/LeadNote");
// Importing necessary modules and models
const { recordActivity, } = require("../services/activityService");
const { hasTeamAccess, isValidLeadId, buildLeadAccessFilter, } = require("../utils/leadAccess");

// Function to check if a user can modify a note
const canModifyNote = (user, note) => {
    return (hasTeamAccess(user) || note.author.toString() === user._id.toString());
};

// Function to find an accessible lead based on user and lead ID
const findAccessibleLead = async (user, leadId) => {
    return Lead.findOne(buildLeadAccessFilter(user, leadId)).select("_id name");
};

// Get lead notes for a specific lead
const getLeadNotes = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidLeadId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid lead ID",
            });
        }

        const lead = await findAccessibleLead(req.user, id);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found or access denied",
            });
        }

        const notes = await LeadNote.find({ lead: lead._id, }).populate("author", "name email systemRole").sort({ createdAt: -1, });

        return res.status(200).json({
            success: true,
            count: notes.length,
            notes,
        });
    } catch (error) {
        console.error("Get lead notes error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve lead notes",
        });
    }
};

// Create a new lead note
const createLeadNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!isValidLeadId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid lead ID",
            });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Note content is required",
            });
        }

        const lead = await findAccessibleLead(req.user, id);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found or access denied",
            });
        }

        const note = await LeadNote.create({
            lead: lead._id,
            content: content.trim(),
            author: req.user._id,
        });

        await recordActivity({
            leadId: lead._id,
            userId: req.user._id,
            type: "note_added",
            description: "Added a note",
            changes: {
                noteId: note._id,
            },
        });

        await note.populate("author", "name email systemRole");

        return res.status(201).json({
            success: true,
            message: "Note added successfully",
            note,
        });
    } catch (error) {
        console.error("Create lead note error:", error);

        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((item) => item.message);

            return res.status(400).json({
                success: false,
                message: messages[0] || "Note validation failed",
                errors: messages,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to add note",
        });
    }
};

// Update an existing lead note
const updateLeadNote = async (req, res) => {
    try {
        const { id, noteId } = req.params;
        const { content } = req.body;

        if (!isValidLeadId(id) || !mongoose.Types.ObjectId.isValid(noteId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid lead or note ID",
            });
        }

        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Note content is required",
            });
        }

        const lead = await findAccessibleLead(req.user, id);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found or access denied",
            });
        }

        const note = await LeadNote.findOne({
            _id: noteId,
            lead: lead._id,
        });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: "Note not found",
            });
        }

        if (!canModifyNote(req.user, note)) {
            return res.status(403).json({
                success: false,
                message: "You cannot edit this note",
            });
        }

        const previousContent = note.content;

        note.content = content.trim();
        note.editedAt = new Date();

        await note.save();

        await recordActivity({
            leadId: lead._id,
            userId: req.user._id,
            type: "note_updated",
            description: "Updated a note",
            changes: {
                noteId: note._id,
                content: {
                    from: previousContent,
                    to: note.content,
                },
            },
        });

        await note.populate("author", "name email systemRole");

        return res.status(200).json({
            success: true,
            message: "Note updated successfully",
            note,
        });
    } catch (error) {
        console.error("Update lead note error:", error);

        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((item) => item.message);

            return res.status(400).json({
                success: false,
                message: messages[0] || "Note validation failed",
                errors: messages,
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to update note",
        });
    }
};

// Delete a lead note
const deleteLeadNote = async (req, res) => {
    try {
        const { id, noteId } = req.params;

        if (!isValidLeadId(id) || !mongoose.Types.ObjectId.isValid(noteId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid lead or note ID",
            });
        }

        const lead = await findAccessibleLead(req.user, id);

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: "Lead not found or access denied",
            });
        }

        const note = await LeadNote.findOne({
            _id: noteId,
            lead: lead._id,
        });

        if (!note) {
            return res.status(404).json({
                success: false,
                message: "Note not found",
            });
        }

        if (!canModifyNote(req.user, note)) {
            return res.status(403).json({
                success: false,
                message: "You cannot delete this note",
            });
        }

        await note.deleteOne();

        await recordActivity({
            leadId: lead._id,
            userId: req.user._id,
            type: "note_deleted",
            description: "Deleted a note",
            changes: {
                noteId,
            },
        });

        return res.status(200).json({
            success: true,
            message: "Note deleted successfully",
        });
    } catch (error) {
        console.error("Delete lead note error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete note",
        });
    }
};

// Exporting the controller functions
module.exports = {
    getLeadNotes,
    createLeadNote,
    updateLeadNote,
    deleteLeadNote,
};

