require("dotenv").config({ quiet: true });

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");

mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

const User = require("../src/models/User");
const Lead = require("../src/models/Lead");
const Task = require("../src/models/Task");
const Activity = require("../src/models/Activity");

const { createLeadWithFollowUp, } = require("../src/services/leadWriteService");

const { mutateTask, } = require("../src/services/taskService");

const { inspectFollowUps, applyFollowUps, } = require("../scripts/migrateFollowUps.cjs");

const testDbName = `lfm_${randomUUID().replaceAll("-", "")}`;

const admin = {
    _id: new mongoose.Types.ObjectId(),
    name: "Import admin",
    email: "migration-admin@example.test",
    systemRole: "admin",
    isActive: true,
    isEmailVerified: true,
};

const owner = {
    _id: new mongoose.Types.ObjectId(),
    name: "Import owner",
    email: "migration-owner@example.test",
    systemRole: "member",
    isActive: true,
    isEmailVerified: true,
};

const dueAt = new Date("2026-08-01T09:00:00.123Z");

const leadData = (name, date = null) => ({
    name,
    phone: "0000000000",
    assignedTo: owner._id,
    createdBy: owner._id,
    nextFollowUp: date,
});

const options = {
    expectedDatabase: testDbName,
    actorEmail: admin.email,
    legacyWritersStopped: true,
};

async function snapshot() {
    const data = {};

    for (const Model of [Lead, Task, Activity]) {
        data[Model.modelName] = await Model.collection
            .find({})
            .sort({ _id: 1 })
            .toArray();
    }

    return JSON.stringify(data);
}

async function run() {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: testDbName,
        autoCreate: false,
        autoIndex: false,
        serverSelectionTimeoutMS: 10000,
    });

    assert.equal(mongoose.connection.db.databaseName, testDbName);

    for (const Model of [User, Lead, Task, Activity]) {
        await Model.createCollection();
    }

    await User.collection.insertMany([admin, owner]);

    const old = await Lead.create({
        ...leadData("Old lead", dueAt),
        status: "lost",
    });

    const undated = await Lead.create(leadData("Undated lead"));

    await createLeadWithFollowUp({
        user: owner,
        body: {
            name: "Already using tasks",
            phone: "0000000000",
            nextFollowUp: dueAt.toISOString(),
        },
    });

    const personal = await Task.create({
        title: "Personal task",
        kind: "personal",
        assignedTo: owner._id,
        createdBy: owner._id,
    });

    const original = await snapshot();
    const audit = await inspectFollowUps();

    assert.equal(audit.totalLeads, 3);
    assert.equal(audit.alreadyInitialized, 1);
    assert.equal(audit.awaitingInitialization, 2);
    assert.equal(audit.datesToImport, 1);
    assert.equal(audit.withoutDate, 1);
    assert.equal(audit.blockedLeads, 0);
    assert.equal(await snapshot(), original);

    console.log("PASS 1: The audit reports old dates without changing any records");

    await assert.rejects(
        applyFollowUps({
            ...options,
            expectedDatabase: "wrong_database",
        }),
        /does not match/
    );

    await assert.rejects(
        applyFollowUps({
            ...options,
            legacyWritersStopped: false,
        }),
        /legacy backend/
    );

    await assert.rejects(
        applyFollowUps({
            ...options,
            actorEmail: owner.email,
        }),
        /active admin/
    );

    assert.equal(await snapshot(), original);

    console.log("PASS 2: Database, writer and admin checks prevent unintended imports");

    const imported = await applyFollowUps(options);

    assert.equal(imported.processed, 2);
    assert.equal(imported.after.awaitingInitialization, 0);
    assert.equal(imported.after.blockedLeads, 0);

    const task = await Task.findOne({
        lead: old._id,
    }).select("+legacyImported");

    assert.equal(task.dueAt.toISOString(), dueAt.toISOString());

    assert.equal(String(task.assignedTo), String(owner._id));

    assert.equal(String(task.createdBy), String(admin._id));

    assert.equal(task.legacyImported, true);

    assert.equal((await Lead.findById(old._id)).status, "lost");

    assert.equal(await Activity.countDocuments({ lead: old._id }), 0);

    assert.ok(
        (await Lead.findById(undated._id)
            .select("+followUpsMigratedAt")
        ).followUpsMigratedAt
    );

    assert.equal(await Task.countDocuments({ lead: undated._id }), 0);

    assert.equal((await Task.findById(personal._id)).status, "pending");

    console.log("PASS 3: Import preserves old dates and ownership without inventing activity");

    const once = await snapshot();

    assert.equal((await applyFollowUps(options)).processed, 0);

    assert.equal(await snapshot(), once);

    await mutateTask({
        user: owner,
        id: task._id,
        body: { version: 0 },
        action: "complete",
    });

    const completed = await snapshot();

    await applyFollowUps(options);

    assert.equal(await snapshot(), completed);

    assert.equal((await Lead.findById(old._id)).nextFollowUp, null);

    assert.equal(await Task.countDocuments({ lead: old._id }), 1);

    console.log("PASS 4: Repeating the import does not duplicate or reopen completed tasks");

    const failedLead = await Lead.create(leadData("Rollback check", dueAt));

    const save = Lead.prototype.save;
    const failure = new Error("Intentional migration rollback");

    Lead.prototype.save = function (saveOptions) {
        if (String(this._id) === String(failedLead._id)) {
            return Promise.reject(failure);
        }

        return save.call(this, saveOptions);
    };

    try {
        await assert.rejects(
            applyFollowUps(options),
            (error) => error === failure
        );
    } finally {
        Lead.prototype.save = save;
    }

    assert.equal(await Task.countDocuments({ lead: failedLead._id }), 0);

    assert.equal(
        (await Lead.findById(failedLead._id)
            .select("+followUpsMigratedAt")
        ).followUpsMigratedAt,
        null
    );

    assert.equal(
        (await Lead.findById(failedLead._id)).nextFollowUp.toISOString(),
        dueAt.toISOString()
    );

    await applyFollowUps(options);

    assert.equal(await Task.countDocuments({ lead: failedLead._id }), 1);

    console.log("PASS 5: Failed lead imports roll back and can be retried");

    await Lead.create({
        ...leadData("Missing owner", dueAt),
        assignedTo: new mongoose.Types.ObjectId(),
    });

    const mixed = await Lead.create(leadData("Unmarked task data", dueAt));

    await Task.create({
        title: "Existing task",
        kind: "follow_up",
        lead: mixed._id,
        dueAt,
        assignedTo: owner._id,
        createdBy: owner._id,
    });

    assert.equal((await inspectFollowUps()).blockedLeads, 2);

    const blocked = await snapshot();

    await assert.rejects(applyFollowUps(options), /audit problems/);

    assert.equal(await snapshot(), blocked);

    console.log("PASS 6: Missing owners and unmarked task data require review before import");

    const invalid = await Lead.create(leadData("Invalid stored date"));

    await Lead.collection.updateOne(
        { _id: invalid._id },
        { $set: { nextFollowUp: "not-a-date" } }
    );

    await Lead.collection.updateOne(
        { _id: old._id },
        { $set: { nextFollowUp: dueAt } }
    );

    assert.equal((await inspectFollowUps()).blockedLeads, 4);

    console.log("PASS 7: Invalid dates and inconsistent cached dates are reported");
}

async function main() {
    try {
        await run();
    } finally {
        try {
            if (mongoose.connection.readyState === 1 && mongoose.connection.db.databaseName === testDbName
            ) {
                for (const Model of [Activity, Task, Lead, User]) {
                    try {
                        await Model.collection.drop();
                    } catch (error) {
                        if (error.code !== 26) throw error;
                    }
                }
            }
        } finally {
            await mongoose.disconnect();
        }
    }

    console.log("ALL MIGRATION CHECKS PASSED; test collections removed");
}

main().catch((error) => {
    console.error(
        "Migration check failed:",
        error.name,
        error.code || "",
        error.message
    );

    process.exitCode = 1;
});