const express = require("express");
const {
  register, login, googleLogin, getCurrentUser, updateProfile, changePassword,
  forgotPassword, resetPassword, verifyEmail, resendVerification, cancelEmailChange,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const {
  authRequestLimiter,
  signInLimiter,
  emailRequestLimiter,
  accountActionLimiter,
} = require("../middleware/authRateLimit");

const router = express.Router();

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");

  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    return authRequestLimiter(req, res, next);
  }

  return next();
});

router.post("/register", emailRequestLimiter, register);

router.post("/login", signInLimiter, login);

router.post("/google", signInLimiter, googleLogin);

// Verification is public and explicitly consumes a token with POST.
// Do not add a GET handler that consumes email links automatically.
router.post("/verify-email", verifyEmail);

router.post("/resend-verification", emailRequestLimiter, resendVerification);

router.post("/forgot-password", emailRequestLimiter, forgotPassword);

router.patch("/reset-password/:token", resetPassword);

router.get("/me", protect, getCurrentUser);

router.patch("/profile", protect, accountActionLimiter, updateProfile);

router.patch("/password", protect, accountActionLimiter, changePassword);

router.delete("/pending-email", protect, accountActionLimiter, cancelEmailChange);

module.exports = router;
