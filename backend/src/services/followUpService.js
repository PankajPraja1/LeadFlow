const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const { buildLeadAccessFilter } = require("../utils/leadAccess");

const preparedDatabases = new WeakMap();

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

// Prepare collections and indexes outside transactions, once per connection DB.
const prepareStorage = async () => {
    const { db, readyState } = mongoose.connection;

    if (readyState !== 1 || !db) {
        throw httpError(503, "Database service is temporarily unavailable");
    }

    if (!preparedDatabases.has(db)) {
        const preparation = (async () => {
            for (const Model of [Lead, Task, Activity]) {
                await Model.init();
                await Model.createCollection();
                await Model.createIndexes();
            }
        })().catch((error) => {
            preparedDatabases.delete(db);
            throw error;
        });

        preparedDatabases.set(db, preparation);
    }

    await preparedDatabases.get(db);
};

// Internal write service. Task callers must ALSO enforce task ownership.
const withLeadFollowUps = async ({ user, leadId }, work) => {
    if (!mongoose.isObjectIdOrHexString(user?._id)) {
        throw httpError(401, "Authentication required");
    }

    if (!["admin", "leader", "member"].includes(user.systemRole)) {
        throw httpError(403, "You do not have permission to change follow-ups");
    }

    if (!mongoose.isObjectIdOrHexString(leadId)) {
        throw httpError(400, "Invalid lead ID");
    }

    if (typeof work !== "function") {
        throw new TypeError("A follow-up operation is required");
    }

    await prepareStorage();

    return mongoose.connection.transaction(async (session) => {
        // A real write makes simultaneous changes to this lead conflict and retry.
        const lead = await Lead.findOneAndUpdate(
            buildLeadAccessFilter(user, leadId),
            { $inc: { followUpRevision: 1 } },
            { returnDocument: "after", session }
        ).select("+followUpsMigratedAt");

        if (!lead) {
            throw httpError(404, "Lead not found");
        }

        if (!lead.followUpsMigratedAt) {
            if (lead.nextFollowUp) {
                const imported = await Task.exists({
                    lead: lead._id,
                    legacyImported: true,
                }).session(session);

                if (!imported) {
                    await new Task({
                        title: `Follow up with ${lead.name}`,
                        kind: "follow_up",
                        lead: lead._id,
                        assignedTo: lead.assignedTo,
                        createdBy: user._id,
                        dueAt: lead.nextFollowUp,
                        legacyImported: true,
                    }).save({ session });
                }
            }

            // Mark even leads without an old date, so new dates are never re-imported.
            lead.followUpsMigratedAt = new Date();
        }

        const result = await work({ lead, session });

        const nextTask = await Task.findOne({
            lead: lead._id,
            kind: "follow_up",
            status: "pending",
        })
            .sort({ dueAt: 1, _id: 1 })
            .select("dueAt")
            .session(session)
            .lean();

        lead.nextFollowUp = nextTask?.dueAt ?? null;
        await lead.save({ session });

        return result;
    }, {
        readPreference: "primary",
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        maxCommitTimeMS: 10000,
    });
};

module.exports = {
    withLeadFollowUps,
    prepareFollowUpStorage: prepareStorage,
};