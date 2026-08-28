const express = require("express");

const {
  register,
  login,
  getCurrentUser,
} = require("../controllers/authController");

// Add protected route for getting current user
const {
  protect,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// order matters here, protect middleware should be applied before getCurrentUser
router.get("/me", protect, getCurrentUser); 

module.exports = router;