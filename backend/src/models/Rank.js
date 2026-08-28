const mongoose = require("mongoose");

const rankSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Rank name is required"],
      trim: true,
      minlength: [2, "Rank name must contain at least 2 characters"],
      maxlength: [50, "Rank name cannot exceed 50 characters"],
    },

    level: {
      type: Number,
      required: [true, "Rank level is required"],
      min: [1, "Rank level must be at least 1"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [
        300,
        "Rank description cannot exceed 300 characters",
      ],
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

rankSchema.index({ name: 1 }, { unique: true });
rankSchema.index({ level: 1 }, { unique: true });

// Export the model
const Rank = mongoose.model("Rank", rankSchema);

module.exports = Rank;