const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const LeadNote = require("../models/LeadNote");
const { buildLeadAccessFilter } = require("../utils/leadAccess");
const { recordActivity } = require("./activityService");
const { withLeadFollowUps, prepareFollowUpStorage, } = require("./followUpService");

const leadFields = ["name", "email", "phone", "source", "status", "notes"];

const transactionOptions = {
    readPreference: "primary",
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
    maxCommitTimeMS: 10000,
};

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const requireWriter = (user) => {
    if (!mongoose.isObjectIdOrHexString(user?._id)) {
        throw httpError(401, "Authentication required");
    }

    if (!["admin", "leader", "member"].includes(user.systemRole)) {
        throw httpError(403, "You do not have permission to modify leads");
    }
};

const requireBody = (body) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw httpError(400, "A JSON object is required");
    }
};

const readFollowUpDate = (value) => {
    if (value === undefined || value === null || value === "") return null;

    if (typeof value !== "string" || value.length > 64) {
        throw httpError(400, "Enter a valid follow-up date");
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw httpError(400, "Enter a valid follow-up date");
    }

    return date;
};

const addFollowUp = async (user, lead, dueAt, session) => {
    const task = await new Task({
        title: `Follow up with ${lead.name}`,
        kind: "follow_up",
        lead: lead._id,
        assignedTo: user._id,
        createdBy: user._id,
        dueAt,
    }).save({ session });

    await recordActivity({
        leadId: lead._id,
        userId: user._id,
        taskId: task._id,
        type: "followup_created",
        description: "Scheduled a follow-up from the lead form",
        changes: {
            dueAt: {
                from: null,
                to: dueAt.toISOString(),
            },
        },
        session,
    });
};

// Legacy forms may submit the unchanged date during general edits.
// Actual date changes must use the versioned Task API.
const assertFormFollowUpUnchanged = async (
    lead,
    dueAt,
    session
) => {
    const next = await Task.findOne({
        lead: lead._id,
        kind: "follow_up",
        status: "pending",
    })
        .sort({ dueAt: 1, _id: 1 })
        .select("dueAt")
        .session(session)
        .lean();

    const requestedTime = dueAt?.getTime() ?? null;
    const currentTime = next?.dueAt?.getTime() ?? null;

    if (requestedTime !== currentTime) {
        throw httpError(
            409,
            "Follow-up dates are managed separately. Refresh this lead and use its follow-up task to change the date."
        );
    }
};

const createLeadWithFollowUp = async ({ user, body }) => {
    requireWriter(user);
    requireBody(body);

    const dueAt = readFollowUpDate(body.nextFollowUp);

    const fields = Object.fromEntries(leadFields.filter((field) => Object.hasOwn(body, field)).map((field) => [field, body[field]]));

    await prepareFollowUpStorage();

    return mongoose.connection.transaction(async (session) => {
        const lead = await new Lead({
            ...fields,
            assignedTo: user._id,
            createdBy: user._id,
            nextFollowUp: dueAt,
            followUpsMigratedAt: new Date(),
        }).save({ session });

        await recordActivity({
            leadId: lead._id,
            userId: user._id,
            type: "lead_created",
            description: `Created lead ${lead.name}`,
            changes: {
                status: {
                    from: null,
                    to: lead.status,
                },
            },
            session,
        });

        if (dueAt) await addFollowUp(user, lead, dueAt, session);

        return lead;
    }, transactionOptions);
};

const updateLeadWithFollowUps = async ({ user, leadId, body }) => {
    requireWriter(user);
    requireBody(body);

    const hasDate = Object.hasOwn(body, "nextFollowUp");
    const dueAt = hasDate ? readFollowUpDate(body.nextFollowUp) : null;

    return withLeadFollowUps({ user, leadId }, async ({ lead, session }) => {
        const changes = {};

        for (const field of leadFields) {
            if (!Object.hasOwn(body, field) || body[field] === undefined) continue;

            const previous = lead.get(field) ?? null;

            lead.set(field, body[field]);

            const next = lead.get(field) ?? null;

            if (previous !== next) {
                changes[field] = {
                    from: previous,
                    to: next,
                };
            }
        }

        await lead.validate();

        if (hasDate) {
            await assertFormFollowUpUnchanged(lead, dueAt, session);
        }

        if (changes.status) {
            await recordActivity({
                leadId: lead._id,
                userId: user._id,
                type: "status_changed",
                description: `Changed status from ${changes.status.from} to ${changes.status.to}`,
                changes: {
                    status: changes.status,
                },
                session,
            });
        }

        const general = Object.fromEntries(
            Object.entries(changes).filter(([field]) => field !== "status")
        );

        if (Object.keys(general).length) {
            await recordActivity({
                leadId: lead._id,
                userId: user._id,
                type: "lead_updated",
                description: `Updated ${Object.keys(general).join(", ")}`,
                changes: general,
                session,
            });
        }

        // withLeadFollowUps saves the lead and recalculates its next date.
        return lead;
    });
};

const deleteLeadWithFollowUps = async ({ user, leadId }) => {
    requireWriter(user);

    if (!mongoose.isObjectIdOrHexString(leadId)) {
        throw httpError(400, "Invalid lead ID");
    }

    await prepareFollowUpStorage();
    await LeadNote.init();
    await LeadNote.createCollection();

    return mongoose.connection.transaction(async (session) => {
        // Deleting the parent coordinates with the task service's lead write.
        const lead = await Lead.findOneAndDelete(
            buildLeadAccessFilter(user, leadId),
            { session }
        );

        if (!lead) throw httpError(404, "Lead not found");

        await Task.deleteMany(
            { lead: lead._id, kind: "follow_up" },
            { session }
        );

        await Activity.deleteMany({ lead: lead._id }, { session });

        await LeadNote.deleteMany({ lead: lead._id }, { session });
    }, transactionOptions);
};

module.exports = {
    createLeadWithFollowUp,
    updateLeadWithFollowUps,
    deleteLeadWithFollowUps,
};