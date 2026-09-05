const User = require("../models/User");
const generateToken = require("../utils/generateToken");

// Format user data for response
const formatUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    systemRole: user.systemRole,
    rank: user.rank,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// Send validation error response
const sendValidationError = (error, res) => {
  const messages = Object.values(error.errors).map((validationError) => validationError.message);

  return res.status(400).json({
    success: false,
    message: messages[0] || "Account validation failed",
    errors: messages,
  });
};

// Registration, login, profile update, and password change functions
const register = async (req, res) => {
  try {
    const { name, email, password, } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
    });

    const token = generateToken(user._id, user.tokenVersion ?? 0);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.name === "ValidationError") {
      return sendValidationError(error, res);
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create account",
    });
  }
};

// Login User 
const login = async (req, res) => {
  try {
    const { email, password, } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail, }).select("+password +tokenVersion").populate("rank", "name level description");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    const token = generateToken(user._id, user.tokenVersion ?? 0);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in",
    });
  }
};

// Get current user information
const getCurrentUser = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: formatUser(req.user),
  });
};

// Update profile and change password functions
const updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      currentPassword,
    } = req.body;

    if (name === undefined && email === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide a name or email to update",
      });
    }

    const user = await User.findById(req.user._id).select("+password +tokenVersion");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (name !== undefined) {
      const normalizedName = name.trim();

      if (!normalizedName) {
        return res.status(400).json({
          success: false,
          message: "Name is required",
        });
      }

      user.name = normalizedName;
    }

    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();

      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const emailChanged = normalizedEmail !== user.email;

      if (emailChanged) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            message: "Current password is required to change your email",
          });
        }

        const passwordMatches = await user.comparePassword(currentPassword);

        if (!passwordMatches) {
          return res.status(401).json({
            success: false,
            message: "Current password is incorrect",
          });
        }

        const emailOwner = await User.findOne({
          email: normalizedEmail,
          _id: {
            $ne: user._id,
          },
        });

        if (emailOwner) {
          return res.status(409).json({
            success: false,
            message: "An account with this email already exists",
          });
        }

        user.email = normalizedEmail;
      }
    }

    await user.save();

    await user.populate("rank", "name level description");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Update profile error:", error);

    if (error.name === "ValidationError") {
      return sendValidationError(error, res);
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update profile",
    });
  }
};

// Change password function
const changePassword = async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password, new password, and confirmation are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must contain at least 6 characters",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    const user = await User.findById(req.user._id).select("+password +tokenVersion");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const passwordMatches = await user.comparePassword(currentPassword);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const passwordIsUnchanged = await user.comparePassword(newPassword);

    if (passwordIsUnchanged) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password",
      });
    }

    user.password = newPassword;

    user.tokenVersion = (user.tokenVersion ?? 0) + 1;

    await user.save();

    await user.populate("rank", "name level description");

    const token = generateToken(user._id, user.tokenVersion);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Change password error:", error);

    if (error.name === "ValidationError") {
      return sendValidationError(error, res);
    }

    return res.status(500).json({
      success: false,
      message: "Unable to change password",
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfile,
  changePassword,
};

