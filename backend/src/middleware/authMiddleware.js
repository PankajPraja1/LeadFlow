const jwt = require("jsonwebtoken");
const User = require("../models/User");
require("../models/Rank");

// Middleware to protect routes and ensure the user is authenticated
const protect = async (req, res, next) => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authorizationHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing",
      });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User
      .findById(decodedToken.userId)
      .populate("rank", "name level description")
      .select("+tokenVersion -password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "The user associated with this token no longer exists",
      });
    }

    const tokenVersion = decodedToken.tokenVersion ?? 0;

    const currentTokenVersion = user.tokenVersion ?? 0;

    if (tokenVersion !== currentTokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Your session is no longer valid. Please log in again.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    console.error("Authentication error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to authenticate request",
    });
  }
};

module.exports = {
  protect,
};