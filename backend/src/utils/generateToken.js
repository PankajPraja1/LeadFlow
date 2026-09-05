const jwt = require("jsonwebtoken");

// Generate a JWT token for a user
const generateToken = (userId, tokenVersion = 0) => {
  return jwt.sign(
    {
      userId,
      tokenVersion,
    }, process.env.JWT_SECRET, { expiresIn: "1d", }
  );
};

module.exports = generateToken;
