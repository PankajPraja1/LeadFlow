const crypto = require("crypto");
const {
  hashToken, isValidToken, isValidEmail, escapeHtml,
  buildClientLink, versionFilter, logAuthError,
} = require("../utils/authValidation");

const VERIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const VERIFICATION_FIELDS = [
  "emailVerificationToken", "emailVerificationExpires", "emailVerificationTarget",
  "emailVerificationPurpose", "pendingEmail",
];
const clearVerification = () => Object.fromEntries(VERIFICATION_FIELDS.map((field) => [field, null]));
const clearPasswordReset = () => ({
  passwordResetToken: null,
  passwordResetExpires: null,
  passwordResetEmail: null,
});

// Dependencies are passed in so challenge behavior can be tested without email.
const createEmailVerificationService = ({ User, sendEmail, now = () => new Date() }) => {
  const requestVerification = async ({ user, targetEmail = user.email, purpose = "verify-current" }) => {
    if (!isValidEmail(targetEmail) || !["verify-current", "change-email"].includes(purpose) ||
      (purpose === "verify-current" && targetEmail !== user.email) ||
      (purpose === "change-email" && targetEmail === user.email)) {
      throw new Error("Invalid verification request");
    }
    const issuedAt = now();
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const verificationUrl = buildClientLink("/verify-email", token);
    const filter = {
      $and: [
        { _id: user._id, email: user.email, isActive: true },
        versionFilter(user.tokenVersion ?? 0),
        purpose === "verify-current"
          ? { isEmailVerified: { $ne: true } }
          : { isEmailVerified: true },
        {
          $or: [
            { emailVerificationSentAt: null },
            { emailVerificationSentAt: { $lte: new Date(issuedAt.getTime() - RESEND_COOLDOWN_MS) } },
          ]
        },
      ],
    };

    // Read the old challenge and claim the cooldown in one atomic operation.
    const previous = await User.findOneAndUpdate(filter, {
      $set: {
        emailVerificationToken: tokenHash,
        emailVerificationExpires: new Date(issuedAt.getTime() + VERIFICATION_LIFETIME_MS),
        emailVerificationTarget: targetEmail,
        emailVerificationPurpose: purpose,
        emailVerificationSentAt: issuedAt,
        pendingEmail: purpose === "change-email" ? targetEmail : null,
      },
    }, { returnDocument: "before", runValidators: true }).select(
      "+emailVerificationToken +emailVerificationExpires +emailVerificationTarget +emailVerificationPurpose"
    );

    if (!previous) return { status: "not-sent" };

    try {
      await sendEmail({
        to: targetEmail,
        subject: purpose === "change-email" ? "Confirm your new LeadFlow email" : "Verify your LeadFlow email",
        text: `Confirm this email address for LeadFlow: ${verificationUrl}\nThis link expires in 24 hours. If you did not request this, ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>${purpose === "change-email" ? "Confirm your new email" : "Verify your email"}</h2>
          <p>Hello ${escapeHtml(user.name)},</p>
          <p>Confirm this email address for your LeadFlow account.</p>
          <p><a href="${escapeHtml(verificationUrl)}">Verify email address</a></p>
          <p>This link expires in 24 hours. If you did not request this, ignore this email.</p>
        </div>`,
      });
      return { status: "sent" };
    } catch (error) {
      // Restore the previous challenge only if this failed send still owns it.
      // Keep the cooldown timestamp so SMTP failures cannot trigger tight retries.
      const restore = Object.fromEntries(VERIFICATION_FIELDS.map((field) => [field, previous[field] ?? null]));
      await User.updateOne({ _id: user._id, emailVerificationToken: tokenHash }, { $set: restore });
      logAuthError("Verification email delivery failed", error);
      return { status: "delivery-failed" };
    }
  };

  const confirmVerification = async (token) => {
    if (!isValidToken(token)) return { status: "invalid" };
    const tokenHash = hashToken(token);
    const lookup = {
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: now() },
      isActive: true,
    };
    const candidate = await User.findOne(lookup).select(
      "+emailVerificationToken +emailVerificationExpires +emailVerificationTarget +emailVerificationPurpose +tokenVersion"
    );
    if (!candidate) return { status: "invalid" };

    const purpose = candidate.emailVerificationPurpose;
    const targetEmail = candidate.emailVerificationTarget;
    const changingEmail = purpose === "change-email";
    if (!isValidEmail(targetEmail) ||
      (!changingEmail && (purpose !== "verify-current" || targetEmail !== candidate.email)) ||
      (changingEmail && (candidate.isEmailVerified !== true || candidate.pendingEmail !== targetEmail))) {
      return { status: "invalid" };
    }

    try {
      // Matching and clearing the token happen together: only one request wins.
      const updated = await User.findOneAndUpdate({
        $and: [
          {
            ...lookup, emailVerificationExpires: { $gt: now() }, _id: candidate._id,
            email: candidate.email, emailVerificationPurpose: purpose,
            emailVerificationTarget: targetEmail
          },
          versionFilter(candidate.tokenVersion ?? 0),
          changingEmail ? { pendingEmail: targetEmail, isEmailVerified: true } : { isEmailVerified: { $ne: true } },
        ],
      }, {
        $set: {
          isEmailVerified: true,
          emailVerifiedAt: now(),
          ...(changingEmail ? { email: targetEmail } : {}),
          ...clearVerification(),
          ...clearPasswordReset(),
        },
        $inc: { tokenVersion: 1 },
      }, { returnDocument: "after", runValidators: true });
      if (!updated) return { status: "invalid" };

      if (changingEmail) {
        try {
          await sendEmail({
            to: candidate.email,
            subject: "Your LeadFlow email was changed",
            text: "Your LeadFlow sign-in email was changed. If this was unexpected, contact LeadFlow Support.",
            html: "<p>Your LeadFlow sign-in email was changed.</p><p>If this was unexpected, contact LeadFlow Support.</p>",
          });
        } catch (error) {
          // The email change has committed. A notice failure must not undo it.
          logAuthError("Email-change notice failed", error);
        }
      }
      return { status: "verified", purpose };
    } catch (error) {
      if (error.code === 11000) return { status: "email-unavailable" };
      throw error;
    }
  };

  return { requestVerification, confirmVerification };
};

module.exports = {
  createEmailVerificationService,
  clearVerification,
  clearPasswordReset,
  RESEND_COOLDOWN_MS,
};
