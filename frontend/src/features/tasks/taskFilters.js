export const taskViews = [
    ["today", "Today"],
    ["overdue", "Overdue"],
    ["upcoming", "Upcoming"],
    ["pending", "All pending"],
    ["undated", "No date"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"],
];

export const defaultTaskFilters = {
    view: "today",
    kind: "all",
    search: "",
    completedPeriod: "all",
    page: 1,
};

export const taskViewDescriptions = {
    today: "Pending tasks due today, including any already overdue.",
    overdue: "Pending tasks whose due time has passed.",
    upcoming: "Pending tasks due from tomorrow onward.",
    pending: "All pending tasks, including those without a date.",
    undated: "Personal tasks without a due date.",
    completed: "Completed tasks, filtered by completion date.",
    cancelled: "Cancelled tasks kept in your history.",
};

export function buildTaskQuery(filters, now) {
    const day = (offset) => {
        const date = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + offset
        );

        return date.toISOString();
    };

    const query = {
        status: "pending",
        kind: filters.kind,
        search: filters.search,
        page: filters.page,
        limit: 12,
    };

    if (filters.view === "today") {
        query.dueFrom = day(0);
        query.dueBefore = day(1);
    } else if (filters.view === "overdue") {
        query.dueBefore = now.toISOString();
    } else if (filters.view === "upcoming") {
        query.dueFrom = day(1);
    } else if (filters.view === "undated") {
        query.kind = "personal";
        query.undated = true;
    } else if (filters.view === "completed") {
        query.status = "completed";

        if (filters.completedPeriod !== "all") {
            const offset = filters.completedPeriod === "yesterday" ? -1 : 0;

            query.completedFrom = day(offset);
            query.completedBefore = day(offset + 1);
        }
    } else if (filters.view === "cancelled") {
        query.status = "cancelled";
    }

    return query;
}

export function formatTaskDate(value) {
    if (!value) return "No date";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}