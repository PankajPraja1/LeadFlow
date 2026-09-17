require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const mongoose = require("mongoose");
const express = require("express");

mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);

const User = require("../src/models/User");
const Lead = require("../src/models/Lead");
const Task = require("../src/models/Task");
const NotificationPreference = require("../src/models/NotificationPreference");
const DigestDelivery = require("../src/models/DigestDelivery");
const { createDailyDigestRepository } = require("../src/services/dailyDigestRepository");
const { createDailyDigestRunner } = require("../src/services/dailyDigestRunner");
const { createDailyDigestRouter } = require("../src/routes/dailyDigestRoutes");
const { localDayWindow } = require("../src/utils/dailyDigest");

// Explicit short database override: never use the database embedded in the URI.
const testDbName = `lf_dd_${randomBytes(12).toString("hex")}`;
const now = new Date("2026-09-16T03:10:00Z");
const roles = ["member", "member", "admin", "leader", "viewer", "member", "member", "member", "member", "member"];
const users = roles.map((systemRole, index) => ({
  _id: new mongoose.Types.ObjectId(), name: `Digest test ${index}`,
  email: `digest-${index}@example.test`, systemRole,
  isActive: index !== 5, isEmailVerified: index !== 6,
}));
const outbox = [];
const mailFailures = new Set();
const repository = createDailyDigestRepository();
// The real Gmail sender is never called by this test.
const sendEmail = async (message) => {
  outbox.push(message);
  if (mailFailures.has(message.to)) throw new Error("Simulated SMTP outcome uncertainty");
  return { accepted: [message.to] };
};
const makeRunner = (repo = repository) => createDailyDigestRunner({
  repository: repo, sendEmail, clock: () => new Date(now),
});
const run = () => makeRunner()({ origin: "https://leadflow.example.test" });
const environment = {
  CRON_SECRET: randomBytes(32).toString("hex"),
  DAILY_DIGEST_ENABLED: "false", VERCEL_ENV: "production",
  CLIENT_URL: "https://leadflow.example.test",
  // Configuration placeholders for the injected test sender, never real SMTP.
  EMAIL_USER: "sender@example.test", EMAIL_APP_PASSWORD: "test-placeholder",
};
let connections = 0;
let server;
let base;
let cleanupAllowed = false;

const task = (who, title, dueAt, extra = {}) => Task.create({
  assignedTo: users[who]._id, createdBy: users[who]._id, title, dueAt,
  kind: "personal", description: "PRIVATE_TASK_DESCRIPTION", ...extra,
});
const preference = (who, extra = {}) => NotificationPreference.create({
  user: users[who]._id, dailyEmailEnabled: true, timeZone: "Asia/Kolkata", ...extra,
});

async function addRecipient(label) {
  const user = {
    _id: new mongoose.Types.ObjectId(), name: label, email: `${label}@example.test`,
    systemRole: "member", isActive: true, isEmailVerified: true,
  };
  const who = users.push(user) - 1;
  await User.collection.insertOne(user);
  await preference(who);
  await task(who, `${label} task`, new Date("2026-09-16T10:00:00Z"));
  return { user, who };
}

async function request({ method = "GET", authorization = `Bearer ${environment.CRON_SECRET}`,
  query = "", expected = 200 } = {}) {
  const response = await fetch(`${base}/api/cron/daily-digest${query}`, {
    method, signal: AbortSignal.timeout(30000),
    headers: authorization === null ? {} : { Authorization: authorization },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  assert.equal(response.status, expected, `${method}: ${JSON.stringify(body)}`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return body;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing");
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: testDbName, serverSelectionTimeoutMS: 10000, autoCreate: false, autoIndex: false,
  });
  assert.equal(mongoose.connection.db.databaseName, testDbName);
  assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0,
    "Refusing to modify a nonempty test database");
  cleanupAllowed = true;
  for (const Model of [User, Lead, Task, NotificationPreference]) await Model.createCollection();
  await NotificationPreference.createIndexes();
  await User.collection.insertMany(users);
  for (const who of [0, 1, 2, 3, 4, 5, 6, 7, 9]) {
    await preference(who, { dailyEmailEnabled: who !== 7 });
  }

  const app = express();
  app.use(express.json());
  app.use("/api/cron", createDailyDigestRouter({
    environment, run: run,
    connect: async () => { connections += 1; }, report: () => {},
  }));
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;

  await request({ authorization: null, expected: 401 });
  await request({ authorization: "Bearer wrong", expected: 401 });
  await request({ method: "POST", expected: 405 });
  await request({ method: "HEAD", expected: 405 });
  await request({ query: "?recipient=someone", expected: 400 });
  assert.equal((await request()).enabled, false);
  environment.DAILY_DIGEST_ENABLED = "true";
  environment.VERCEL_ENV = "preview";
  assert.equal((await request()).enabled, false);
  environment.VERCEL_ENV = "production";
  const secret = environment.CRON_SECRET;
  environment.CRON_SECRET = "";
  await request({ authorization: `Bearer ${secret}`, expected: 503 });
  environment.CRON_SECRET = secret;
  assert.equal(connections, 0);
  assert.equal(outbox.length, 0);
  console.log("PASS 1: Secret, method, input, disabled-feature and preview guards stop delivery before database work");

  const mine = await Lead.create({ name: "Private lead", phone: "PRIVATE_PHONE",
    assignedTo: users[0]._id, createdBy: users[0]._id });
  const other = await Lead.create({ name: "Other member lead", phone: "PRIVATE_OTHER_PHONE",
    assignedTo: users[1]._id, createdBy: users[1]._id });
  const viewerLead = await Lead.create({ name: "Viewer lead", phone: "PRIVATE_VIEWER_PHONE",
    assignedTo: users[4]._id, createdBy: users[4]._id });
  const overdue = await task(0, "Own overdue", new Date("2026-09-14T10:00:00Z"));
  const dayStart = await task(0, "At local midnight", new Date("2026-09-15T18:30:00Z"));
  const today = await task(0, "Own later today", new Date("2026-09-16T17:00:00Z"));
  await task(0, "Tomorrow excluded", new Date("2026-09-16T18:30:00Z"));
  await task(0, "Undated excluded", null);
  await task(0, "Completed excluded", now, { status: "completed", completedAt: now });
  await task(0, "Cancelled excluded", now, { status: "cancelled", cancelledAt: now });
  const linked = await task(0, "Accessible follow-up", now, { kind: "follow_up", lead: mine._id });
  await task(0, "Inaccessible follow-up excluded", now, { kind: "follow_up", lead: other._id });
  await task(0, "Deleted lead excluded", now,
    { kind: "follow_up", lead: new mongoose.Types.ObjectId() });
  for (const who of [1, 2, 3, 4, 5, 6, 7, 8]) await task(who, `Own task ${who}`, now);
  await task(2, "Admin accessible follow-up", now, { kind: "follow_up", lead: other._id });
  await task(3, "Leader accessible follow-up", now, { kind: "follow_up", lead: other._id });
  // A viewer may receive reminders for existing tasks without permission to edit them.
  await task(4, "Viewer accessible follow-up", now, { kind: "follow_up", lead: viewerLead._id });

  const window = localDayWindow(now, "Asia/Kolkata");
  const summary = await repository.summary(users[0], window);
  assert.equal(summary.overdue.total, 1);
  assert.equal(summary.today.total, 3);
  assert.deepEqual(summary.overdue.rows.map((row) => String(row._id)), [String(overdue._id)]);
  assert.deepEqual(summary.today.rows.map((row) => String(row._id)).sort(),
    [dayStart, today, linked].map((row) => String(row._id)).sort());
  for (const who of [2, 3, 4]) {
    const ownSummary = await repository.summary(users[who], window);
    assert.equal(ownSummary.today.total, 2);
    assert.ok(!ownSummary.today.rows.some((row) => row.title === "Own later today"));
  }
  const taskSnapshot = await Task.find().sort({ _id: 1 }).lean();
  const leadSnapshot = await Lead.find().sort({ _id: 1 }).lean();
  console.log("PASS 2: Queries use owner and current lead access before counting; local-day and task-status filters match");

  const results = await Promise.all([run(), run(), run()]);
  assert.equal(results.reduce((sum, result) => sum + result.sent, 0), 5);
  assert.equal(outbox.length, 5);
  assert.equal(new Set(outbox.map((message) => message.to)).size, 5);
  assert.equal(await DigestDelivery.countDocuments({}), 6);
  assert.equal(await DigestDelivery.countDocuments({ status: "skipped", reason: "NO_TASKS" }), 1);
  assert.ok((await DigestDelivery.collection.indexes()).some((index) =>
    index.unique && index.key.recipient === 1 && index.key.runDay === 1));
  assert.deepEqual(await Task.find().sort({ _id: 1 }).lean(), taskSnapshot);
  assert.deepEqual(await Lead.find().sort({ _id: 1 }).lean(), leadSnapshot);
  for (const message of outbox) {
    assert.ok(!message.html.includes("PRIVATE_"));
    assert.ok(!message.text.includes("PRIVATE_"));
  }
  assert.equal((await request()).sent, 0);
  assert.equal(outbox.length, 5);
  console.log("PASS 3: The real unique index prevents overlapping sends, limits recipients, and leaves task/lead data unchanged");

  await NotificationPreference.updateOne({ user: users[0]._id }, { $set: { timeZone: "America/New_York" } });
  await User.updateOne({ _id: users[0]._id }, { $set: { email: "changed@example.test" } });
  assert.equal((await run()).sent, 0);
  assert.equal(outbox.length, 5);
  const removed = await addRecipient("revoked-lead-access");
  await Task.deleteMany({ assignedTo: removed.user._id });
  const reassignable = await Lead.create({ name: "Reassigned lead", phone: "0000",
    assignedTo: removed.user._id, createdBy: removed.user._id });
  await task(removed.who, "Revoked task excluded", now, { kind: "follow_up", lead: reassignable._id });
  await Lead.updateOne({ _id: reassignable._id }, { $set: { assignedTo: users[1]._id } });
  assert.equal((await run()).sent, 0);
  assert.ok(!outbox.some((message) => message.to === removed.user.email));
  console.log("PASS 4: Email/time-zone edits do not bypass deduplication; revoked lead access is excluded");

  const recover = await addRecipient("expired-claim");
  const oldClaim = await repository.claim({ recipient: recover.user._id,
    runDay: "2026-09-16", now: new Date(now.getTime() - 600000) });
  const freshClaim = await repository.claim({ recipient: recover.user._id, runDay: "2026-09-16", now });
  assert.ok(freshClaim);
  assert.notEqual(oldClaim.claimToken, freshClaim.claimToken);
  assert.equal(await repository.beginSend(oldClaim, window, now), false);
  await repository.release(freshClaim);
  assert.equal((await run()).sent, 1);
  const interrupted = await addRecipient("interrupted-send");
  const interruptedClaim = await repository.claim({ recipient: interrupted.user._id,
    runDay: "2026-09-16", now });
  assert.ok(await repository.beginSend(interruptedClaim, window, now));
  assert.equal((await run()).sent, 0);
  assert.equal(await repository.claim({ recipient: interrupted.user._id,
    runDay: "2026-09-16", now: new Date(now.getTime() + 7200000) }), null);
  assert.ok(!outbox.some((message) => message.to === interrupted.user.email));
  await request({ expected: 503 });
  console.log("PASS 5: Expired preparation claims can recover, old holders lose access, and interrupted sends are never reclaimed");

  const uncertain = await addRecipient("smtp-uncertain");
  mailFailures.add(uncertain.user.email);
  assert.equal((await run()).uncertain, 1);
  assert.equal((await run()).uncertain, 0);
  assert.equal(outbox.filter((message) => message.to === uncertain.user.email).length, 1);
  assert.equal((await DigestDelivery.findOne({ recipient: uncertain.user._id })).status, "uncertain");
  console.log("PASS 6: Unconfirmed SMTP results remain recorded without a second delivery attempt");

  const optOut = await addRecipient("opt-out-during-run");
  const changingRepository = { ...repository, summary: async (user, range) => {
    const result = await repository.summary(user, range);
    if (String(user._id) === String(optOut.user._id)) {
      await NotificationPreference.updateOne({ user: user._id }, { $set: { dailyEmailEnabled: false } });
    }
    return result;
  } };
  assert.equal((await makeRunner(changingRepository)({ origin: environment.CLIENT_URL })).skipped, 1);
  assert.ok(!outbox.some((message) => message.to === optOut.user.email));
  assert.equal((await DigestDelivery.findOne({ recipient: optOut.user._id })).reason, "SETTINGS_CHANGED");
  const temporary = await addRecipient("preparation-retry");
  const failingRepository = { ...repository, summary: async () => { throw new Error("Simulated read failure"); } };
  assert.equal((await makeRunner(failingRepository)({ origin: environment.CLIENT_URL })).failed, 1);
  assert.equal((await run()).sent, 1);
  assert.equal(outbox.filter((message) => message.to === temporary.user.email).length, 1);
  console.log("PASS 7: Opt-out is rechecked before SMTP, while a pre-send read failure can recover safely");

  const selected = await addRecipient("selected-account");
  const unselected = await addRecipient("unselected-account");
  const scopedRepository = createDailyDigestRepository({ recipientId: selected.user._id });
  assert.throws(() => createDailyDigestRepository({ recipientId: "invalid" }), { code: "DIGEST_SCOPE" });
  const candidates = await scopedRepository.candidates({ runDay: "2026-09-16", now, limit: 50 });
  assert.deepEqual(candidates.map(String), [String(selected.user._id)]);
  await assert.rejects(() => scopedRepository.context(unselected.user._id), { code: "DIGEST_SCOPE" });
  await assert.rejects(() => scopedRepository.claim({ recipient: unselected.user._id,
    runDay: "2026-09-16", now }), { code: "DIGEST_SCOPE" });
  await assert.rejects(() => scopedRepository.summary(unselected.user, window), { code: "DIGEST_SCOPE" });
  await assert.rejects(() => scopedRepository.beginSend(interruptedClaim, window, now), { code: "DIGEST_SCOPE" });
  const scopedResult = await makeRunner(scopedRepository)({ origin: environment.CLIENT_URL });
  assert.equal(scopedResult.sent, 1);
  assert.equal(scopedResult.hasMore, false);
  assert.equal(scopedResult.unconfirmed, 0);
  assert.equal(scopedResult.activeClaims, 0);
  assert.equal(outbox.filter((message) => message.to === selected.user.email).length, 1);
  assert.equal(outbox.filter((message) => message.to === unselected.user.email).length, 0);
  assert.equal(await DigestDelivery.countDocuments({ recipient: unselected.user._id }), 0);
  const selectedDelivery = await DigestDelivery.findOne({ recipient: selected.user._id }).lean();
  assert.equal(selectedDelivery.status, "sent");
  assert.equal((await makeRunner(scopedRepository)({ origin: environment.CLIENT_URL })).sent, 0);
  assert.deepEqual(await DigestDelivery.findOne({ recipient: selected.user._id }).lean(), selectedDelivery);
  assert.equal(outbox.filter((message) => message.to === selected.user.email).length, 1);
  console.log("PASS 8: A selected-account check cannot claim, read tasks for, or send to another account");

  console.log("ALL DAILY DIGEST INTEGRATION CHECKS PASSED; only fake email was used");
}

main().catch((error) => {
  console.error("Daily digest integration check failed:", error.name, error.code ?? "");
  if (error.name === "AssertionError") console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (cleanupAllowed && mongoose.connection.db?.databaseName === testDbName &&
        /^lf_dd_[0-9a-f]{24}$/.test(testDbName)) {
      for (const Model of [DigestDelivery, NotificationPreference, Task, Lead, User]) {
        await Model.collection.drop().catch((error) => { if (error.code !== 26) throw error; });
      }
      console.log("Temporary digest test collections removed");
    }
  } catch (error) {
    console.error("Digest test cleanup failed:", error.name, error.code ?? "");
    process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
});
