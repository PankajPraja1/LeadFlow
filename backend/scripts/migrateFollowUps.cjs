const mongoose = require("mongoose");

if (require.main === module) {
    require("dotenv").config({ quiet: true });
    mongoose.set("autoCreate", false);
    mongoose.set("autoIndex", false);
}

const Lead = require("../src/models/Lead");
const Task = require("../src/models/Task");
const User = require("../src/models/User");

const { withLeadFollowUps, } = require("../src/services/followUpService");

const dateTime = (value) =>
    value == null
        ? null : value instanceof Date && Number.isFinite(value.getTime())
            ? value.getTime() : NaN;

const databaseName = () => {
    if (mongoose.connection.readyState !== 1) {
        throw new Error("Database is not connected");
    }

    return mongoose.connection.db.databaseName;
};

// Raw reads expose invalid stored values without casting them.
// This function performs no database writes.
async function inspectFollowUps() {
    const report = {
        database: databaseName(),
        totalLeads: 0,
        alreadyInitialized: 0,
        awaitingInitialization: 0,
        datesToImport: 0,
        withoutDate: 0,
        blockedLeads: 0,
        problems: [],
    };

    const cursor = Lead.collection.find(
        {},
        {
            projection: {
                _id: 1,
                assignedTo: 1,
                nextFollowUp: 1,
                followUpsMigratedAt: 1,
            },
            batchSize: 100,
        }
    );

    try {
        for await (const lead of cursor) {
            report.totalLeads++;

            const reasons = [];
            const initialized = lead.followUpsMigratedAt != null;
            const storedDate = dateTime(lead.nextFollowUp);

            if (Number.isNaN(storedDate)) {
                reasons.push("Invalid stored nextFollowUp date");
            }

            if (initialized) {
                report.alreadyInitialized++;

                if (Number.isNaN(dateTime(lead.followUpsMigratedAt))) {
                    reasons.push("Invalid migration marker");
                }

                const next = await Task.collection.findOne(
                    {
                        lead: lead._id,
                        kind: "follow_up",
                        status: "pending",
                    },
                    {
                        projection: { dueAt: 1 },
                        sort: { dueAt: 1, _id: 1 },
                    }
                );

                const nextDate = dateTime(next?.dueAt);

                if (next && nextDate === null) {
                    reasons.push("Pending follow-up has no due date");
                }

                if (Number.isNaN(nextDate) || storedDate !== nextDate) {
                    reasons.push("Cached lead date differs from pending tasks");
                }
            } else {
                report.awaitingInitialization++;

                if (storedDate === null) {
                    report.withoutDate++;
                } else if (!Number.isNaN(storedDate)) {
                    report.datesToImport++;
                }

                if (!mongoose.isObjectIdOrHexString(lead._id)) {
                    reasons.push("Invalid lead ID");
                }

                const ownerExists =
                    mongoose.isObjectIdOrHexString(lead.assignedTo) &&
                    (await User.collection.findOne(
                        { _id: lead.assignedTo },
                        { projection: { _id: 1 } }
                    ));

                if (!ownerExists) {
                    reasons.push("Assigned user is missing or invalid");
                }

                const existing = await Task.collection.findOne(
                    { lead: lead._id },
                    { projection: { _id: 1 } }
                );

                if (existing) {
                    reasons.push("Tasks exist but the migration marker is missing");
                }
            }

            if (reasons.length) {
                report.blockedLeads++;

                if (report.problems.length < 10) {
                    report.problems.push({
                        leadId: String(lead._id),
                        reasons,
                    });
                }
            }
        }
    } finally {
        await cursor.close();
    }

    return report;
}

async function applyFollowUps({
    expectedDatabase,
    actorEmail,
    legacyWritersStopped = false,
}) {
    if (expectedDatabase !== databaseName()) {
        throw new Error("Database confirmation does not match");
    }

    if (!legacyWritersStopped) {
        throw new Error("Stop or upgrade every legacy backend writer first");
    }

    if (typeof actorEmail !== "string" || !actorEmail.trim()) {
        throw new Error("An admin email is required");
    }

    const actor = await User.findOne({
        email: actorEmail.trim().toLowerCase(),
        systemRole: "admin",
        isActive: true,
        isEmailVerified: true,
    })
        .select("_id systemRole")
        .lean();

    if (!actor) {
        throw new Error("A verified, active admin in this database is required");
    }

    const before = await inspectFollowUps();

    if (before.blockedLeads) {
        throw new Error("Resolve the audit problems before importing");
    }

    let processed = 0;
    let deletedBeforeProcessing = 0;

    const cursor = Lead.collection.find(
        { followUpsMigratedAt: null },
        {
            projection: { _id: 1 },
            batchSize: 100,
        }
    );

    try {
        for await (const row of cursor) {
            try {
                await withLeadFollowUps(
                    { user: actor, leadId: row._id },
                    async ({ lead, session }) => {
                        // A failure here rolls back this lead's import.
                        const ownerExists = await User.exists({
                            _id: lead.assignedTo,
                        }).session(session);

                        if (!ownerExists) {
                            throw new Error("Assigned user disappeared during import");
                        }
                    }
                );

                processed++;
            } catch (error) {
                if (error.statusCode === 404) {
                    deletedBeforeProcessing++;
                } else {
                    throw error;
                }
            }
        }
    } finally {
        await cursor.close();
    }

    return {
        processed,
        deletedBeforeProcessing,
        after: await inspectFollowUps(),
    };
}

async function main() {
    const { parseArgs } = require("node:util");

    const { values } = parseArgs({
        options: {
            apply: { type: "boolean", default: false },
            database: { type: "string" },
            "actor-email": { type: "string" },
            "legacy-writers-stopped": {
                type: "boolean",
                default: false,
            },
        },
    });

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is missing");
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            autoCreate: false,
            autoIndex: false,
            serverSelectionTimeoutMS: 10000,
        });

        if (!values.apply) {
            console.log("AUDIT ONLY: no database writes");
            console.log(JSON.stringify(await inspectFollowUps(), null, 2));
            return;
        }

        const result = await applyFollowUps({
            expectedDatabase: values.database,
            actorEmail: values["actor-email"],
            legacyWritersStopped: values["legacy-writers-stopped"],
        });

        console.log(JSON.stringify(result, null, 2));

        if (result.after.awaitingInitialization || result.after.blockedLeads) {
            throw new Error("Import requires review; inspect the final report");
        }

        console.log("FOLLOW-UP IMPORT COMPLETE");
    } finally {
        await mongoose.disconnect();
    }
}

module.exports = {
    inspectFollowUps,
    applyFollowUps,
};

if (require.main === module) {
    main().catch((error) => {
        console.error(
            "Follow-up migration stopped:",
            error.name,
            error.code || ""
        );

        if (error.constructor === Error || error.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
            console.error(error.message);
        }

        console.error("Earlier committed leads are retained; rerun after resolving the cause.");

        process.exitCode = 1;
    });
}