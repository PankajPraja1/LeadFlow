const service = require("../services/taskService");

const handle = (operation, status = 200) => async (req, res) => {
    try {
        const result = await operation(req);

        return res.status(status).json({
            success: true,
            ...result,
        });
    } catch (error) {
        let code = error.statusCode;
        let message = error.message;

        if (error.name === "ValidationError") {
            code = 400;
            message = Object.values(error.errors)[0]?.message || "Invalid task data";
        } else if (error.name === "CastError") {
            code = 400;
            message = "Invalid task data";
        } else if (error.name === "VersionError") {
            code = 409;
            message = "This task changed. Refresh it before trying again.";
        }

        if (![400, 401, 403, 404, 409, 503].includes(code)) {
            console.error("Task request failed:", {
                name: error.name,
                code: error.code,
            });

            code = 500;
            message = "Unable to process the task request";
        }

        return res.status(code).json({
            success: false,
            message,
        });
    }
};

const listTasks = handle((req) =>
    service.listTasks({
        user: req.user,
        query: req.query,
    })
);

const getTask = handle(async (req) => ({
    task: await service.getTask({
        user: req.user,
        id: req.params.id,
    }),
}));

const createTask = handle(
    async (req) => ({
        task: await service.createTask({
            user: req.user,
            body: req.body,
        }),
    }),
    201
);

const change = (action) =>
    handle(async (req) => ({
        task: await service.mutateTask({
            user: req.user,
            id: req.params.id,
            body: req.body,
            action,
        }),
    }));

module.exports = {
    listTasks, getTask, createTask,
    updateTask: change("update"),
    completeTask: change("complete"),
    cancelTask: change("cancel"),
};