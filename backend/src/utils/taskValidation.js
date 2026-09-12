const mongoose = require("mongoose");

const taskError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const assertTaskUser = (user, write = false) => {
    if (!mongoose.isObjectIdOrHexString(user?._id)) {
        throw taskError(401, "Authentication required");
    }

    const roles = write ? ["admin", "leader", "member"] : ["admin", "leader", "member", "viewer"];

    if (!roles.includes(user.systemRole)) {
        throw taskError(403, "You do not have permission to perform this task action");
    }
};

const taskId = (value, label = "Task ID") => {
    if (!mongoose.isObjectIdOrHexString(value)) {
        throw taskError(400, `${label} is invalid`);
    }

    return new mongoose.Types.ObjectId(value);
};

const taskBody = (body, allowed) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw taskError(400, "A JSON object is required");
    }

    if (Object.keys(body).some((key) => !allowed.includes(key))) {
        throw taskError(400, "Request contains an unsupported field");
    }
};

const taskText = (value, label, max, required = false) => {
    if (typeof value !== "string") {
        throw taskError(400, `${label} must be text`);
    }

    const text = value.trim();

    if ((required && !text) || text.length > max) {
        throw taskError(400, `${label} must contain ${required ? "1" : "0"}–${max} characters`);
    }

    return text;
};

// Accept UTC ISO timestamps, with optional 1–3 digit milliseconds.
const taskDate = (value, label = "Date") => {
    if (value === null || value === undefined) return null;

    const match = typeof value === "string" && /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);

    if (!match) {
        throw taskError(400, `${label} must be a UTC ISO timestamp`);
    }

    const canonical = `${match[1]}.${(match[2] || "").padEnd(3, "0")}Z`;

    const date = new Date(canonical);

    if (Number.isNaN(date.getTime()) || date.toISOString() !== canonical) {
        throw taskError(400, `${label} is invalid`);
    }

    return date;
};

const taskVersion = (value) => {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw taskError(400, "Provide the task's current version number");
    }

    return value;
};

const parseTaskQuery = (query) => {
    const allowed = [
        "status",
        "kind",
        "leadId",
        "search",
        "page",
        "limit",
        "dueFrom",
        "dueBefore",
        "completedFrom",
        "completedBefore",
        "undated",
    ];

    taskBody(query, allowed);

    for (const value of Object.values(query)) {
        if (typeof value !== "string") {
            throw taskError(400, "Query values must be single strings");
        }
    }

    const status = query.status ?? "pending";
    const kind = query.kind ?? "all";

    if (!["pending", "completed", "cancelled", "all"].includes(status) || !["personal", "follow_up", "all"].includes(kind)) {
        throw taskError(400, "Invalid task status or kind");
    }

    const integer = (value, fallback, max) => {
        if (value === undefined) return fallback;

        if (!/^[1-9]\d*$/.test(value) || Number(value) > max) {
            throw taskError(400, `Pagination values must be between 1 and ${max}`);
        }

        return Number(value);
    };

    const filter = {};

    if (status !== "all") filter.status = status;
    if (kind !== "all") filter.kind = kind;

    if (query.leadId !== undefined) {
        if (kind === "personal") {
            throw taskError(400, "Personal tasks cannot have a lead filter");
        }

        filter.lead = taskId(query.leadId, "Lead ID");
        filter.kind = "follow_up";
    }

    if (query.search !== undefined) {
        const search = taskText(query.search, "Search", 120);

        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            filter.$or = ["title", "description"].map((field) => ({
                [field]: { $regex: escaped, $options: "i" },
            }));
        }
    }

    const range = (from, before) => {
        const start = taskDate(query[from], from);
        const end = taskDate(query[before], before);

        if (start && end && start >= end) {
            throw taskError(400, "Date range must end after it starts");
        }

        return start || end
            ? {
                $ne: null,
                ...(start && { $gte: start }),
                ...(end && { $lt: end }),
            }
            : null;
    };

    const due = range("dueFrom", "dueBefore");
    const completed = range("completedFrom", "completedBefore");

    if (query.undated !== undefined && !["true", "false"].includes(query.undated)) {
        throw taskError(400, "undated must be true or false");
    }

    if (query.undated === "true") {
        if (due) {
            throw taskError(400, "Undated tasks cannot have a due-date range");
        }

        filter.dueAt = null;
    } else if (due) {
        filter.dueAt = due;
    } else if (query.undated === "false") {
        filter.dueAt = { $ne: null };
    }

    if (completed) {
        if (status !== "completed") {
            throw taskError(400, "Completion date filters require status=completed");
        }

        filter.completedAt = completed;
    }

    const sort =
        status === "completed"
            ? { completedAt: -1, _id: -1 } : status === "cancelled"
                ? { cancelledAt: -1, _id: -1 } : status === "all" || query.undated === "true"
                    ? { createdAt: -1, _id: -1 } : { dueAt: 1, _id: 1 };

    return {
        filter,
        sort,
        page: integer(query.page, 1, 10000),
        limit: integer(query.limit, 20, 50),
    };
};

module.exports = {
    taskError,
    assertTaskUser,
    taskId,
    taskBody,
    taskText,
    taskDate,
    taskVersion,
    parseTaskQuery,
};