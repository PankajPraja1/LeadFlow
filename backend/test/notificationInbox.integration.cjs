require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");

mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);
process.env.JWT_SECRET = randomBytes(32).toString("hex");

const User = require("../src/models/User");
const Lead = require("../src/models/Lead");
const Task = require("../src/models/Task");
const Activity = require("../src/models/Activity");
const Notification = require("../src/models/Notification");
const NotificationPreference = require("../src/models/NotificationPreference");
const notificationRoutes = require("../src/routes/notificationRoutes");
const taskRoutes = require("../src/routes/taskRoutes");

const testDbName = `lf_ni_${randomBytes(12).toString("hex")}`;
const users = ["member", "member", "admin", "leader", "viewer", "member", "member", "member"]
    .map((systemRole, index) => ({
        _id: new mongoose.Types.ObjectId(),
        name: `Inbox check ${index}`,
        email: `inbox-check-${index}@example.test`,
        systemRole,
        isActive: index !== 5,
        isEmailVerified: index !== 6,
        tokenVersion: 0,
        rank: null,
    }));
const tokens = users.map((user) => jwt.sign({
    userId: user._id.toString(), tokenVersion: 0,
}, process.env.JWT_SECRET, { expiresIn: "15m" }));
let server;
let base;
let cleanupAllowed = false;

async function request(method, path, body, who = 0, expected = 200) {
    const response = await fetch(`${base}${path}`, {
        method,
        signal: AbortSignal.timeout(30000),
        headers: {
            "Content-Type": "application/json",
            ...(who !== null && { Authorization: `Bearer ${tokens[who]}` }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
    if (path.startsWith("/notifications")) {
        assert.equal(response.headers.get("cache-control"), "no-store");
    }
    return result;
}

const sync = (who = 0) => request("POST", "/notifications/sync", {}, who);
const inbox = (who = 0, query = "") => request("GET", `/notifications${query}`, undefined, who);
const read = (id, isRead, who = 0, expected = 200) => request("PATCH", `/notifications/${id}/read`, { isRead }, who, expected);
const createTask = async (title, dueAt, who = 0, extra = {}) => (await request("POST", "/tasks", {
    kind: "personal", title, dueAt, ...extra,
}, who, 201)).task;
const editTask = async (task, fields, who = 0) => (await request("PATCH", `/tasks/${task._id}`, {
    version: task.version, ...fields,
}, who)).task;
const closeTask = async (task, action, who = 0) => (await request("POST", `/tasks/${task._id}/${action}`, {
    version: task.version,
}, who)).task;
const setPreferences = async (changes, who = 0) => {
    const current = (await request("GET", "/notifications/preferences", undefined, who)).preferences;
    return (await request("PATCH", "/notifications/preferences", {
        version: current.version, ...changes,
    }, who)).preferences;
};

async function run() {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing");
    await mongoose.connect(process.env.MONGODB_URI, {
        dbName: testDbName, serverSelectionTimeoutMS: 10000,
        autoCreate: false, autoIndex: false,
    });
    assert.equal(mongoose.connection.db.databaseName, testDbName);
    assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0, "Refusing to use a nonempty test database");
    cleanupAllowed = true;
    await User.createCollection();
    // Fixtures use the real auth middleware; no registration or email is invoked.
    await User.collection.insertMany(users);

    const app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationRoutes);
    app.use("/api/tasks", taskRoutes);
    await new Promise((resolve, reject) => {
        server = app.listen(0, "127.0.0.1", resolve);
        server.once("error", reject);
    });
    base = `http://127.0.0.1:${server.address().port}/api`;

    const fakeId = new mongoose.Types.ObjectId().toString();
    for (const who of [null, 5, 6]) {
        const status = who === null ? 401 : 403;
        await request("GET", "/notifications", undefined, who, status);
        await request("POST", "/notifications/sync", {}, who, status);
        await read(fakeId, true, who, status);
    }
    assert.equal(await Notification.countDocuments({}), 0);
    console.log("PASS 1: Inbox, sync and read actions require an active, verified session");

    const now = Date.now();
    const soonDate = new Date(now + 5 * 60000).toISOString();
    const linkedDate = new Date(now + 7 * 60000).toISOString();
    const overdueDate = new Date(now - 60 * 60000).toISOString();
    const laterDate = new Date(now + 2 * 3600000).toISOString();
    let soon = await createTask("Call tomorrow's prospect", soonDate);
    const overdue = await createTask("Overdue preparation", overdueDate);
    const undated = await createTask("No date yet", null);
    await createTask("Not due soon", laterDate);
    await closeTask(await createTask("Already completed", soonDate), "complete");
    await closeTask(await createTask("Already cancelled", soonDate), "cancel");
    const bobTask = await createTask("Another member's task", soonDate, 1);
    const adminTask = await createTask("Admin's own task", soonDate, 2);
    const leaderTask = await createTask("Leader's own task", soonDate, 3);
    // Represents an existing task after the owner becomes a viewer.
    const viewerTask = await Task.create({
        title: "Viewer's existing task", kind: "personal", dueAt: soonDate,
        assignedTo: users[4]._id, createdBy: users[4]._id,
    });
    const lead = await Lead.create({
        name: "Inbox test lead", phone: "0000000000", assignedTo: users[0]._id,
        createdBy: users[0]._id, followUpsMigratedAt: new Date(),
    });
    const linked = await createTask("Follow up with test lead", linkedDate, 0, {
        kind: "follow_up", leadId: lead._id.toString(),
    });
    const tasksBefore = await Task.find({ assignedTo: users[0]._id }).sort({ _id: 1 }).lean();
    const leadBefore = await Lead.findById(lead._id).lean();
    const activityBefore = await Activity.countDocuments({});
    assert.equal((await inbox()).pagination.total, 0);
    assert.equal(await Notification.countDocuments({}), 0);

    const concurrent = await Promise.all([sync(), sync(), sync()]);
    assert.equal(concurrent.reduce((total, result) => total + result.created, 0), 3);
    assert.equal(await Notification.countDocuments({ recipient: users[0]._id }), 3);
    let list = await inbox();
    assert.deepEqual(list.notifications.map((row) => row.task._id).sort(), [soon._id, overdue._id, linked._id].sort());
    assert.equal(list.unreadCount, 3);
    assert.deepEqual(await Task.find({ assignedTo: users[0]._id }).sort({ _id: 1 }).lean(), tasksBefore);
    assert.deepEqual(await Lead.findById(lead._id).lean(), leadBefore);
    assert.equal(await Activity.countDocuments({}), activityBefore);
    for (const row of list.notifications) {
        assert.ok(!Object.hasOwn(row, "eventKey"));
        assert.ok(!Object.hasOwn(row, "taskReminderRevision"));
        assert.ok(!Object.hasOwn(row.task, "reminderRevision"));
    }
    console.log("PASS 2: Concurrent syncs create only eligible owner reminders without changing tasks or leads");

    const originalSoon = list.notifications.find((row) => row.task._id === soon._id);
    const linkedNotification = list.notifications.find((row) => row.task._id === linked._id);
    assert.equal(originalSoon.scheduledFor, new Date(new Date(soonDate).getTime() - 15 * 60000).toISOString());
    const marked = (await read(originalSoon._id, true)).notification;
    assert.ok(marked.readAt);
    assert.equal((await sync()).created, 0);
    assert.equal((await read(originalSoon._id, true)).notification.readAt, marked.readAt);
    assert.equal((await inbox(0, "?unread=true")).pagination.total, 2);
    assert.equal((await inbox()).unreadCount, 2);
    await read(originalSoon._id, false);
    assert.equal((await inbox()).unreadCount, 3);
    const markedAgain = (await read(originalSoon._id, true)).notification;
    soon = await editTask(soon, { title: "Renamed task" });
    assert.equal((await sync()).created, 0);
    const renamed = (await inbox()).notifications.find((row) => row.task._id === soon._id);
    assert.equal(renamed._id, originalSoon._id);
    assert.equal(renamed.task.title, "Renamed task");
    assert.equal(renamed.readAt, markedAgain.readAt);
    assert.equal((await Task.findById(soon._id)).reminderRevision, 0);
    console.log("PASS 3: Read state persists through retries and title edits; marking unread works");

    soon = await editTask(soon, { dueAt: laterDate });
    assert.ok(!(await inbox()).notifications.some((row) => row.task._id === soon._id));
    assert.equal((await sync()).created, 0);
    await read(originalSoon._id, false, 0, 404);
    soon = await editTask(soon, { dueAt: soonDate });
    assert.equal((await Task.findById(soon._id)).reminderRevision, 2);
    assert.equal((await sync()).created, 1);
    const rescheduled = (await inbox()).notifications.find((row) => row.task._id === soon._id);
    assert.notEqual(rescheduled._id, originalSoon._id);
    assert.equal(rescheduled.readAt, null);
    soon = await editTask(soon, { dueAt: null });
    assert.ok(!(await inbox()).notifications.some((row) => row.task._id === soon._id));
    soon = await editTask(soon, { dueAt: soonDate });
    assert.equal((await sync()).created, 1);
    const restored = (await inbox()).notifications.find((row) => row.task._id === soon._id);
    assert.notEqual(restored._id, rescheduled._id);
    console.log("PASS 4: Rescheduling away and back, or clearing and restoring a date, creates a new occurrence");

    await closeTask(soon, "complete");
    await closeTask(overdue, "cancel");
    const remaining = await inbox(0, "?limit=1");
    assert.equal(remaining.pagination.total, 1);
    assert.equal(remaining.unreadCount, 1);
    assert.equal(remaining.notifications[0]._id, linkedNotification._id);
    assert.ok(await Notification.exists({ _id: restored._id }));
    await read(restored._id, true, 0, 404);
    console.log("PASS 5: Completed/cancelled occurrences leave the active inbox before pagination and counts");

    for (const [who, task] of [[1, bobTask], [2, adminTask], [3, leaderTask], [4, viewerTask]]) {
        assert.equal((await sync(who)).created, 1);
        const own = await inbox(who);
        assert.deepEqual(own.notifications.map((row) => row.task._id), [task._id.toString()]);
        await read(linkedNotification._id, true, who, 404);
        await read(own.notifications[0]._id, true, who);
    }
    await request("PATCH", `/tasks/${viewerTask._id}`, { version: 0, title: "Forbidden" }, 4, 403);
    await request("POST", "/notifications/sync", { user: users[0]._id.toString() }, 2, 400);
    await request("GET", `/notifications?recipient=${users[0]._id}`, undefined, 2, 400);
    console.log("PASS 6: Admins/leaders still see only their own reminders; viewers can manage their read state");

    // Simulate access changes and an orphaned task; team assignment UI is separate.
    await Lead.updateOne({ _id: lead._id }, { $set: { assignedTo: users[1]._id } });
    let hidden = await inbox(0, "?limit=1");
    assert.equal(hidden.pagination.total, 0);
    assert.equal(hidden.unreadCount, 0);
    assert.deepEqual(hidden.notifications, []);
    await read(linkedNotification._id, true, 0, 404);
    assert.equal((await sync()).created, 0);
    await Lead.updateOne({ _id: lead._id }, { $set: { assignedTo: users[0]._id } });
    assert.equal((await inbox()).notifications[0]._id, linkedNotification._id);
    assert.equal((await sync()).created, 0);
    await Lead.deleteOne({ _id: lead._id });
    assert.ok(await Task.exists({ _id: linked._id }));
    hidden = await inbox();
    assert.equal(hidden.pagination.total, 0);
    assert.equal(hidden.unreadCount, 0);
    await read(linkedNotification._id, true, 0, 404);
    const adminNotice = (await inbox(2)).notifications[0];
    await Task.deleteOne({ _id: adminTask._id });
    assert.equal((await inbox(2)).pagination.total, 0);
    await read(adminNotice._id, false, 2, 404);
    console.log("PASS 7: Lost lead access, deleted leads and deleted tasks cannot leak through rows, counts or read actions");

    const bobBefore = (await inbox(1)).notifications[0];
    await setPreferences({ inAppEnabled: false }, 1);
    await createTask("Created while reminders disabled", overdueDate, 1);
    const stopped = await sync(1);
    assert.equal(stopped.inAppEnabled, false);
    assert.equal(stopped.created, 0);
    assert.equal((await inbox(1)).notifications[0]._id, bobBefore._id);
    await setPreferences({ inAppEnabled: true, reminderMinutes: 0 }, 1);
    assert.equal((await sync(1)).created, 1);
    const halfHour = new Date(Date.now() + 30 * 60000).toISOString();
    const advanced = await createTask("Longer advance reminder", halfHour, 1);
    assert.equal((await sync(1)).created, 0);
    await setPreferences({ reminderMinutes: 60 }, 1);
    assert.equal((await sync(1)).created, 1);
    await setPreferences({ reminderMinutes: 0, timeZone: "Asia/Kolkata", dailyEmailEnabled: true }, 1);
    assert.equal((await sync(1)).created, 0);
    const bobAfter = await inbox(1);
    assert.ok(bobAfter.notifications.some((row) => row.task._id === advanced._id));
    assert.equal(bobAfter.notifications.find((row) => row._id === bobBefore._id).readAt, bobBefore.readAt);
    console.log("PASS 8: Disabling pauses new reminders; preference changes preserve existing occurrences and read state");

    // Older records without the new field use revision zero without a migration.
    const older = await createTask("Existing dated record", overdueDate);
    await Task.collection.updateOne({ _id: new mongoose.Types.ObjectId(older._id) }, {
        $unset: { reminderRevision: "" },
    });
    assert.equal((await sync()).created, 1);
    assert.equal((await sync()).created, 0);
    const oldNotice = (await inbox()).notifications.find((row) => row.task._id === older._id);
    assert.ok(oldNotice);
    assert.ok(!Object.hasOwn(await Task.collection.findOne({ _id: new mongoose.Types.ObjectId(older._id) }), "reminderRevision"));
    assert.equal(await Notification.countDocuments({ task: undated._id }), 0);
    console.log("PASS 9: Older tasks work without migration and synchronization leaves their records unchanged");

    await Task.insertMany(Array.from({ length: 53 }, (_, index) => ({
        title: `Backlog task ${index}`, kind: "personal", dueAt: overdueDate,
        assignedTo: users[7]._id, createdBy: users[7]._id,
    })));
    const firstBatch = await sync(7);
    assert.equal(firstBatch.created, 50);
    assert.equal(firstBatch.hasMore, true);
    const secondBatch = await sync(7);
    assert.equal(secondBatch.created, 3);
    assert.equal(secondBatch.hasMore, false);
    assert.equal((await sync(7)).created, 0);
    const page1 = await inbox(7, "?limit=20&page=1");
    const page2 = await inbox(7, "?limit=20&page=2");
    assert.equal(page1.pagination.total, 53);
    assert.equal(page1.unreadCount, 53);
    assert.equal(page1.notifications.length, 20);
    assert.equal(page2.notifications.length, 20);
    const ids = new Set(page1.notifications.map((row) => row._id));
    assert.ok(page2.notifications.every((row) => !ids.has(row._id)));
    console.log("PASS 10: Bounded batches finish the backlog and pagination does not repeat rows");

    for (const query of ["?page=0", "?limit=51", "?unread=maybe", "?unread=true&unread=false"]) {
        await request("GET", `/notifications${query}`, undefined, 0, 400);
    }
    await request("POST", "/notifications/sync?now=tomorrow", {}, 0, 400);
    await request("POST", "/notifications/sync", { reminderMinutes: 60 }, 0, 400);
    await request("PATCH", `/notifications/${oldNotice._id}/read`, { isRead: "true" }, 0, 400);
    await request("PATCH", `/notifications/${oldNotice._id}/read`, { isRead: true, recipient: users[1]._id.toString() }, 0, 400);
    await read("invalid-id", true, 0, 400);
    await read(fakeId, true, 0, 404);
    console.log("PASS 11: Invalid filters, IDs and caller-supplied scheduling/recipient fields are rejected");
}

async function main() {
    try {
        await run();
    } finally {
        try {
            if (server?.listening) {
                await new Promise((resolve, reject) => {
                    server.close((error) => error ? reject(error) : resolve());
                    server.closeIdleConnections();
                });
            }
        } finally {
            try {
                if (cleanupAllowed && mongoose.connection.readyState === 1 &&
                    mongoose.connection.db.databaseName === testDbName) {
                    for (const Model of [Notification, NotificationPreference, Activity, Task, Lead, User]) {
                        try { await Model.collection.drop(); }
                        catch (error) { if (error.code !== 26) throw error; }
                    }
                }
            } finally {
                await mongoose.disconnect();
            }
        }
    }
    console.log("ALL NOTIFICATION INBOX CHECKS PASSED; test collections removed");
}

main().catch((error) => {
    console.error("Notification inbox check failed:", error.name, error.code || "", error.message);
    process.exitCode = 1;
});
