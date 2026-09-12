require("dotenv").config({ quiet: true });

const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");

mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

// Only changes this test process.
process.env.JWT_SECRET = randomBytes(32).toString("hex");

const User = require("../src/models/User");
const Lead = require("../src/models/Lead");
const Task = require("../src/models/Task");
const Activity = require("../src/models/Activity");
const taskRoutes = require("../src/routes/taskRoutes");

const testDbName = `lfa_${randomUUID().replaceAll("-", "")}`;

const users = [
    "member",
    "member",
    "admin",
    "leader",
    "viewer",
].map((systemRole, i) => ({
    _id: new mongoose.Types.ObjectId(),
    name: `Task check ${i}`,
    email: `task-check-${i}@example.test`,
    systemRole,
    isActive: true,
    isEmailVerified: true,
    tokenVersion: 0,
    rank: null,
}));

const tokens = users.map((user) =>
    jwt.sign(
        {
            userId: user._id.toString(),
            tokenVersion: 0,
        },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
    )
);

let server;
let base;

async function request(
    method,
    path,
    body,
    who = 0,
    expected = 200
) {
    const response = await fetch(`${base}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(who !== null && {
                Authorization: `Bearer ${tokens[who]}`,
            }),
        },
        ...(body !== undefined && {
            body: JSON.stringify(body),
        }),
    });

    const result = await response.json();

    assert.equal(
        response.status,
        expected,
        `${method} ${path}: ${JSON.stringify(result)}`
    );

    return result;
}

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

    for (const Model of [User, Lead, Task, Activity]) {
        await Model.createCollection();
    }

    // Direct fixtures: no registration or email is sent.
    await User.collection.insertMany(users);

    const app = express();

    app.use(express.json());
    app.use("/api/tasks", taskRoutes);

    await new Promise((resolve, reject) => {
        server = app.listen(0, "127.0.0.1", resolve);
        server.once("error", reject);
    });

    base = `http://127.0.0.1:${server.address().port}/api/tasks`;

    await request("GET", "", undefined, null, 401);

    let personal = (
        await request(
            "POST",
            "",
            { kind: "personal", title: "Study [React]" },
            0,
            201
        )
    ).task;

    assert.equal(personal.dueAt, null);
    assert.equal(personal.version, 0);
    assert.equal(await Activity.countDocuments({}), 0);

    for (const who of [1, 2, 3]) {
        await request("GET", `/${personal._id}`, undefined, who, 404);

        await request(
            "PATCH",
            `/${personal._id}`,
            { version: 0, title: "Blocked" },
            who,
            404
        );

        assert.equal((await request("GET", "?status=all", undefined, who)).pagination.total, 0);
    }

    await request(
        "POST",
        "",
        {
            kind: "personal",
            title: "Blocked",
            assignedTo: users[1]._id,
        },
        0,
        400
    );

    console.log("PASS 1: Authentication and task-owner privacy apply to every role");

    personal = (
        await request("PATCH", `/${personal._id}`, {
            version: personal.version,
            title: "Updated [React]",
        })
    ).task;

    await request(
        "PATCH",
        `/${personal._id}`,
        { version: 0, title: "Stale" },
        0,
        409
    );

    personal = (
        await request("POST", `/${personal._id}/complete`, {
            version: personal.version,
            completionNote: "Finished",
        })
    ).task;

    assert.equal(personal.status, "completed");
    assert.ok(personal.completedAt);

    await request(
        "POST",
        `/${personal._id}/cancel`,
        { version: personal.version },
        0,
        409
    );

    assert.equal(await Activity.countDocuments({}), 0);

    console.log("PASS 2: Personal completion retains its outcome and rejects stale edits");

    const race = (
        await request(
            "POST",
            "",
            { kind: "personal", title: "Race check" },
            0,
            201
        )
    ).task;

    const writes = await Promise.all(
        ["First writer", "Second writer"].map((title) =>
            fetch(`${base}/${race._id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokens[0]}`,
                },
                body: JSON.stringify({
                    title,
                    version: race.version,
                }),
            }).then(async (response) => ({
                status: response.status,
                data: await response.json(),
            }))
        )
    );

    assert.deepEqual(writes.map((result) => result.status).sort(), [200, 409]);

    console.log("PASS 3: Concurrent edits cannot silently overwrite each other");

    const viewerTask = await Task.create({
        title: "Viewer's existing task",
        kind: "personal",
        assignedTo: users[4]._id,
        createdBy: users[4]._id,
    });

    await request("GET", `/${viewerTask._id}`, undefined, 4);

    await request(
        "POST",
        "",
        { kind: "personal", title: "Blocked" },
        4,
        403
    );

    await request(
        "PATCH",
        `/${viewerTask._id}`,
        { version: 0, title: "Blocked" },
        4,
        403
    );

    await request(
        "POST",
        `/${viewerTask._id}/complete`,
        { version: 0 },
        4,
        403
    );

    await request(
        "POST",
        `/${viewerTask._id}/cancel`,
        { version: 0 },
        4,
        403
    );

    console.log("PASS 4: Viewers can read their tasks and cannot modify them");

    const dateA = new Date(Date.now() + 86400000).toISOString();

    const dateB = new Date(Date.now() + 172800000).toISOString();

    const lead = await Lead.create({
        name: "Task API lead",
        phone: "0000000000",
        assignedTo: users[0]._id,
        createdBy: users[0]._id,
        followUpsMigratedAt: new Date(),
    });

    const followBody = {
        kind: "follow_up",
        title: "Call lead",
        leadId: lead._id,
        dueAt: dateA,
    };

    await request("POST", "", followBody, 1, 404);

    await request(
        "POST",
        "",
        { ...followBody, dueAt: null },
        0,
        400
    );

    let first = (await request("POST", "", followBody, 0, 201)).task;

    const second = (
        await request(
            "POST",
            "",
            {
                ...followBody,
                title: "Second call",
                dueAt: dateB,
            },
            0,
            201
        )
    ).task;

    const window = await request(
        "GET",
        `?kind=follow_up&dueFrom=${encodeURIComponent(dateA)}` +
        `&dueBefore=${encodeURIComponent(dateB)}`
    );

    assert.deepEqual(window.tasks.map((task) => task._id), [first._id]);

    assert.equal((await Lead.findById(lead._id)).nextFollowUp.toISOString(), dateA);

    console.log("PASS 5: Follow-up creation enforces lead access and exact date boundaries");

    first = (
        await request("PATCH", `/${first._id}`, {
            version: first.version,
            description: "Prepare questions",
        })
    ).task;

    assert.equal(
        await Activity.countDocuments({
            task: first._id,
            type: "followup_updated",
        }),
        1
    );

    await request(
        "PATCH",
        `/${first._id}`,
        { version: first.version, dueAt: null },
        0,
        400
    );

    const earlier = new Date(Date.now() + 3600000).toISOString();

    first = (
        await request("PATCH", `/${first._id}`, {
            version: first.version,
            dueAt: earlier,
        })
    ).task;

    assert.equal((await Lead.findById(lead._id)).nextFollowUp.toISOString(), earlier);

    first = (
        await request("POST", `/${first._id}/complete`, {
            version: first.version,
            completionNote: "Call finished",
        })
    ).task;

    assert.equal((await Lead.findById(lead._id)).nextFollowUp.toISOString(), dateB);

    assert.equal(
        await Activity.countDocuments({
            task: first._id,
            type: "followup_completed",
        }),
        1
    );

    console.log("PASS 6: Editing and completion keep tasks, lead dates and history consistent");

    // Simulate an access change for this test.
    await Lead.updateOne(
        { _id: lead._id },
        { assignedTo: users[1]._id }
    );

    await request("GET", `/${second._id}`, undefined, 0, 404);

    await request("GET", `/${second._id}`, undefined, 1, 404);

    await request(
        "POST",
        `/${second._id}/cancel`,
        { version: second.version },
        0,
        404
    );

    assert.equal((await request("GET", "?kind=follow_up&status=all")).pagination.total, 0);

    await Lead.updateOne(
        { _id: lead._id },
        { assignedTo: users[0]._id }
    );

    const cancelled = (
        await request("POST", `/${second._id}/cancel`, {
            version: second.version,
        })
    ).task;

    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.dueAt, dateB);

    assert.equal((await Lead.findById(lead._id)).nextFollowUp, null);

    console.log("PASS 7: Lost lead access hides linked tasks; cancellation preserves history");

    const found = await request("GET", "?status=all&search=%5BReact%5D");

    assert.deepEqual(
        found.tasks.map((task) => task._id),
        [personal._id]
    );

    const page1 = await request("GET", "?status=all&limit=1&page=1");

    const page2 = await request("GET", "?status=all&limit=1&page=2");

    assert.equal(page1.pagination.total, 4);
    assert.notEqual(page1.tasks[0]._id, page2.tasks[0]._id);

    assert.ok(!Object.hasOwn(page1.tasks[0], "legacyImported"));

    assert.equal(
        (
            await request(
                "GET", "?status=all&undated=true"
            )
        ).pagination.total,
        2
    );

    assert.equal(
        (
            await request(
                "GET", "?status=all&undated=false"
            )
        ).pagination.total,
        2
    );

    await request(
        "GET", "?page=0", undefined, 0, 400
    );

    await request(
        "GET",
        "?status=completed&completedFrom=2026-02-30T00:00:00Z",
        undefined,
        0,
        400
    );

    const completedFrom = new Date(
        new Date(personal.completedAt).getTime() - 1
    ).toISOString();

    const completedBefore = new Date(
        new Date(personal.completedAt).getTime() + 1
    ).toISOString();

    assert.equal(
        (
            await request(
                "GET",
                "?status=completed&kind=personal" +
                `&completedFrom=${encodeURIComponent(completedFrom)}` +
                `&completedBefore=${encodeURIComponent(completedBefore)}`
            )
        ).pagination.total,
        1
    );

    console.log(
        "PASS 8: Search, pagination, completion filters and input validation work"
    );

    const oldLead = await Lead.create({
        name: "Untouched old lead",
        phone: "0000000000",
        assignedTo: users[0]._id,
        createdBy: users[0]._id,
        nextFollowUp: dateA,
    });

    await request("GET", "?status=all");

    assert.equal(
        await Task.countDocuments({ lead: oldLead._id }),
        0
    );

    assert.equal(
        (
            await Lead.findById(oldLead._id)
                .select("+followUpsMigratedAt")
        ).followUpsMigratedAt,
        null
    );

    console.log(
        "PASS 9: Reading tasks does not trigger a migration or modify lead records"
    );
}

async function main() {
    try {
        await run();
    } finally {
        try {
            if (server?.listening) {
                await new Promise((resolve, reject) =>
                    server.close((error) =>
                        error ? reject(error) : resolve()
                    )
                );
            }
        } finally {
            try {
                if (
                    mongoose.connection.readyState === 1 &&
                    mongoose.connection.db.databaseName === testDbName
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
    }

    console.log(
        "ALL TASK API CHECKS PASSED; test server closed and test collections removed"
    );
}

main().catch((error) => {
    console.error(
        "Task API check failed:",
        error.name,
        error.code || "",
        error.message
    );

    process.exitCode = 1;
});