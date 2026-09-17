const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Task = require("../models/Task");
const NotificationPreference = require("../models/NotificationPreference");
const DigestDelivery = require("../models/DigestDelivery");
const { readableTasks } = require("./taskService");
const { ROLES, digestError } = require("../utils/dailyDigest");

const QUERY_TIMEOUT_MS = 8000;
const CLAIM_LEASE_MS = 5 * 60000;
const ITEMS_PER_SECTION = 10;
const preparedDatabases = new WeakMap();

function createDailyDigestRepository({ recipientId = null } = {}) {
  if (recipientId !== null && !mongoose.isObjectIdOrHexString(recipientId)) {
    throw digestError("Invalid digest recipient", "DIGEST_SCOPE", 400);
  }

  const selectedRecipient = recipientId === null ? null : new mongoose.Types.ObjectId(recipientId);
  const assertScope = (recipient) => {
    if (selectedRecipient && !selectedRecipient.equals(recipient)) {
      throw digestError("This digest check is restricted to one account", "DIGEST_SCOPE", 400);
    }
  };

  const prepare = async () => {
    const { db, readyState } = mongoose.connection;
    if (readyState !== 1 || !db) throw digestError("Database is unavailable", "DIGEST_DATABASE");

    if (!preparedDatabases.has(db)) {
      preparedDatabases.set(db, (async () => {
        await DigestDelivery.init();
        await DigestDelivery.createCollection();
        // The UNIQUE database index, not an in-process flag, prevents duplicates.
        await DigestDelivery.createIndexes();
      })());
    }

    try { await preparedDatabases.get(db); }
    catch (error) { preparedDatabases.delete(db); throw error; }
  };

  const candidates = async ({ runDay, now, limit }) => {
    const rows = await NotificationPreference.aggregate([
      { $match: { dailyEmailEnabled: true, ...(selectedRecipient && { user: selectedRecipient }) } },
      {
        $lookup: {
          from: User.collection.name, localField: "user", foreignField: "_id",
          pipeline: [
            { $match: { isActive: true, isEmailVerified: true, systemRole: { $in: ROLES } } },
            { $project: { _id: 1 } },
          ], as: "account",
        }
      },
      { $match: { "account.0": { $exists: true } } },
      {
        $lookup: {
          from: DigestDelivery.collection.name, localField: "user", foreignField: "recipient",
          pipeline: [
            {
              $match: {
                runDay, $or: [
                  { status: { $ne: "claimed" } },
                  { leaseUntil: { $gt: now } },
                ]
              }
            },
            { $project: { _id: 1 } },
          ], as: "processed",
        }
      },
      // Remove completed/uncertain/live-claim records BEFORE limiting so that
      // a later invocation can reach recipients beyond the first batch.
      { $match: { "processed.0": { $exists: false } } },
      { $sort: { _id: 1 } },
      { $limit: limit },
      { $project: { user: 1 } },
    ]).option({ maxTimeMS: QUERY_TIMEOUT_MS });

    return rows.map((row) => row.user);
  };

  const claim = async ({ recipient, runDay, now }) => {
    assertScope(recipient);
    const claimToken = randomUUID();
    const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);

    let document;
    try {
      document = await DigestDelivery.create({
        recipient, runDay, claimToken, leaseUntil, status: "claimed",
      });
    } catch (error) {
      if (error.code !== 11000) throw error;

      document = await DigestDelivery.findOneAndUpdate({
        recipient, runDay, status: "claimed", leaseUntil: { $lte: now },
      }, { $set: { claimToken, leaseUntil, reason: null } }, {
        returnDocument: "after", runValidators: true,
      }).select("+claimToken").maxTimeMS(QUERY_TIMEOUT_MS).lean();
    }
    return document ? { id: document._id, recipient, runDay, claimToken } : null;
  };

  const claimFilter = (claim) => {
    assertScope(claim.recipient);
    return { _id: claim.id, recipient: claim.recipient, runDay: claim.runDay, claimToken: claim.claimToken };
  };

  const context = async (recipient) => {
    assertScope(recipient);
    const [user, preferences] = await Promise.all([
      User.findById(recipient).select("name email systemRole isActive isEmailVerified").maxTimeMS(QUERY_TIMEOUT_MS).lean(),
      NotificationPreference.findOne({ user: recipient }).select("dailyEmailEnabled timeZone __v").maxTimeMS(QUERY_TIMEOUT_MS).lean(),
    ]);
    return { user, preferences };
  };

  const summary = async (user, window) => {
    assertScope(user._id);
    const rows = (filter) => [
      { $match: filter }, { $sort: { dueAt: 1, _id: 1 } },
      { $limit: ITEMS_PER_SECTION },
      { $project: { title: 1, kind: 1, dueAt: 1 } },
    ];
    const overdue = { dueAt: { $lt: window.start } };
    const today = { dueAt: { $gte: window.start, $lt: window.end } };
    const [result] = await Task.aggregate([
      // Same owner AND live lead-access checks as the workspace and inbox.
      ...readableTasks(user, { status: "pending", dueAt: { $type: "date", $lt: window.end } }),
      {
        $facet: {
          overdueRows: rows(overdue), todayRows: rows(today),
          overdueCount: [{ $match: overdue }, { $count: "total" }],
          todayCount: [{ $match: today }, { $count: "total" }],
        }
      },
    ]).option({ maxTimeMS: QUERY_TIMEOUT_MS });
    return {
      overdue: { rows: result?.overdueRows ?? [], total: result?.overdueCount[0]?.total ?? 0 },
      today: { rows: result?.todayRows ?? [], total: result?.todayCount[0]?.total ?? 0 },
    };
  };

  const skip = async (claim, reason, now) => {
    await DigestDelivery.updateOne({ ...claimFilter(claim), status: "claimed" }, {
      $set: { status: "skipped", reason, finishedAt: now, leaseUntil: null },
    }, { runValidators: true }).maxTimeMS(QUERY_TIMEOUT_MS);
  };

  const release = async (claim) => {
    // Never reset a record that could already have started SMTP.
    await DigestDelivery.updateOne({ ...claimFilter(claim), status: "claimed" }, {
      $set: { leaseUntil: new Date(0), reason: "PREPARATION_FAILED" },
    }, { runValidators: true }).maxTimeMS(QUERY_TIMEOUT_MS);
  };

  const beginSend = async (claim, window, now) => {
    const result = await DigestDelivery.updateOne({
      ...claimFilter(claim), status: "claimed", leaseUntil: { $gt: now },
    }, {
      $set: {
        status: "sending", attemptedAt: now, leaseUntil: null,
        localDate: window.localDate, timeZone: window.timeZone, reason: null,
      }
    }, { runValidators: true }).maxTimeMS(QUERY_TIMEOUT_MS);
    return result.modifiedCount === 1;
  };

  const finish = async (claim, status, now) => {
    if (!["sent", "uncertain"].includes(status)) throw new Error("Invalid delivery outcome");
    const result = await DigestDelivery.updateOne({ ...claimFilter(claim), status: "sending" }, {
      $set: {
        status, finishedAt: now,
        reason: status === "uncertain" ? "SMTP_UNCONFIRMED" : null,
      },
    }, { runValidators: true }).maxTimeMS(QUERY_TIMEOUT_MS);
    if (result.matchedCount !== 1) throw new Error("Delivery outcome was not recorded");
  };

  const states = async (runDay) => {
    const [result] = await DigestDelivery.aggregate([
      { $match: { runDay, ...(selectedRecipient && { recipient: selectedRecipient }) } },
      {
        $facet: {
          unconfirmed: [{ $match: { status: { $in: ["sending", "uncertain"] } } }, { $count: "total" }],
          activeClaims: [{ $match: { status: "claimed" } }, { $count: "total" }],
        }
      },
    ]).option({ maxTimeMS: QUERY_TIMEOUT_MS });
    return {
      unconfirmed: result?.unconfirmed[0]?.total ?? 0,
      activeClaims: result?.activeClaims[0]?.total ?? 0,
    };
  };

  return { prepare, candidates, claim, context, summary, skip, release, beginSend, finish, states };
}

module.exports = { createDailyDigestRepository };
