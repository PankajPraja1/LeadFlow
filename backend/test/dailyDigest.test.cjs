const assert = require("node:assert/strict");
const {
  clientOrigin, checkCronAuthorization, localDayWindow, eligibleRecipient,
  buildDigestEmail, smtpAccepted,
} = require("../src/utils/dailyDigest");
const { createDailyDigestRunner } = require("../src/services/dailyDigestRunner");
const {
  parseDigestCheckArguments, assertDigestCheckEnvironment, singleRecipientSender,
} = require("../scripts/checkDailyDigest.cjs");

const id = (number) => number.toString(16).padStart(24, "0");
const instant = new Date("2026-09-16T03:10:00.000Z");
const copy = (value) => structuredClone(value);
const makeContext = (number = 1) => ({
  user: { _id: id(number), name: "Test Member", email: `member${number}@example.test`,
    systemRole: "member", isActive: true, isEmailVerified: true },
  preferences: { dailyEmailEnabled: true, timeZone: "Asia/Kolkata", __v: 0 },
});
const sampleSummary = () => ({
  overdue: { total: 1, rows: [{ title: "Prepare contact list", kind: "personal",
    dueAt: new Date("2026-09-14T12:00:00Z") }] },
  today: { total: 1, rows: [{ title: "Call test lead", kind: "follow_up",
    dueAt: new Date("2026-09-16T08:00:00Z") }] },
});

// This fake exercises the runner's behavior. Real MongoDB queries/indexes are
// tested separately in dailyDigest.integration.cjs, not simulated here.
function harness(count = 1) {
  const contexts = new Map(Array.from({ length: count }, (_, index) => {
    const context = makeContext(index + 1);
    return [context.user._id, context];
  }));
  const deliveries = new Map();
  const outbox = [];
  let currentTime = copy(instant);
  let elapsed = 0;
  let sequence = 0;
  const controls = { summary: null, onContext: null, finishFails: false, send: null };
  const matching = (claim) => {
    const row = deliveries.get(`${claim.recipient}:${claim.runDay}`);
    return row?.claimToken === claim.claimToken ? row : null;
  };
  const repository = {
    prepare: async () => {},
    candidates: async ({ runDay, now, limit }) => [...contexts.values()]
      .filter(eligibleRecipient)
      .filter(({ user }) => {
        const row = deliveries.get(`${user._id}:${runDay}`);
        return !row || (row.status === "claimed" && row.leaseUntil <= now);
      }).slice(0, limit).map(({ user }) => user._id),
    claim: async ({ recipient, runDay, now }) => {
      const key = `${recipient}:${runDay}`;
      const existing = deliveries.get(key);
      if (existing && !(existing.status === "claimed" && existing.leaseUntil <= now)) return null;
      const claim = { recipient, runDay, claimToken: String(++sequence) };
      deliveries.set(key, { ...claim, status: "claimed", leaseUntil: new Date(now.getTime() + 300000) });
      return claim;
    },
    context: async (recipient) => {
      if (controls.onContext) controls.onContext(recipient);
      return copy(contexts.get(recipient));
    },
    summary: async (user, window) => controls.summary
      ? controls.summary(user, window) : sampleSummary(),
    skip: async (claim, reason) => {
      const row = matching(claim);
      if (row?.status === "claimed") Object.assign(row, { status: "skipped", reason });
    },
    release: async (claim) => {
      const row = matching(claim);
      if (row?.status === "claimed") row.leaseUntil = new Date(0);
    },
    beginSend: async (claim, window, now) => {
      const row = matching(claim);
      if (!row || row.status !== "claimed" || row.leaseUntil <= now) return false;
      Object.assign(row, { status: "sending", localDate: window.localDate });
      return true;
    },
    finish: async (claim, status) => {
      if (controls.finishFails) throw new Error("Simulated database write loss");
      const row = matching(claim);
      assert.equal(row.status, "sending");
      row.status = status;
    },
    states: async (runDay) => {
      const rows = [...deliveries.values()].filter((row) => row.runDay === runDay);
      return {
        unconfirmed: rows.filter((row) => ["sending", "uncertain"].includes(row.status)).length,
        activeClaims: rows.filter((row) => row.status === "claimed").length,
      };
    },
  };
  const sendEmail = async (message) => {
    outbox.push(message);
    return controls.send ? controls.send(message) : { accepted: [message.to] };
  };
  const run = createDailyDigestRunner({ repository, sendEmail,
    clock: () => copy(currentTime), monotonic: () => elapsed });
  return {
    run: () => run({ origin: "https://leadflow.example.test" }), repository, controls,
    contexts, deliveries, outbox,
    setTime: (value) => { currentTime = new Date(value); },
    setElapsed: (value) => { elapsed = value; },
  };
}

async function main() {
  const india = localDayWindow(instant, "Asia/Kolkata");
  assert.equal(india.localDate, "2026-09-16");
  assert.equal(india.start.toISOString(), "2026-09-15T18:30:00.000Z");
  assert.equal(india.end.toISOString(), "2026-09-16T18:30:00.000Z");
  const spring = localDayWindow(new Date("2026-03-08T12:00:00Z"), "America/New_York");
  const autumn = localDayWindow(new Date("2026-11-01T12:00:00Z"), "America/New_York");
  assert.equal((spring.end - spring.start) / 3600000, 23);
  assert.equal((autumn.end - autumn.start) / 3600000, 25);
  const midnight = localDayWindow(new Date("2026-09-16T00:00:00Z"), "UTC");
  assert.equal(midnight.start.toISOString(), "2026-09-16T00:00:00.000Z");
  assert.equal(midnight.end.toISOString(), "2026-09-17T00:00:00.000Z");
  assert.throws(() => localDayWindow(instant, "Invalid/Zone"));
  assert.throws(() => localDayWindow(instant, "+05:30"));
  assert.throws(() => localDayWindow(new Date("invalid"), "UTC"));
  console.log("PASS 1: Local dates and day boundaries handle India, UTC and daylight-saving changes");

  const secret = "x".repeat(64);
  assert.ok(checkCronAuthorization(`Bearer ${secret}`, secret));
  assert.ok(!checkCronAuthorization(`Bearer ${"y".repeat(64)}`, secret));
  assert.ok(!checkCronAuthorization(undefined, secret));
  assert.ok(!checkCronAuthorization(`Bearer ${secret} `, secret));
  assert.throws(() => checkCronAuthorization("anything", "short"));
  assert.throws(() => checkCronAuthorization("anything", undefined));
  assert.equal(clientOrigin("https://leadflow.example.test/"), "https://leadflow.example.test");
  assert.equal(clientOrigin("http://localhost:5173"), "http://localhost:5173");
  for (const value of ["javascript:alert(1)", "http://external.example.test", "https://x.test/path",
    "https://user:pass@x.test", "https://x.test?redirect=bad", "https://x.test/#hash"]) {
    assert.throws(() => clientOrigin(value));
  }
  console.log("PASS 2: Scheduler authorization fails closed and frontend links use a validated origin");

  const context = makeContext();
  context.user.name = '<img src=x onerror="alert(1)">';
  const summary = sampleSummary();
  summary.today.rows[0].title = '<script>alert("task")</script> & review';
  summary.today.total = 15;
  const email = buildDigestEmail({ user: context.user, summary, window: india,
    origin: "https://leadflow.example.test" });
  assert.ok(!email.html.includes("<img"));
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.html.includes("&lt;script&gt;"));
  assert.ok(email.text.includes("14 more"));
  assert.ok(email.text.includes("Asia/Kolkata"));
  assert.ok(email.html.includes("/settings/notifications"));
  assert.equal(email.to, context.user.email);
  assert.ok(smtpAccepted({ accepted: [context.user.email.toUpperCase()] }, context.user.email));
  assert.ok(!smtpAccepted({ accepted: [] }, context.user.email));
  assert.ok(!smtpAccepted(undefined, context.user.email));
  console.log("PASS 3: Email content is escaped, bounded, and includes the saved time zone and settings link");

  const concurrent = harness(4);
  await Promise.all([concurrent.run(), concurrent.run(), concurrent.run()]);
  assert.equal(concurrent.outbox.length, 4);
  assert.equal(new Set(concurrent.outbox.map((message) => message.to)).size, 4);
  assert.equal((await concurrent.run()).sent, 0);
  concurrent.contexts.get(id(1)).preferences.timeZone = "America/New_York";
  concurrent.contexts.get(id(1)).user.email = "new-address@example.test";
  assert.equal((await concurrent.run()).sent, 0);
  concurrent.setTime("2026-09-17T03:10:00Z");
  assert.equal((await concurrent.run()).sent, 4);
  console.log("PASS 4: Overlapping runs and account/time-zone changes do not repeat a UTC-day attempt");

  const eligibility = harness(6);
  eligibility.contexts.get(id(1)).preferences.dailyEmailEnabled = false;
  eligibility.contexts.get(id(2)).user.isActive = false;
  eligibility.contexts.get(id(3)).user.isEmailVerified = false;
  eligibility.contexts.get(id(4)).user.systemRole = "unknown";
  eligibility.contexts.get(id(5)).user.email = "bad\naddress@example.test";
  eligibility.contexts.get(id(6)).user.systemRole = "viewer";
  assert.equal((await eligibility.run()).sent, 1);
  assert.equal(eligibility.outbox[0].to, "member6@example.test");
  const empty = harness();
  empty.controls.summary = () => ({ overdue: { total: 0, rows: [] }, today: { total: 0, rows: [] } });
  assert.equal((await empty.run()).skipped, 1);
  assert.equal(empty.outbox.length, 0);
  console.log("PASS 5: Only opted-in active verified accounts qualify; viewers are allowed and empty digests are skipped");

  const changed = harness();
  let reads = 0;
  changed.controls.onContext = () => {
    if (++reads === 2) changed.contexts.get(id(1)).preferences.dailyEmailEnabled = false;
  };
  assert.equal((await changed.run()).skipped, 1);
  assert.equal(changed.outbox.length, 0);
  const changedEmail = harness();
  reads = 0;
  changedEmail.controls.onContext = () => {
    if (++reads === 2) changedEmail.contexts.get(id(1)).user.email = "changed@example.test";
  };
  assert.equal((await changedEmail.run()).skipped, 1);
  assert.equal(changedEmail.outbox.length, 0);
  console.log("PASS 6: Opt-out and recipient changes during preparation stop delivery");

  const uncertain = harness();
  uncertain.controls.send = () => { throw new Error("Connection lost after potential acceptance"); };
  assert.equal((await uncertain.run()).uncertain, 1);
  assert.equal((await uncertain.run()).unconfirmed, 1);
  assert.equal(uncertain.outbox.length, 1);
  const lostWrite = harness();
  lostWrite.controls.finishFails = true;
  assert.equal((await lostWrite.run()).uncertain, 1);
  assert.equal((await lostWrite.run()).sent, 0);
  assert.equal(lostWrite.outbox.length, 1);
  const unaccepted = harness();
  unaccepted.controls.send = () => ({ accepted: [] });
  assert.equal((await unaccepted.run()).uncertain, 1);
  assert.equal((await unaccepted.run()).sent, 0);
  console.log("PASS 7: Uncertain SMTP and post-send database failures never trigger a blind resend");

  const preparation = harness();
  preparation.controls.summary = () => { throw new Error("Temporary read failure"); };
  const failed = await preparation.run();
  assert.equal(failed.failed, 1);
  assert.ok(failed.hasMore);
  assert.equal(preparation.outbox.length, 0);
  preparation.controls.summary = null;
  assert.equal((await preparation.run()).sent, 1);
  console.log("PASS 8: Failures before SMTP release the claim for a later safe attempt");

  const batches = harness(51);
  const first = await batches.run();
  assert.equal(first.sent, 50);
  assert.ok(first.hasMore);
  const second = await batches.run();
  assert.equal(second.sent, 1);
  assert.ok(!second.hasMore);
  const budget = harness(8);
  budget.controls.send = (message) => {
    budget.setElapsed(130000);
    return { accepted: [message.to] };
  };
  const partial = await budget.run();
  assert.ok(partial.hasMore);
  assert.ok(partial.sent >= 1 && partial.sent <= 2);
  console.log("PASS 9: Batches and runtime budget leave unprocessed users available to a later invocation");

  const argumentsList = ["--email", "  OWNER@example.test  ", "--database", "leadflow"];
  assert.deepEqual(parseDigestCheckArguments(argumentsList), {
    send: false, email: "owner@example.test", database: "leadflow",
  });
  assert.equal(parseDigestCheckArguments([...argumentsList, "--send"]).send, true);
  assert.deepEqual(parseDigestCheckArguments(["--help"]), { help: true });
  for (const invalid of [[], ["--email"], ["--email", "--database", "leadflow"],
    [...argumentsList, "--force"], [...argumentsList, "--send", "false"],
    [...argumentsList, "--send", "--send"], [...argumentsList, "--email", "other@example.test"],
    ["--email", "Name <owner@example.test>", "--database", "leadflow"],
    ["--email", "owner@example.test", "--database", "wrong/database"]]) {
    assert.throws(() => parseDigestCheckArguments(invalid), { code: "DIGEST_CHECK" });
  }
  const localEnvironment = { DAILY_DIGEST_ENABLED: "false", MONGODB_URI: "test-placeholder" };
  assert.doesNotThrow(() => assertDigestCheckEnvironment(localEnvironment));
  for (const invalid of [{}, { ...localEnvironment, DAILY_DIGEST_ENABLED: "true" },
    { ...localEnvironment, DAILY_DIGEST_ENABLED: undefined },
    { ...localEnvironment, MONGODB_URI: "" }, { ...localEnvironment, VERCEL: "1" },
    { ...localEnvironment, VERCEL_ENV: "preview" }]) {
    assert.throws(() => assertDigestCheckEnvironment(invalid), { code: "DIGEST_CHECK" });
  }
  const checkedOutbox = [];
  const checkedSender = singleRecipientSender("owner@example.test", async (message) => {
    checkedOutbox.push(message);
    return { accepted: [message.to] };
  });
  for (const invalid of [undefined, { to: "someone-else@example.test" },
    { to: ["owner@example.test"] }, { to: "owner@example.test,other@example.test" }]) {
    await assert.rejects(() => checkedSender(invalid), { code: "DIGEST_CHECK" });
  }
  assert.equal(checkedOutbox.length, 0);
  assert.deepEqual(await checkedSender({ to: "OWNER@example.test" }), {
    accepted: ["OWNER@example.test"],
  });
  assert.equal(checkedOutbox.length, 1);
  console.log("PASS 10: The local check defaults to preview, requires disabled scheduling, and sends only to its selected email");

  console.log("ALL DAILY DIGEST LOGIC CHECKS PASSED; no database or email used");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
