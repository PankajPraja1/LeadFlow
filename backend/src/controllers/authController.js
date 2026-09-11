const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const sendEmail = require("../utils/sendEmail");
const {
  normalizeEmail, isValidEmail, isValidName, passwordError, isValidToken,
  hashToken, escapeHtml, buildClientLink, versionFilter, logAuthError,
} = require("../utils/authValidation");
const {
  createEmailVerificationService, clearVerification, clearPasswordReset,
  RESEND_COOLDOWN_MS,
} = require("../services/emailVerificationService");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const verification = createEmailVerificationService({ User, sendEmail });
const RANK_FIELDS = "name level description";

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  systemRole: user.systemRole,
  rank: user.rank,
  profilePicture: user.profilePicture || "",
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified === true,
  emailVerifiedAt: user.emailVerifiedAt || null,
  pendingEmail: user.pendingEmail || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const fail = (res, status, message, code) => res.status(status).json({
  success: false, message, ...(code ? { code } : {}),
});

const accountError = (res, error, fallback) => {
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map((item) => item.message);
    return res.status(400).json({ success: false, message: messages[0] || "Account validation failed", errors: messages });
  }
  if (error.code === 11000) {
    return fail(res, 409, "An account with this email or Google identity already exists", "ACCOUNT_ALREADY_EXISTS");
  }
  return fail(res, 500, fallback);
};

const verificationRequired = (res, email) => res.status(403).json({
  success: false,
  code: "EMAIL_VERIFICATION_REQUIRED",
  requiresEmailVerification: true,
  email,
  message: "Verify your email address before signing in. You can request another verification email.",
});

const sessionResponse = async (res, user, message) => {
  await user.populate("rank", RANK_FIELDS);
  return res.status(200).json({
    success: true,
    message,
    token: generateToken(user._id, user.tokenVersion ?? 0),
    user: formatUser(user),
  });
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!isValidName(name)) return fail(res, 400, "Name must contain between 2 and 50 characters");
    if (!isValidEmail(normalizedEmail)) return fail(res, 400, "Enter a valid email address");
    const invalidPassword = passwordError(password);
    if (invalidPassword) return fail(res, 400, invalidPassword);

    if (await User.findOne({ email: normalizedEmail })) {
      return fail(res, 409, "An account with this email already exists. Sign in, resend verification, or reset its password.", "ACCOUNT_ALREADY_EXISTS");
    }
    // Whitelist fields: the client cannot choose a role or verification state.
    const user = await User.create({
      name: name.trim(), email: normalizedEmail, password, isEmailVerified: false,
    });

    let delivery;
    try {
      delivery = await verification.requestVerification({ user });
    } catch (error) {
      logAuthError("Registration verification failed", error);
      delivery = { status: "delivery-failed" };
    }
    if (delivery.status !== "sent") {
      return res.status(503).json({
        success: false,
        code: "VERIFICATION_EMAIL_UNAVAILABLE",
        requiresEmailVerification: true,
        email: user.email,
        message: "Your account was created, but the verification email could not be sent. Request another verification email shortly.",
      });
    }

    // No JWT: registration is not a completed login anymore.
    return res.status(201).json({
      success: true,
      requiresEmailVerification: true,
      email: user.email,
      message: "Account created. Check your email to verify your address before signing in.",
    });
  } catch (error) {
    logAuthError("Registration failed", error);
    return accountError(res, error, "Unable to create account");
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail) || typeof password !== "string" || !password) {
      return fail(res, 400, "Email and password are required");
    }
    const user = await User.findOne({ email: normalizedEmail }).select("+password +tokenVersion");
    if (!user || !(await user.comparePassword(password))) {
      return fail(res, 401, "Invalid email or password");
    }
    if (!user.isActive) return fail(res, 403, "Your account has been deactivated", "ACCOUNT_DEACTIVATED");
    if (user.isEmailVerified !== true) return verificationRequired(res, normalizedEmail);
    return await sessionResponse(res, user, "Login successful");
  } catch (error) {
    logAuthError("Login failed", error);
    return fail(res, 500, "Unable to log in");
  }
};

const verifyEmail = async (req, res) => {
  try {
    const result = await verification.confirmVerification(req.body?.token);
    if (result.status === "email-unavailable") {
      return fail(res, 409, "That email address is no longer available. Request a change to another address.", "EMAIL_UNAVAILABLE");
    }
    if (result.status !== "verified") {
      return fail(res, 400, "Verification link is invalid, expired, or already used", "INVALID_VERIFICATION_LINK");
    }
    return res.status(200).json({
      success: true,
      requiresLogin: true,
      message: result.purpose === "change-email"
        ? "Your email was changed and verified. Sign in again using your new email or linked Google account."
        : "Email verified. You can now sign in.",
    });
  } catch (error) {
    logAuthError("Email verification failed", error);
    return fail(res, 500, "Unable to verify email");
  }
};

const resendVerification = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) return fail(res, 400, "Enter a valid email address");
  const generic = {
    success: true,
    message: "If this account needs verification, a verification email will be sent. Wait at least one minute before trying again.",
  };
  try {
    const user = await User.findOne({ email, isActive: true, isEmailVerified: { $ne: true } }).select("+tokenVersion");
    if (user) await verification.requestVerification({ user });
    return res.status(200).json(generic);
  } catch (error) {
    logAuthError("Resend verification failed", error);
    // The public response does not reveal account existence or SMTP outcome.
    return res.status(200).json(generic);
  }
};

const getCurrentUser = async (req, res) => res.status(200).json({
  success: true, user: formatUser(req.user),
});

const updateProfile = async (req, res) => {
  try {
    const { name, email, currentPassword } = req.body || {};
    if (name === undefined && email === undefined) return fail(res, 400, "Provide a name or email to update");
    if (name !== undefined && !isValidName(name)) return fail(res, 400, "Name must contain between 2 and 50 characters");
    const requestedEmail = email === undefined ? undefined : normalizeEmail(email);
    if (email !== undefined && !isValidEmail(requestedEmail)) return fail(res, 400, "Enter a valid email address");
    let user = await User.findById(req.user._id).select("+password +googleId +tokenVersion");
    if (!user || !user.isActive) return fail(res, 403, "Your account is unavailable");
    if ((user.tokenVersion ?? 0) !== (req.user.tokenVersion ?? 0)) return fail(res, 401, "Your session is no longer valid");
    const changingEmail = requestedEmail !== undefined && requestedEmail !== user.email;

    if (changingEmail) {
      if (!user.password) return fail(res, 400, "Use Forgot Password to set a password before changing your email", "PASSWORD_REQUIRED_FOR_EMAIL_CHANGE");
      if (typeof currentPassword !== "string" || !currentPassword) return fail(res, 400, "Current password is required to change your email");
      if (!(await user.comparePassword(currentPassword))) return fail(res, 400, "Current password is incorrect", "INVALID_CURRENT_PASSWORD");
      if (await User.findOne({ email: requestedEmail, _id: { $ne: user._id } })) {
        return fail(res, 409, "An account with this email already exists", "EMAIL_UNAVAILABLE");
      }
      const delivery = await verification.requestVerification({ user, targetEmail: requestedEmail, purpose: "change-email" });
      if (delivery.status === "not-sent") return fail(res, 429, "Wait at least one minute before requesting another email change", "VERIFICATION_COOLDOWN");
      if (delivery.status !== "sent") return fail(res, 503, "Unable to send the confirmation email. Please try again shortly.", "VERIFICATION_EMAIL_UNAVAILABLE");
    }

    // Name changes are applied after a requested verification email is sent.
    // The actual login email is changed only by verifyEmail, after confirmation.
    const filter = {
      $and: [
        { _id: user._id, isActive: true, isEmailVerified: true, email: user.email },
        versionFilter(user.tokenVersion ?? 0),
      ]
    };
    if (name !== undefined) {
      user = await User.findOneAndUpdate(filter, { $set: { name: name.trim() } }, {
        returnDocument: "after", runValidators: true,
      });
    } else {
      user = await User.findOne(filter);
    }
    if (!user) return fail(res, 409, "Your account changed during this request. Sign in again and retry.");
    await user.populate("rank", RANK_FIELDS);
    return res.status(200).json({
      success: true,
      message: changingEmail
        ? "Confirmation sent to your new email. Verify it to finish changing your login email."
        : "Profile updated successfully",
      emailChangePending: Boolean(user.pendingEmail),
      user: formatUser(user),
    });
  } catch (error) {
    logAuthError("Profile update failed", error);
    return accountError(res, error, "Unable to update profile");
  }
};

const cancelEmailChange = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate({
      $and: [
        { _id: req.user._id, isActive: true, isEmailVerified: true, emailVerificationPurpose: "change-email" },
        versionFilter(req.user.tokenVersion ?? 0),
      ]
    }, { $set: clearVerification() }, { returnDocument: "after" });
    if (!user) return fail(res, 409, "No pending email change is available to cancel");
    await user.populate("rank", RANK_FIELDS);
    return res.status(200).json({ success: true, message: "Pending email change cancelled", user: formatUser(user) });
  } catch (error) {
    logAuthError("Cancel email change failed", error);
    return fail(res, 500, "Unable to cancel email change");
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (typeof currentPassword !== "string" || !currentPassword) return fail(res, 400, "Current password is required");
    const invalidPassword = passwordError(newPassword);
    if (invalidPassword) return fail(res, 400, invalidPassword);
    if (newPassword !== confirmPassword) return fail(res, 400, "New passwords do not match");
    const user = await User.findById(req.user._id).select("+password +tokenVersion");
    if (!user || !user.isActive) return fail(res, 403, "Your account is unavailable");
    if ((user.tokenVersion ?? 0) !== (req.user.tokenVersion ?? 0)) return fail(res, 401, "Your session is no longer valid");
    if (!(await user.comparePassword(currentPassword))) return fail(res, 400, "Current password is incorrect", "INVALID_CURRENT_PASSWORD");
    if (await user.comparePassword(newPassword)) return fail(res, 400, "New password must be different from the current password");

    // Query updates do not run the model's pre-save password hook.
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const updated = await User.findOneAndUpdate({
      $and: [
        { _id: user._id, isActive: true, isEmailVerified: true, password: user.password },
        versionFilter(user.tokenVersion ?? 0),
      ]
    }, {
      $set: { password: hashedPassword, ...clearPasswordReset(), ...clearVerification() },
      $inc: { tokenVersion: 1 },
    }, { returnDocument: "after", runValidators: true }).select("+tokenVersion");
    if (!updated) return fail(res, 409, "Your account changed during this request. Sign in again and retry.");
    return await sessionResponse(res, updated, "Password changed successfully");
  } catch (error) {
    logAuthError("Password change failed", error);
    return accountError(res, error, "Unable to change password");
  }
};

const googleLogin = async (req, res) => {
  const credential = req.body?.credential;
  if (typeof credential !== "string" || !credential) return fail(res, 400, "Google credential is required");
  if (!process.env.GOOGLE_CLIENT_ID) return fail(res, 503, "Google authentication is unavailable");
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (error) {
    logAuthError("Google credential verification failed", error);
    return fail(res, 401, "Google authentication failed");
  }
  const email = normalizeEmail(payload?.email);
  if (typeof payload?.sub !== "string" || !payload.sub || !isValidEmail(email) || payload.email_verified !== true) {
    return fail(res, 401, "Unable to verify Google account");
  }
  // Google may not be authoritative for a third-party email, even when the
  // signed email_verified claim is true. Those users verify through LeadFlow.
  const authoritativeEmail = email.endsWith("@gmail.com") ||
    (typeof payload.hd === "string" && payload.hd.length > 0);

  try {
    const googleId = payload.sub;
    let user = await User.findOne({ googleId }).select("+googleId +tokenVersion");
    if (!user) {
      const existing = await User.findOne({ email }).select("+googleId +tokenVersion");
      if (existing) {
        if (!existing.isActive) return fail(res, 403, "Your account has been deactivated", "ACCOUNT_DEACTIVATED");
        // Do not turn an unverified, pre-existing password into a verified login
        // just because somebody subsequently signs in with Google.
        if (existing.googleId || existing.isEmailVerified !== true || !authoritativeEmail) {
          return fail(res, 409, "An account already uses this email. Sign in with its existing method, or use Forgot Password, before continuing with Google.", "ACCOUNT_LINK_REQUIRED");
        }
        user = await User.findOneAndUpdate({
          $and: [
            { _id: existing._id, email, isActive: true, isEmailVerified: true },
            { $or: [{ googleId: { $exists: false } }, { googleId: null }] },
            versionFilter(existing.tokenVersion ?? 0),
          ]
        }, { $set: { googleId } }, { returnDocument: "after" }).select("+googleId +tokenVersion");
        if (!user) return fail(res, 409, "Your account changed. Please try signing in again.");
      } else {
        const displayName = typeof payload.name === "string" ? payload.name.trim().slice(0, 50) : "";
        user = await User.create({
          name: displayName.length >= 2 ? displayName : "LeadFlow member",
          email,
          googleId,
          profilePicture: typeof payload.picture === "string" ? payload.picture : "",
          isEmailVerified: authoritativeEmail,
          emailVerifiedAt: authoritativeEmail ? new Date() : null,
        });
      }
    }
    if (!user.isActive) return fail(res, 403, "Your account has been deactivated", "ACCOUNT_DEACTIVATED");

    if (user.isEmailVerified !== true && authoritativeEmail && user.email === email) {
      user = await User.findOneAndUpdate({
        $and: [
          { _id: user._id, googleId, email, isActive: true, isEmailVerified: { $ne: true } },
          versionFilter(user.tokenVersion ?? 0),
        ]
      }, {
        $set: { isEmailVerified: true, emailVerifiedAt: new Date(), ...clearVerification(), ...clearPasswordReset() },
        $inc: { tokenVersion: 1 },
      }, { returnDocument: "after" }).select("+googleId +tokenVersion");
      if (!user) return fail(res, 409, "Your account changed. Please try signing in again.");
    }
    if (user.isEmailVerified !== true) {
      try { await verification.requestVerification({ user }); }
      catch (error) { logAuthError("Google account email delivery failed", error); }
      return verificationRequired(res, user.email);
    }
    if (typeof payload.picture === "string" && payload.picture !== user.profilePicture) {
      const updated = await User.findOneAndUpdate({
        $and: [
          { _id: user._id, googleId, isActive: true, isEmailVerified: true },
          versionFilter(user.tokenVersion ?? 0),
        ]
      }, { $set: { profilePicture: payload.picture } }, { returnDocument: "after" }).select("+tokenVersion");
      if (!updated) return fail(res, 409, "Your account changed. Please try signing in again.");
      user = updated;
    }
    return await sessionResponse(res, user, "Google authentication successful");
  } catch (error) {
    logAuthError("Google login failed", error);
    return accountError(res, error, "Unable to complete Google sign-in");
  }
};

const forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) return fail(res, 400, "Enter a valid email address");
  const generic = { success: true, message: "If an account exists for this email, a reset link has been sent" };
  try {
    const user = await User.findOne({ email, isActive: true }).select("+tokenVersion");
    if (!user) return res.status(200).json(generic);
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetHash = hashToken(resetToken);
    const issuedAt = new Date();
    // Preserve the existing frontend reset-password/:token route.
    const resetUrl = buildClientLink(`/reset-password/${resetToken}`);
    const previous = await User.findOneAndUpdate({
      $and: [
        { _id: user._id, email, isActive: true },
        versionFilter(user.tokenVersion ?? 0),
        {
          $or: [
            { passwordResetSentAt: null },
            { passwordResetSentAt: { $lte: new Date(issuedAt.getTime() - RESEND_COOLDOWN_MS) } },
          ]
        },
      ]
    }, {
      $set: {
        passwordResetToken: resetHash,
        passwordResetExpires: new Date(issuedAt.getTime() + 15 * 60 * 1000),
        passwordResetEmail: email,
        passwordResetSentAt: issuedAt,
      }
    }, { returnDocument: "before" }).select("+passwordResetToken +passwordResetExpires +passwordResetEmail");
    if (!previous) return res.status(200).json(generic);
    try {
      await sendEmail({
        to: email,
        subject: "Reset your LeadFlow password",
        text: `Reset your LeadFlow password: ${resetUrl}\nThis link expires in 15 minutes. If you did not request it, ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Reset your LeadFlow password</h2><p>Hello ${escapeHtml(user.name)},</p>
          <p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>
          <p>This link expires in 15 minutes. If you did not request it, ignore this email.</p>
        </div>`,
      });
    } catch (error) {
      await User.updateOne({ _id: user._id, passwordResetToken: resetHash }, {
        $set: {
          passwordResetToken: previous.passwordResetToken ?? null,
          passwordResetExpires: previous.passwordResetExpires ?? null,
          passwordResetEmail: previous.passwordResetEmail ?? null,
        }
      });
      logAuthError("Password reset email failed", error);
    }
    return res.status(200).json(generic);
  } catch (error) {
    logAuthError("Password reset request failed", error);
    return res.status(200).json(generic);
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body || {};
    const invalidPassword = passwordError(password);
    if (invalidPassword) return fail(res, 400, invalidPassword);
    if (password !== confirmPassword) return fail(res, 400, "Passwords do not match");
    if (!isValidToken(req.params?.token)) return fail(res, 400, "Reset link is invalid or has expired");
    const resetHash = hashToken(req.params.token);
    const candidate = await User.findOne({
      passwordResetToken: resetHash, passwordResetExpires: { $gt: new Date() }, isActive: true,
    }).select("+passwordResetEmail +tokenVersion");
    if (!candidate || candidate.passwordResetEmail !== candidate.email) {
      return fail(res, 400, "Reset link is invalid or has expired. Request a new link.");
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const updated = await User.findOneAndUpdate({
      $and: [
        {
          _id: candidate._id, email: candidate.email, passwordResetEmail: candidate.email,
          passwordResetToken: resetHash, passwordResetExpires: { $gt: new Date() }, isActive: true
        },
        versionFilter(candidate.tokenVersion ?? 0),
      ]
    }, {
      $set: {
        password: hashedPassword,
        // This reset token was sent to and bound to the current email address.
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        ...clearPasswordReset(),
        ...clearVerification(),
      },
      $inc: { tokenVersion: 1 },
    }, { returnDocument: "after", runValidators: true });
    if (!updated) return fail(res, 400, "Reset link is invalid or has expired");
    return res.status(200).json({ success: true, requiresLogin: true, message: "Password reset and email confirmed. You can now log in." });
  } catch (error) {
    logAuthError("Password reset failed", error);
    return accountError(res, error, "Unable to reset password");
  }
};

module.exports = {
  register, login, googleLogin, getCurrentUser, updateProfile, changePassword,
  forgotPassword, resetPassword, verifyEmail, resendVerification, cancelEmailChange,
};
