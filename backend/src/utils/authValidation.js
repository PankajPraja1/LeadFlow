const crypto = require("crypto");

const normalizeEmail = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";

// Keep the application's existing email comparison/format policy consistent.
const isValidEmail = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidName = (value) =>
  typeof value === "string" &&
  value.trim().length >= 2 &&
  value.trim().length <= 50;

const passwordError = (value) => {
  if (typeof value !== "string" || value.length < 6) {
    return "Password must contain at least 6 characters";
  }
  // bcrypt ignores input beyond 72 bytes. Reject it when setting a password.
  if (Buffer.byteLength(value, "utf8") > 72) {
    return "Password must not exceed 72 bytes";
  }
  return null;
};

const isValidToken = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const buildClientLink = (path, token) => {
  const base = new URL(process.env.CLIENT_URL || "");
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];
  if (
    base.username || base.password ||
    (base.protocol !== "https:" &&
      !(base.protocol === "http:" && localHosts.includes(base.hostname)))
  ) {
    throw new Error("CLIENT_URL must use HTTPS, except for local development");
  }
  const url = new URL(path, base.origin);
  // The verification page reads the fragment and submits the token explicitly.
  // Fragments are not included in the HTTP request for the page itself.
  if (token) url.hash = `token=${token}`;
  return url.toString();
};

// Existing records may not have a stored tokenVersion yet.
const versionFilter = (version) => version === 0
  ? { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }
  : { tokenVersion: version };

const logAuthError = (context, error) => {
  // Avoid logging request bodies, tokens, email links, or SMTP credentials.
  console.error(context, {
    name: error?.name || "Error",
    code: error?.code || "UNKNOWN",
  });
};

module.exports = {
  normalizeEmail,
  isValidEmail,
  isValidName,
  passwordError,
  isValidToken,
  hashToken,
  escapeHtml,
  buildClientLink,
  versionFilter,
  logAuthError,
};
