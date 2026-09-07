const express = require("express");

const {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan, } = require("../controllers/planController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.route("/")
    .post(createPlan)
    .get(getPlans);

router.route("/:id")
    .get(getPlanById)
    .patch(updatePlan)
    .delete(deletePlan);

module.exports = router;