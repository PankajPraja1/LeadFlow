const mongoose = require("mongoose");

const digestDeliverySchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  // One attempt per account per UTC date, regardless of time-zone/email edits.
  runDay: { type: String, required: true, immutable: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: {
    type: String, required: true,
    enum: ["claimed", "sending", "sent", "uncertain", "skipped"],
  },

  claimToken: { type: String, required: true, select: false },
  leaseUntil: { type: Date, default: null },
  localDate: { type: String, default: null },
  timeZone: { type: String, default: null, maxlength: 100 },
  attemptedAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null },
  reason: {
    type: String, default: null,
    enum: [null, "NOT_ELIGIBLE", "NO_TASKS", "SETTINGS_CHANGED", "PREPARATION_FAILED", "SMTP_UNCONFIRMED"],
  },

}, { timestamps: true });

digestDeliverySchema.index({ recipient: 1, runDay: 1 }, { unique: true });
digestDeliverySchema.index({ runDay: 1, status: 1, leaseUntil: 1 });

// Keep delivery state separate from notification read/unread state.
// No SMTP payload, email address, password, or task content is persisted here.
module.exports = mongoose.models.DigestDelivery || mongoose.model("DigestDelivery", digestDeliverySchema);
