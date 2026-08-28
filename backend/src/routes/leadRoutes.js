const express = require("express");

const {
  createLead,
  getLeads,
  updateLead,
  deleteLead,
} = require("../controllers/leadController");

const {
  protect,
} = require("../middleware/authMiddleware");

const router = express.Router();

router
  .route("/")
  .post(protect, createLead)
  .get(protect, getLeads);

router
  .route("/:id")
  .patch(protect, updateLead)
  .delete(protect, deleteLead);

module.exports = router;