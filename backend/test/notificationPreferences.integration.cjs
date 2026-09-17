require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");

mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);
// Only this process uses this test key. The .env file is unchanged.
process.env.JWT_SECRET = randomBytes(32).toString("hex");

const User = require("../src/models/User");
const NotificationPreference = require("../src/models/NotificationPreference");
const notificationRoutes = require("../src/routes/notificationRoutes");

// Thirty bytes: within the Atlas database-name limit encountered earlier.
const testDbName = `lf_np_${randomBytes(12).toString("hex")}`;
const users = ["member", "member", "admin", "leader", "viewer", "member", "member"]
    .map((systemRole, index) => ({
        _id: new mongoose.Types.ObjectId(),
        name: `Preference check ${index}`,
        email: `preference-check-${index}@example.test`,
        systemRole,
        isActive: index !== 5,
        isEmailVerified: index !== 6,
        tokenVersion: 0,
        rank: null,
    }));

const tokens = users.map((user) => jwt.sign({
    userId: user._id.toString(),
    tokenVersion: 0,
}, process.env.JWT_SECRET, { expiresIn: "10m" }));

let server;
let endpoint;
let cleanupAllowed = false;

async function send(method, body, who = 0, query = "") {
    const response = await fetch(`${endpoint}${query}`, {
        method,
        signal: AbortSignal.timeout(20000),
        headers: {
            "Content-Type": "application/json",
            ...(who !== null && { Authorization: `Bearer ${tokens[who]}` }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    assert.equal(response.headers.get("cache-control"), "no-store");
    return { status: response.status, data };
}

async function request(method, body, who = 0, expected = 200, query = "") {
    const result = await send(method, body, who, query);
    assert.equal(result.status, expected, `${method}: ${JSON.stringify(result.data)}`);
    return result.data;
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
    const existingCollections = await mongoose.connection.db.listCollections().toArray();
    assert.equal(existingCollections.length, 0, "Refusing to use a nonempty test database");
    cleanupAllowed = true;

    await User.createCollection();
    // Fixtures bypass registration/password hashing; no mail sender is invoked.
    await User.collection.insertMany(users);

    const app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationRoutes);
    await new Promise((resolve, reject) => {
        server = app.listen(0, "127.0.0.1", resolve);
        server.once("error", reject);
    });
    endpoint = `http://127.0.0.1:${server.address().port}/api/notifications/preferences`;

    await request("GET", undefined, null, 401);
    await request("PATCH", { version: 0, reminderMinutes: 30 }, null, 401);
    for (const who of [5, 6]) {
        await request("GET", undefined, who, 403);
        await request("PATCH", { version: 0, reminderMinutes: 30 }, who, 403);
    }
    assert.equal(await NotificationPreference.countDocuments({}), 0);
    console.log("PASS 1: Both routes require an active, verified session");

    const defaults = {
        inAppEnabled: true,
        dailyEmailEnabled: false,
        reminderMinutes: 15,
        timeZone: "UTC",
        version: 0,
    };
    const firstReads = await Promise.all(
        Array.from({ length: 6 }, () => request("GET"))
    );
    for (const response of firstReads) assert.deepEqual(response.preferences, defaults);
    assert.equal(await NotificationPreference.countDocuments({ user: users[0]._id }), 1);
    console.log("PASS 2: Concurrent first reads create one set of safe defaults");

    let current = (await request("PATCH", {
        version: 0,
        inAppEnabled: false,
        reminderMinutes: 30,
        timeZone: "Asia/Kolkata",
    })).preferences;
    assert.deepEqual(current, {
        ...defaults,
        inAppEnabled: false,
        reminderMinutes: 30,
        timeZone: "Asia/Kolkata",
        version: 1,
    });
    assert.deepEqual((await request("GET")).preferences, current);

    const stale = await request("PATCH", { version: 0, reminderMinutes: 60 }, 0, 409);
    assert.equal(stale.code, "PREFERENCES_CONFLICT");
    assert.deepEqual((await request("GET")).preferences, current);
    console.log("PASS 3: Settings persist and stale saves cannot overwrite them");

    for (const who of [1, 2, 3, 4]) {
        assert.deepEqual((await request("GET", undefined, who)).preferences, defaults);
        const own = (await request("PATCH", { version: 0, reminderMinutes: 60 }, who)).preferences;
        assert.equal(own.reminderMinutes, 60);
        await request("PATCH", {
            version: own.version,
            user: users[0]._id.toString(),
            reminderMinutes: 0,
        }, who, 400);
        await request("GET", undefined, who, 400, `?user=${users[0]._id}`);
    }
    assert.deepEqual((await request("GET")).preferences, current);
    console.log("PASS 4: Every role, including viewers, can change only its own settings");

    const oldVersion = current.version;
    current = (await request("PATCH", {
        version: oldVersion,
        reminderMinutes: current.reminderMinutes,
    })).preferences;
    assert.equal(current.version, oldVersion + 1);
    await request("PATCH", { version: oldVersion, inAppEnabled: true }, 0, 409);

    const writes = await Promise.all([0, 60].map((reminderMinutes) => send("PATCH", {
        version: current.version,
        reminderMinutes,
    })));
    assert.deepEqual(writes.map((result) => result.status).sort(), [200, 409]);
    const winning = writes.find((result) => result.status === 200).data.preferences;
    assert.equal(winning.version, current.version + 1);
    current = (await request("GET")).preferences;
    assert.deepEqual(current, winning);
    console.log("PASS 5: Same-value and concurrent saves enforce version checks");

    const invalidBodies = [
        undefined,
        [],
        { version: current.version },
        { reminderMinutes: 15 },
        { version: "0", reminderMinutes: 15 },
        { version: -1, reminderMinutes: 15 },
        { version: current.version, inAppEnabled: "false" },
        { version: current.version, dailyEmailEnabled: 1 },
        { version: current.version, reminderMinutes: "15" },
        { version: current.version, reminderMinutes: 10 },
        { version: current.version, reminderMinutes: 0.5 },
        { version: current.version, timeZone: null },
        { version: current.version, timeZone: "" },
        { version: current.version, timeZone: "Mars/Olympus" },
        { version: current.version, timeZone: "+05:30" },
        { version: current.version, recipient: users[1]._id.toString(), reminderMinutes: 15 },
    ];
    for (const body of invalidBodies) await request("PATCH", body, 0, 400);
    await request("PATCH", { version: current.version, reminderMinutes: 15 }, 0, 400, "?user=someone");
    assert.deepEqual((await request("GET")).preferences, current);
    console.log("PASS 6: Invalid values and unsupported fields leave settings unchanged");

    const optedIn = (await request("PATCH", {
        version: current.version,
        dailyEmailEnabled: true,
    })).preferences;
    assert.equal(optedIn.dailyEmailEnabled, true);
    assert.equal(optedIn.inAppEnabled, current.inAppEnabled);
    assert.equal(optedIn.reminderMinutes, current.reminderMinutes);
    const optedOut = (await request("PATCH", {
        version: optedIn.version,
        dailyEmailEnabled: false,
    })).preferences;
    assert.equal(optedOut.dailyEmailEnabled, false);
    assert.equal(await NotificationPreference.countDocuments({}), 5);
    console.log("PASS 7: Email opt-in is explicit and independent of in-app settings");
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
                    for (const Model of [NotificationPreference, User]) {
                        try { await Model.collection.drop(); }
                        catch (error) { if (error.code !== 26) throw error; }
                    }
                }
            } finally {
                await mongoose.disconnect();
            }
        }
    }
    console.log("ALL NOTIFICATION PREFERENCES CHECKS PASSED; test collections removed");
}

main().catch((error) => {
    console.error("Notification preference check failed:", error.name, error.code || "", error.message);
    process.exitCode = 1;
});
