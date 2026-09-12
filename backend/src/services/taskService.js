const Lead = require("../models/Lead");
const Task = require("../models/Task");

const { hasTeamAccess } = require("../utils/leadAccess");
const { recordActivity } = require("./activityService");

const { withLeadFollowUps, prepareFollowUpStorage, } = require("./followUpService");

const {
    taskError,
    assertTaskUser,
    taskId,
    taskBody,
    taskText,
    taskDate,
    taskVersion,
    parseTaskQuery, } = require("../utils/taskValidation");

const taskData = (task, lead = null) => ({
    _id: task._id,
    title: task.title,
    description: task.description,
    kind: task.kind,

    lead:
        task.kind === "follow_up" && lead
            ? {
                _id: lead._id,
                name: lead.name,
                status: lead.status,
            }
            : null,

    dueAt: task.dueAt ?? null,
    status: task.status,
    completedAt: task.completedAt ?? null,
    completionNote: task.completionNote,
    cancelledAt: task.cancelledAt ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    version: task.__v ?? 0,
});

// Apply lead access BEFORE counting or paginating tasks.
// This follows today's broad admin/leader lead rule.
const readableTasks = (user, filter) => [
    {
        $match: {
            ...filter,
            assignedTo: taskId(user._id, "User ID"),
        },
    },
    {
        $lookup: {
            from: Lead.collection.name,
            localField: "lead",
            foreignField: "_id",
            pipeline: [
                {
                    $match: hasTeamAccess(user) ? {} : { assignedTo: taskId(user._id, "User ID") },
                },
                {
                    $project: { name: 1, status: 1 },
                },
            ],
            as: "leadInfo",
        },
    },
    {
        $match: {
            $or: [
                { kind: "personal" },
                {
                    kind: "follow_up",
                    "leadInfo.0": { $exists: true },
                },
            ],
        },
    },
];

const listTasks = async ({ user, query = {} }) => {
    assertTaskUser(user);

    const { filter, sort, page, limit } = parseTaskQuery(query);

    const [result] = await Task.aggregate([
        ...readableTasks(user, filter),
        {
            $facet: {
                rows: [
                    { $sort: sort },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                ],
                count: [{ $count: "total" }],
            },
        },
    ]).option({ maxTimeMS: 10000 });

    const total = result?.count[0]?.total ?? 0;

    return {
        tasks: (result?.rows ?? []).map((task) => taskData(task, task.leadInfo[0])),
        pagination: {
            page,
            limit,
            total,
            pages: Math.max(1, Math.ceil(total / limit)),
        },
    };
};

const getTask = async ({ user, id }) => {
    assertTaskUser(user);

    const [task] = await Task.aggregate([
        ...readableTasks(user, { _id: taskId(id) }),
        { $limit: 1 },
    ]).option({ maxTimeMS: 10000 });

    if (!task) throw taskError(404, "Task not found");

    return taskData(task, task.leadInfo[0]);
};

const createTask = async ({ user, body }) => {
    assertTaskUser(user, true);

    taskBody(body, [
        "title",
        "description",
        "kind",
        "leadId",
        "dueAt",
    ]);

    if (!["personal", "follow_up"].includes(body.kind)) {
        throw taskError(400, "Task kind must be personal or follow_up");
    }

    const fields = {
        title: taskText(body.title, "Title", 120, true),
        description: taskText(
            body.description ?? "",
            "Description",
            2000
        ),
        kind: body.kind,
        dueAt: taskDate(body.dueAt, "Due date"),
        assignedTo: user._id,
        createdBy: user._id,
    };

    if (body.kind === "personal") {
        if (body.leadId != null) {
            throw taskError(400, "Personal tasks cannot be linked to a lead");
        }

        await prepareFollowUpStorage();

        return taskData(await new Task(fields).save());
    }

    const leadId = taskId(body.leadId, "Lead ID");

    if (!fields.dueAt) {
        throw taskError(400, "A follow-up requires a due date");
    }

    return withLeadFollowUps(
        { user, leadId },
        async ({ lead, session }) => {
            const task = await new Task({
                ...fields,
                lead: lead._id,
            }).save({ session });

            await recordActivity({
                leadId: lead._id,
                userId: user._id,
                taskId: task._id,
                type: "followup_created",
                description: "Scheduled a follow-up",
                changes: {
                    dueAt: {
                        from: null,
                        to: task.dueAt.toISOString(),
                    },
                },
                session,
            });

            return taskData(task, lead);
        }
    );
};

const mutateTask = async ({ user, id, body, action }) => {
    assertTaskUser(user, true);

    const allowed = {
        update: ["version", "title", "description", "dueAt"],
        complete: ["version", "completionNote"],
        cancel: ["version"],
    };

    if (!Object.hasOwn(allowed, action)) {
        throw taskError(400, "Unknown task action");
    }

    taskBody(body, allowed[action]);

    const version = taskVersion(body.version);
    const fields = {};

    if (action === "update") {
        if (Object.hasOwn(body, "title")) {
            fields.title = taskText(body.title, "Title", 120, true);
        }

        if (Object.hasOwn(body, "description")) {
            fields.description = taskText(
                body.description,
                "Description",
                2000
            );
        }

        if (Object.hasOwn(body, "dueAt")) {
            fields.dueAt = taskDate(body.dueAt, "Due date");
        }

        if (!Object.keys(fields).length) {
            throw taskError(400, "Provide a field to update");
        }
    } else if (action === "complete") {
        fields.completionNote = taskText(
            body.completionNote ?? "",
            "Completion note",
            1000
        );
    }

    const filter = {
        _id: taskId(id),
        assignedTo: taskId(user._id, "User ID"),
    };

    const reference = await Task.findOne(filter).select("kind lead").lean();

    if (!reference) throw taskError(404, "Task not found");

    const saveChange = async (session = null, lead = null) => {
        const query = Task.findOne({
            ...filter,
            kind: reference.kind,
            lead: reference.lead ?? null,
        });

        if (session) query.session(session);

        const task = await query;

        if (!task) throw taskError(404, "Task not found");

        if ((task.__v ?? 0) !== version) {
            throw taskError(409, "This task changed. Refresh it before trying again.");
        }

        if (task.status !== "pending") {
            throw taskError(409, "Only pending tasks can be changed");
        }

        if (task.kind === "follow_up" && fields.dueAt === null) {
            throw taskError(400, "A follow-up requires a due date");
        }

        const changes = {};

        const set = (key, value) => {
            const serial = (item) => item instanceof Date ? item.toISOString() : item ?? null;

            const from = serial(task.get(key));

            task.set(key, value);

            const to = serial(task.get(key));

            if (from !== to) changes[key] = { from, to };
        };

        for (const [key, value] of Object.entries(fields)) {
            set(key, value);
        }

        if (action === "complete") {
            set("status", "completed");
            set("completedAt", new Date());
        } else if (action === "cancel") {
            set("status", "cancelled");
            set("cancelledAt", new Date());
        }

        if (!Object.keys(changes).length) {
            return taskData(task, lead);
        }

        await task.save(session ? { session } : {});

        if (lead) {
            const type =
                action === "complete"
                    ? "followup_completed" : action === "cancel"
                        ? "followup_cancelled" : changes.dueAt
                            ? "followup_rescheduled" : "followup_updated";

            const descriptions = {
                followup_completed: "Completed a follow-up",
                followup_cancelled: "Cancelled a follow-up",
                followup_rescheduled: "Rescheduled a follow-up",
                followup_updated: "Updated follow-up details",
            };

            await recordActivity({
                leadId: lead._id,
                userId: user._id,
                taskId: task._id,
                type,
                description: descriptions[type],
                changes,
                session,
            });
        }

        return taskData(task, lead);
    };

    if (reference.kind === "personal") {
        return saveChange();
    }

    return withLeadFollowUps(
        { user, leadId: reference.lead },
        ({ lead, session }) => saveChange(session, lead)
    );
};

module.exports = {
    listTasks,
    getTask,
    createTask,
    mutateTask,
};