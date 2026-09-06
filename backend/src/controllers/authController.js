const { OAuth2Client, } = require("google-auth-library"); // Import the Google OAuth2 client
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

// Initialize the Google OAuth2 client with the client ID from environment variables
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Format user data for response
const formatUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    systemRole: user.systemRole,
    rank: user.rank,
    profilePicture: user.profilePicture || "",
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

// Google login function controller
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error("GOOGLE_CLIENT_ID is missing");

      return res.status(500).json({
        success: false,
        message: "Google authentication is unavailable",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email || payload.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: "Unable to verify Google account",
      });
    }

    const {
      sub: googleId,
      name,
      email,
      picture,
    } = payload;

    const normalizedEmail = email.toLowerCase().trim();

    let user = await User.findOne({
      googleId,
    }).select("+googleId +tokenVersion");

    if (!user) {
      user = await User.findOne({
        email: normalizedEmail,
      }).select("+googleId +tokenVersion");
    }

    if (user && !user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    if (!user) {
      user = await User.create({
        name: name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        googleId,
        profilePicture: picture || "",
      });
    } else {
      let shouldSave = false;

      if (!user.googleId) {
        user.googleId = googleId;
        shouldSave = true;
      }

      if (picture && user.profilePicture !== picture) {
        user.profilePicture = picture;
        shouldSave = true;
      }

      if (shouldSave) {
        await user.save();
      }
    }

    await user.populate("rank", "name level description");

    const token = generateToken(user._id, user.tokenVersion ?? 0);

    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      token,
      user: formatUser(user),
    });
  } catch (error) {
    console.error("Google authentication error:", error);

    return res.status(401).json({
      success: false,
      message: "Google authentication failed",
    });
  }
};

// Forgot password function controller
const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required",
      });
    }

    const genericResponse = {
      success: true,
      message: "If an account exists for this email, a reset link has been sent",
    };

    const user = await User.findOne({ email });

    if (!user || !user.isActive) {
      return res.status(200).json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000;

    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Reset your LeadFlow password",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Reset your LeadFlow password</h2>

            <p>Hello ${user.name},</p>

            <p>
              We received a request to reset your LeadFlow password.
            </p>

            <p>
              <a href="${resetUrl}">
                Reset password
              </a>
            </p>

            <p>
              This link expires in 15 minutes. If you did not request this, you can safely ignore this email.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();

      console.error( "Password reset email error:", emailError.message);

      return res.status(500).json({
        success: false,
        message: "Unable to send password reset email",
      });
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process password reset request",
    });
  }
};

// Reset password function controller
const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and password confirmation are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: {
        $gt: Date.now(),
      },
    }).select("+passwordResetToken +passwordResetExpires +tokenVersion");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or has expired",
      });
    }

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reset password",
    });
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  getCurrentUser,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};

