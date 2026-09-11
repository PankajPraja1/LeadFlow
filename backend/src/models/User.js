const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Define the User schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    minlength: [2, "Name must contain at least 2 characters"],
    maxlength: [50, "Name cannot exceed 50 characters"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address"],
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    select: false,
  },
  profilePicture: { type: String, trim: true, default: "" },
  password: {
    type: String,
    required: [function () { return !this.googleId; }, "Password is required"],
    minlength: [6, "Password must contain at least 6 characters"],
    select: false,
  },
  systemRole: {
    type: String,
    enum: ["admin", "leader", "member", "viewer"],
    default: "member",
  },
  rank: { type: mongoose.Schema.Types.ObjectId, ref: "Rank", default: null },
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0, min: 0, select: false },

  // Verification is separate from an administrator deactivating the account.
  // Missing fields on old records are treated as unverified by the controllers.
  isEmailVerified: { type: Boolean, default: false },
  emailVerifiedAt: { type: Date, default: null },
  pendingEmail: { type: String, lowercase: true, trim: true, default: null },
  emailVerificationToken: { type: String, select: false, default: null },
  emailVerificationExpires: { type: Date, select: false, default: null },
  emailVerificationTarget: { type: String, select: false, default: null },
  emailVerificationPurpose: {
    type: String,
    enum: ["verify-current", "change-email", null],
    select: false,
    default: null,
  },
  emailVerificationSentAt: { type: Date, select: false, default: null },

  passwordResetToken: { type: String, select: false, default: null },
  passwordResetExpires: { type: Date, select: false, default: null },
  passwordResetEmail: { type: String, select: false, default: null },
  passwordResetSentAt: { type: Date, select: false, default: null },
}, { timestamps: true });

// These are lookup indexes, never TTL indexes on the users collection.
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Password-hashing middleware
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Password-comparison method for login
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password || typeof enteredPassword !== "string") return false;
  return bcrypt.compare(enteredPassword, this.password);
};

// Customize the JSON output to exclude sensitive information
userSchema.set("toJSON", {
  transform: function (document, returnedObject) {
    for (const field of [
      "password",
      "googleId",
      "tokenVersion",
      "emailVerificationToken",
      "emailVerificationExpires",
      "emailVerificationTarget",
      "emailVerificationPurpose",
      "emailVerificationSentAt",
      "passwordResetToken",
      "passwordResetExpires",
      "passwordResetEmail",
      "passwordResetSentAt",
    ]) {
      delete returnedObject[field];
    }
    return returnedObject;
  },
});

module.exports = mongoose.model("User", userSchema);
