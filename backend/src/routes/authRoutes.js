const express = require("express");

const {
  register,
  login,
  getCurrentUser,
  updateProfile,
  changePassword,
} = require("../controllers/authController");

// Add protected route for getting current user
const { protect, } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// order matters here, protect middleware should be applied before getCurrentUser
// Add protected route for getting current user
router.get("/me",
  protect,
  getCurrentUser);

// Add protected route for updating user profile
router.patch("/profile",
  protect,
  updateProfile);

// Add protected route for changing password
router.patch("/password",
  protect,
  changePassword);

module.exports = router;