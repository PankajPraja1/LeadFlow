require("dotenv").config({ quiet: true });

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const Lead = require("../src/models/Lead");
const Task = require("../src/models/Task");
const Activity = require("../src/models/Activity");
const { recordActivity } = require("../src/services/activityService");
const { withLeadFollowUps } = require("../src/services/followUpService");

const testDbName = `lfu_${randomUUID().replaceAll("-", "")}`;
const user = { _id: new mongoose.Types.ObjectId(), systemRole: "member" };
const day = 24 * 60 * 60 * 1000;
const firstDate = new Date(Date.now() + day);
const secondDate = new Date(firstDate.getTime() + day);
const oldDate = new Date(secondDate.getTime() + day);

async function logChange(task, session, type) {
    await recordActivity({
        leadId: task.lead,
        userId: user._id,
        taskId: task._id,
        type,
        description: "Follow-up integration check",
        session,
    });
}

async function addFollowUp(leadId, dueAt, abort = false) {
    return withLeadFollowUps({ user, leadId }, async ({ lead, session }) => {
        const task = await new Task({
            title: "Test follow-up",
            kind: "follow_up",
            lead: lead._id,
            assignedTo: user._id,
            createdBy: user._id,
            dueAt,
        }).save({ session });

        await logChange(task, session, "followup_created");
        if (abort) throw new Error("Intentional rollback check");
        return task._id;
    });
}

async function run() {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing");

    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: testDbName,
        serverSelectionTimeoutMS: 10000,
        autoCreate: false,
        autoIndex: false,
    });

    assert.equal(mongoose.connection.db.databaseName, testDbName);
    await Lead.createCollection();

    const original = await Lead.create({
        name: "Follow-up service check",
        phone: "0000000000",
        assignedTo: user._id,
        createdBy: user._id,
        nextFollowUp: oldDate,
    });
    const leadId = original._id;
    const refreshLead = () => Lead.findById(leadId).select("+followUpRevision +followUpsMigratedAt").lean();

    await assert.rejects(addFollowUp(leadId, firstDate, true), /Intentional rollback check/);
    assert.equal(await Task.countDocuments({ lead: leadId }), 0);
    assert.equal(await Activity.countDocuments({ lead: leadId }), 0);
    let lead = await refreshLead();
    assert.equal(lead.followUpRevision, 0);
    assert.equal(lead.followUpsMigratedAt, null);
    assert.equal(lead.nextFollowUp.getTime(), oldDate.getTime());
    console.log("PASS 1: Failed changes roll back tasks, activity and lead changes");

    // Parallel calls here use SEPARATE transactions, each sequential internally.
    const [firstId] = await Promise.all([
        addFollowUp(leadId, firstDate),
        addFollowUp(leadId, secondDate),
    ]);
    await withLeadFollowUps({ user, leadId }, async () => { });
    assert.equal(await Task.countDocuments({ lead: leadId }), 3);
    assert.equal(await Task.countDocuments({ lead: leadId, legacyImported: true }), 1);
    assert.equal(await Activity.countDocuments({ lead: leadId }), 2);
    lead = await refreshLead();
    assert.ok(lead.followUpsMigratedAt instanceof Date);
    assert.equal(lead.nextFollowUp.getTime(), firstDate.getTime());
    console.log("PASS 2: Concurrent changes commit and import the old date once");

    await withLeadFollowUps({ user, leadId }, async ({ session }) => {
        const task = await Task.findOne({
            _id: firstId, lead: leadId, assignedTo: user._id,
        }).session(session);
        assert.ok(task);
        task.status = "completed";
        task.completedAt = new Date();
        task.completionNote = "Call finished";
        await task.save({ session });
        await logChange(task, session, "followup_completed");
    });
    assert.equal((await refreshLead()).nextFollowUp.getTime(), secondDate.getTime());
    assert.equal((await Task.findById(firstId)).status, "completed");
    assert.equal(await Activity.countDocuments({ task: firstId, type: "followup_completed" }), 1);
    console.log("PASS 3: Completion keeps history and advances the next date");

    await withLeadFollowUps({ user, leadId }, async ({ session }) => {
        const pending = await Task.find({
            lead: leadId, assignedTo: user._id, status: "pending",
        }).session(session);
        for (const task of pending) {
            task.status = "cancelled";
            task.cancelledAt = new Date();
            await task.save({ session });
            await logChange(task, session, "followup_cancelled");
        }
    });
    await withLeadFollowUps({ user, leadId }, async () => { });
    assert.equal((await refreshLead()).nextFollowUp, null);
    assert.equal(await Task.countDocuments({ lead: leadId }), 3);
    assert.equal(await Task.countDocuments({ lead: leadId, status: "cancelled" }), 2);
    assert.equal(await Activity.countDocuments({ lead: leadId, type: "followup_cancelled" }), 2);
    console.log("PASS 4: Cancellation clears the date and preserves task history");

    const emptyLead = await Lead.create({
        name: "Initially undated lead", phone: "0000000000",
        assignedTo: user._id, createdBy: user._id,
    });
    await addFollowUp(emptyLead._id, firstDate);
    await withLeadFollowUps({ user, leadId: emptyLead._id }, async () => { });
    assert.equal(await Task.countDocuments({ lead: emptyLead._id }), 1);
    assert.equal(await Task.countDocuments({ lead: emptyLead._id, legacyImported: true }), 0);
    console.log("PASS 5: Newly scheduled dates are never imported as old dates");

    await assert.rejects(withLeadFollowUps({
        user: { ...user, systemRole: "viewer" }, leadId,
    }, async () => { }), (error) => error.statusCode === 403);
    await assert.rejects(withLeadFollowUps({
        user: { _id: new mongoose.Types.ObjectId(), systemRole: "member" }, leadId,
    }, async () => { }), (error) => error.statusCode === 404);
    console.log("PASS 6: Viewer writes and unrelated-member access are rejected");
}

async function main() {
    try {
        await run();
    } finally {
        try {
            if (mongoose.connection.readyState === 1 && mongoose.connection.db.databaseName === testDbName) {
                for (const Model of [Activity, Task, Lead]) {
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
    console.log("ALL FOLLOW-UP SERVICE CHECKS PASSED; test collections removed");
}

main().catch((error) => {
    console.error("Follow-up check failed:", error.name, error.code || "", error.message);
    process.exitCode = 1;
});