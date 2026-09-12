require("dotenv").config({ quiet: true });

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");

mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

const Lead = require("../src/models/Lead");
const Task = require("../src/models/Task");
const Activity = require("../src/models/Activity");
const LeadNote = require("../src/models/LeadNote");

const {
    createTask,
    mutateTask,
} = require("../src/services/taskService");

const {
    createLeadWithFollowUp: create,
    updateLeadWithFollowUps: update,
    deleteLeadWithFollowUps: remove,
} = require("../src/services/leadWriteService");

const testDbName = `lfw_${randomUUID().replaceAll("-", "")}`;

const user = {
    _id: new mongoose.Types.ObjectId(),
    systemRole: "member",
};

const date1 = new Date(Date.now() + 86400000).toISOString();
const date2 = new Date(Date.now() + 172800000).toISOString();

const body = {
    name: "Lead form check",
    phone: "0000000000",
    nextFollowUp: date1,
};

async function run() {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is missing");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: testDbName,
        serverSelectionTimeoutMS: 10000,
        autoCreate: false,
        autoIndex: false,
    });

    assert.equal(mongoose.connection.db.databaseName, testDbName);

    const originalSave = Activity.prototype.save;
    const creationFailure = new Error("Intentional creation rollback");

    Activity.prototype.save = function (options) {
        if (this.type === "followup_created") {
            return Promise.reject(creationFailure);
        }
        return originalSave.call(this, options);
    };

    try {
        await assert.rejects(
            create({ user, body }),
            (error) => error === creationFailure
        );
    } finally {
        Activity.prototype.save = originalSave;
    }

    for (const Model of [Lead, Task, Activity]) {
        assert.equal(await Model.countDocuments({}), 0);
    }

    const lead = await create({ user, body });
    const leadId = lead._id;
    const task = await Task.findOne({ lead: leadId });

    assert.ok(task);
    assert.equal(String(task.assignedTo), String(user._id));
    assert.equal(await Task.countDocuments({ lead: leadId }), 1);
    assert.equal(await Activity.countDocuments({ lead: leadId }), 2);
    assert.equal((await Lead.findById(leadId)).nextFollowUp.toISOString(), date1);

    console.log("PASS 1: Lead, task and history creation commit or roll back together");

    await update({
        user,
        leadId,
        body: {
            name: "Renamed lead",
            nextFollowUp: date1,
        },
    });

    assert.equal(
        await Task.countDocuments({ lead: leadId }),
        1
    );

    // The legacy lead form cannot reschedule.
    await assert.rejects(
        update({
            user,
            leadId,
            body: { nextFollowUp: date2 },
        }),
        (error) => error.statusCode === 409
    );

    // The versioned Task API can reschedule.
    await mutateTask({
        user,
        id: task._id,
        body: { version: 0, dueAt: date2 },
        action: "update",
    });

    // A stale form must not overwrite the new date or other fields.
    await assert.rejects(
        update({
            user,
            leadId,
            body: {
                name: "Stale overwrite",
                nextFollowUp: date1,
            },
        }),
        (error) => error.statusCode === 409
    );

    assert.equal(
        (await Lead.findById(leadId)).name,
        "Renamed lead"
    );

    assert.equal(
        (await Task.findById(task._id)).dueAt.toISOString(),
        date2
    );

    // Clearing the legacy date is also rejected.
    await assert.rejects(
        update({
            user,
            leadId,
            body: { nextFollowUp: "" },
        }),
        (error) => error.statusCode === 409
    );

    await mutateTask({
        user,
        id: task._id,
        body: { version: 1 },
        action: "cancel",
    });

    assert.equal(
        (await Task.findById(task._id)).status,
        "cancelled"
    );

    assert.equal(
        (await Lead.findById(leadId)).nextFollowUp,
        null
    );

    assert.equal(
        await Activity.countDocuments({
            task: task._id,
            type: "followup_cancelled",
        }),
        1
    );

    // New follow-ups on existing leads also use the Task API.
    await assert.rejects(
        update({
            user,
            leadId,
            body: { nextFollowUp: date1 },
        }),
        (error) => error.statusCode === 409
    );

    console.log(
        "PASS 2: Legacy forms cannot overwrite or cancel versioned follow-ups"
    );

    await createTask({
        user,
        body: {
            kind: "follow_up",
            title: "Next call",
            leadId,
            dueAt: date1,
        },
    });

    const admin = {
        _id: new mongoose.Types.ObjectId(),
        systemRole: "admin",
    };

    await assert.rejects(
        update({
            user: admin,
            leadId,
            body: { nextFollowUp: date2 },
        }),
        (error) => error.statusCode === 409
    );

    await assert.rejects(
        update({
            user: { ...user, systemRole: "viewer" },
            leadId,
            body: { name: "Blocked" },
        }),
        (error) => error.statusCode === 403
    );

    await assert.rejects(
        remove({
            user: { ...admin, systemRole: "member" },
            leadId,
        }),
        (error) => error.statusCode === 404
    );

    assert.equal((await Lead.findById(leadId)).nextFollowUp.toISOString(), date1);

    console.log("PASS 3: Ownership and role checks protect form mutations");

    // Add a second pending task as a fixture for the multi-task restriction.
    const extra = await Task.create({
        title: "Second task",
        kind: "follow_up",
        lead: leadId,
        assignedTo: user._id,
        createdBy: user._id,
        dueAt: date2,
    });

    await assert.rejects(
        update({
            user,
            leadId,
            body: {
                name: "Must roll back",
                nextFollowUp: null,
            },
        }),
        (error) => error.statusCode === 409
    );

    assert.equal((await Lead.findById(leadId)).name, "Renamed lead");
    assert.equal((await Task.findById(extra._id)).status, "pending");

    console.log("PASS 4: A single date field cannot overwrite multiple pending tasks");

    // Fixture only: bypass note validation because this check tests deletion.
    await LeadNote.createCollection();
    await LeadNote.collection.insertOne({ lead: leadId });

    const activityCount = await Activity.countDocuments({ lead: leadId });
    const oldDelete = LeadNote.deleteMany;
    const failure = new Error("Intentional delete rollback");

    LeadNote.deleteMany = async () => {
        throw failure;
    };

    try {
        await assert.rejects(
            remove({ user, leadId }),
            (error) => error === failure
        );
    } finally {
        LeadNote.deleteMany = oldDelete;
    }

    assert.ok(await Lead.findById(leadId));
    assert.equal(await Task.countDocuments({ lead: leadId }), 3);
    assert.equal(await Activity.countDocuments({ lead: leadId }), activityCount);
    assert.equal(await LeadNote.countDocuments({ lead: leadId }), 1);

    console.log("PASS 5: A failed cascade rolls back the entire lead deletion");

    const personal = await Task.create({
        title: "Keep my personal task",
        kind: "personal",
        assignedTo: user._id,
        createdBy: user._id,
    });

    await remove({ user, leadId });

    assert.equal(await Lead.findById(leadId), null);

    for (const Model of [Task, Activity, LeadNote]) {
        assert.equal(await Model.countDocuments({ lead: leadId }), 0);
    }

    assert.ok(await Task.findById(personal._id));

    console.log("PASS 6: Deletion removes linked records and retains personal tasks");
}

async function main() {
    try {
        await run();
    } finally {
        try {
            if (
                mongoose.connection.readyState === 1 &&
                mongoose.connection.db.databaseName === testDbName
            ) {
                for (const Model of [LeadNote, Activity, Task, Lead]) {
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

    console.log("ALL LEAD WRITE CHECKS PASSED; test collections removed");
}

main().catch((error) => {
    console.error(
        "Lead write check failed:",
        error.name,
        error.code || "",
        error.message
    );

    process.exitCode = 1;
});