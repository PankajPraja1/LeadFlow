const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
    listTasks,
    getTask,
    createTask,
    updateTask,
    completeTask,
    cancelTask, } = require("../controllers/taskController");

const router = express.Router();

router.use(protect);

router.route("/")
    .get(listTasks)
    .post(createTask);

router.route("/:id")
    .get(getTask)
    .patch(updateTask);

router.post("/:id/complete", completeTask);
router.post("/:id/cancel", cancelTask);

module.exports = router;