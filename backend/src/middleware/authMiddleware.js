const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { logAuthError } = require("../utils/authValidation");
require("../models/Rank");

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (typeof header !== "string" || !/^Bearer\s+\S+$/.test(header)) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const decoded = jwt.verify(header.replace(/^Bearer\s+/, ""), process.env.JWT_SECRET);
    if (!decoded || typeof decoded !== "object" || !decoded.userId) {
      return res.status(401).json({ success: false, message: "Invalid authentication token" });
    }
    const user = await User.findById(decoded.userId)
      .populate("rank", "name level description").select("+tokenVersion -password");
    if (!user || (decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ success: false, message: "Your session is no longer valid. Please log in again." });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, code: "ACCOUNT_DEACTIVATED", message: "Your account has been deactivated" });
    }
    if (user.isEmailVerified !== true) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_VERIFICATION_REQUIRED",
        requiresEmailVerification: true,
        message: "Verify your email address before continuing",
      });
    }
    req.user = user;
    next();
  } catch (error) {
    if (["TokenExpiredError", "JsonWebTokenError", "NotBeforeError", "CastError"].includes(error.name)) {
      return res.status(401).json({ success: false, message: "Invalid or expired authentication token" });
    }
    logAuthError("Authentication failed", error);
    return res.status(500).json({ success: false, message: "Unable to authenticate request" });
  }
};

module.exports = { protect };
