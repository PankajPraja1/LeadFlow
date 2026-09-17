const mongoose = require("mongoose");
const Task = require("../models/Task");
const Notification = require("../models/Notification");
const { getPreferences } = require("./notificationPreferenceService");
const { readableTasks } = require("./taskService");
const { assertTaskUser, taskId, taskBody, taskError } = require("../utils/taskValidation");

const BATCH_SIZE = 50;
const WRITE_CONCURRENCY = 5;
const preparedDatabases = new WeakMap();

const assertUser = (user) => {
  assertTaskUser(user);

  if (user.isActive !== true || user.isEmailVerified !== true) {
    throw taskError(403, "An active, verified account is required");
  }
};

const prepareStorage = async () => {
  const { db, readyState } = mongoose.connection;
  if (readyState !== 1 || !db) {
    throw taskError(503, "Database service is temporarily unavailable");
  }

  if (!preparedDatabases.has(db)) {
    const preparation = (async () => {
      await Notification.init();
      await Notification.createCollection();
      await Notification.createIndexes();
    })();

    preparedDatabases.set(db, preparation);
  }

  try {
    await preparedDatabases.get(db);
  } catch (error) {
    preparedDatabases.delete(db);
    throw error;
  }
};

// Use the same task-owner and current lead-access rules as the Task API.
// Match the current task schedule before returning rows or counting unread items.
const visibleNotifications = (user, filter = {}) => [
  { $match: { ...filter, recipient: taskId(user._id, "User ID") } },
  {
    $lookup: {
      from: Task.collection.name,
      localField: "task",
      foreignField: "_id",
      let: {
        due: "$taskDueAt",
        revision: { $ifNull: ["$taskReminderRevision", 0] },
      },
      pipeline: [
        ...readableTasks(user, {
          status: "pending",
          dueAt: { $type: "date" },
          $expr: {
            $and: [
              { $eq: ["$dueAt", "$$due"] },
              { $eq: [{ $ifNull: ["$reminderRevision", 0] }, "$$revision"] },
            ]
          },
        }),
      ],
      as: "taskInfo",
    }
  },
  { $unwind: "$taskInfo" },
];

const notificationData = (row) => {
  const task = row.taskInfo;
  const lead = task.leadInfo[0];

  return {
    _id: row._id,
    type: row.type,
    scheduledFor: row.scheduledFor,
    createdAt: row.createdAt,
    readAt: row.readAt ?? null,
    task: {
      _id: task._id,
      title: task.title,
      kind: task.kind,
      dueAt: task.dueAt,
      status: task.status,
      lead: task.kind === "follow_up" && lead ? { _id: lead._id, name: lead.name } : null,
    },
  };
};

const insertReminder = async (user, task, preferences, now) => {
  const recipient = taskId(user._id, "User ID");
  const filter = { recipient, eventKey: task.reminderEventKey };

  const document = new Notification({
    recipient,
    type: "task_reminder",
    task: task._id,
    taskDueAt: task.dueAt,
    taskReminderRevision: task.currentReminderRevision,
    scheduledFor: new Date(task.dueAt.getTime() - preferences.reminderMinutes * 60000),
    eventKey: task.reminderEventKey,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Query upserts do not run document validation hooks.
  await document.validate();

  try {
    const result = await Notification.updateOne(
      filter,
      { $setOnInsert: document.toObject() },
      { upsert: true, timestamps: false }
    ).maxTimeMS(10000);

    return result.upsertedCount ?? 0;
  } catch (error) {
    // A concurrent sync can win this same unique recipient/eventKey insert.
    if (error.code === 11000 && await Notification.exists(filter).maxTimeMS(10000)) {
      return 0;
    }
    throw error;
  }
};

const syncNotifications = async ({ user, body, query = {} }) => {
  assertUser(user);
  taskBody(query, []);
  taskBody(body ?? {}, []);
  await prepareStorage();
  const preferences = await getPreferences({ user });

  if (!preferences.inAppEnabled) {
    return { inAppEnabled: false, processed: 0, created: 0, hasMore: false };
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + preferences.reminderMinutes * 60000);

  const candidates = await Task.aggregate([
    ...readableTasks(user, {
      status: "pending",
      dueAt: { $type: "date", $lte: cutoff },
    }),
    { $set: { currentReminderRevision: { $ifNull: ["$reminderRevision", 0] } } },
    {
      $set: {
        reminderEventKey: {
          $concat: [
            "task_reminder:v1:", { $toString: "$_id" }, ":",
            { $toString: "$currentReminderRevision" }, ":",
            { $dateToString: { date: "$dueAt", format: "%Y-%m-%dT%H:%M:%S.%LZ", timezone: "UTC" } },
          ]
        }
      }
    },
    {
      $lookup: {
        from: Notification.collection.name,
        localField: "reminderEventKey",
        foreignField: "eventKey",
        pipeline: [
          { $match: { recipient: taskId(user._id, "User ID") } },
          { $project: { _id: 1 } },
        ],
        as: "existingReminder",
      }
    },
    // Exclude existing reminders BEFORE the limit so later tasks are not starved.
    { $match: { "existingReminder.0": { $exists: false } } },
    { $sort: { dueAt: 1, _id: 1 } },
    { $limit: BATCH_SIZE + 1 },
    { $project: { dueAt: 1, currentReminderRevision: 1, reminderEventKey: 1 } },
  ]).option({ maxTimeMS: 10000 });

  const batch = candidates.slice(0, BATCH_SIZE);
  let created = 0;

  for (let offset = 0; offset < batch.length; offset += WRITE_CONCURRENCY) {
    const results = await Promise.allSettled(
      batch.slice(offset, offset + WRITE_CONCURRENCY)
        .map((task) => insertReminder(user, task, preferences, now))
    );

    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    created += results.reduce((total, result) => total + result.value, 0);
  }

  // A concurrent task change may make an inserted reminder obsolete.
  // Every inbox read rechecks its live schedule and permissions before display.
  return {
    inAppEnabled: true,
    processed: batch.length,
    created,
    hasMore: candidates.length > BATCH_SIZE,
  };
};

const parseInboxQuery = (query) => {
  taskBody(query, ["page", "limit", "unread"]);

  if (Object.values(query).some((value) => typeof value !== "string")) {
    throw taskError(400, "Query values must be single strings");
  }

  const integer = (value, fallback, maximum) => {
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(value) || Number(value) > maximum) {
      throw taskError(400, `Pagination values must be between 1 and ${maximum}`);
    }
    return Number(value);
  };

  if (query.unread !== undefined && !["true", "false"].includes(query.unread)) {
    throw taskError(400, "unread must be true or false");
  }

  return {
    page: integer(query.page, 1, 10000),
    limit: integer(query.limit, 20, 50),
    onlyUnread: query.unread === "true",
  };
};

const listNotifications = async ({ user, query = {} }) => {
  assertUser(user);
  const { page, limit, onlyUnread } = parseInboxQuery(query);
  await prepareStorage();
  const selected = onlyUnread ? [{ $match: { readAt: null } }] : [];

  const [result] = await Notification.aggregate([
    ...visibleNotifications(user),
    {
      $facet: {
        rows: [
          ...selected,
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        count: [...selected, { $count: "total" }],
        unread: [{ $match: { readAt: null } }, { $count: "total" }],
      }
    },
  ]).option({ maxTimeMS: 10000 });

  const total = result?.count[0]?.total ?? 0;

  return {
    notifications: (result?.rows ?? []).map(notificationData),
    unreadCount: result?.unread[0]?.total ?? 0,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  };
};

const setNotificationRead = async ({ user, id, body, query = {} }) => {
  assertUser(user);
  taskBody(query, []);
  taskBody(body, ["isRead"]);

  if (typeof body.isRead !== "boolean") {
    throw taskError(400, "isRead must be true or false");
  }

  const filter = { _id: taskId(id, "Notification ID") };
  await prepareStorage();

  const findVisible = () => Notification.aggregate([
    ...visibleNotifications(user, filter),
    { $limit: 1 },
  ]).option({ maxTimeMS: 10000 });

  if (!(await findVisible())[0]) throw taskError(404, "Notification not found");

  await Notification.updateOne({
    ...filter,
    recipient: taskId(user._id, "User ID"),
    ...(body.isRead && { readAt: null }),
  }, {
    $set: { readAt: body.isRead ? new Date() : null },
  }).maxTimeMS(10000);

  const [updated] = await findVisible();

  if (!updated) throw taskError(404, "Notification not found");
  return { notification: notificationData(updated) };
};

module.exports = { syncNotifications, listNotifications, setNotificationRead };
