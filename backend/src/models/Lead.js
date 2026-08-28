const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Lead name is required"],
      trim: true,
      maxlength: [60, "Name cannot exceed 60 characters"],
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      required: [true, "Phone number is required"],
    },

    source: {
      type: String,
      trim: true,
      default: "Other",
    },

    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "qualified",
        "converted",
        "lost",
      ],
      default: "new",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
      default: "",
    },

    nextFollowUp: {
      type: Date,
      default: null,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ name: 1 });
leadSchema.index({ phone: 1 });

const Lead = mongoose.model("Lead", leadSchema);

module.exports = Lead;