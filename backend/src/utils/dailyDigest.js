const { timingSafeEqual } = require("node:crypto");

const DAY_MS = 86400000;
const ROLES = ["admin", "leader", "member", "viewer"];
const digestError = (message, code = "DIGEST_CONFIGURATION", statusCode = 503) =>
  Object.assign(new Error(message), { code, statusCode });

const validDate = (value) => value instanceof Date && Number.isFinite(value.getTime());
const validEmail = (value) => typeof value === "string" && value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);

function clientOrigin(value) {
  let url;

  try { url = new URL(value); } catch { throw digestError("CLIENT_URL is invalid"); }

  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw digestError("CLIENT_URL must be the frontend origin");
  }

  return url.origin;
}

function checkCronAuthorization(header, secret) {
  if (typeof secret !== "string" || secret.length < 32 || secret.length > 256 || /\s/.test(secret)) {
    throw digestError("CRON_SECRET must contain 32 to 256 non-whitespace characters");
  }

  if (typeof header !== "string" || header.length > 512) return false;

  const received = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);

  return received.length === expected.length && timingSafeEqual(received, expected);
}

function localDayWindow(now, timeZone) {
  if (!validDate(now) || now.getUTCFullYear() < 2000 || now.getUTCFullYear() > 2100) {
    throw digestError("Invalid digest date", "DIGEST_DATE", 400);
  }

  if (typeof timeZone !== "string" || !timeZone || timeZone.length > 100 || /^[+-]/.test(timeZone)) {
    throw digestError("Invalid time zone", "DIGEST_TIME_ZONE", 400);
  }

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone, calendar: "iso8601", numberingSystem: "latn",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
  } catch { throw digestError("Invalid time zone", "DIGEST_TIME_ZONE", 400); }

  const keyAt = (milliseconds) => {
    const values = Object.fromEntries(formatter.formatToParts(new Date(milliseconds)).map(({ type, value }) => [type, value]));

    return `${values.year}-${values.month}-${values.day}`;
  };

  const instant = now.getTime();
  const localDate = keyAt(instant);
  // Search for real local-day boundaries. Do not assume every day is 24 hours:
  // daylight-saving changes and midnight offset changes can shorten/extend it.
  const firstTrue = (low, high, predicate) => {
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      if (predicate(middle)) high = middle;
      else low = middle;
    }
    return high;
  };

  const start = firstTrue(instant - 2 * DAY_MS, instant,
    (time) => keyAt(time) >= localDate);

  const end = firstTrue(instant, instant + 2 * DAY_MS,
    (time) => keyAt(time) > localDate);

  return { localDate, timeZone, start: new Date(start), end: new Date(end) };
}

function eligibleRecipient(context) {
  const { user, preferences } = context ?? {};

  return Boolean(user?._id && user.isActive === true && user.isEmailVerified === true &&
    ROLES.includes(user.systemRole) && validEmail(user.email) &&
    preferences?.dailyEmailEnabled === true);
}

// A pending email change never changes the recipient: use only the current
// verified account email. Any change during preparation causes a safe skip.
function recipientFingerprint(context) {
  const { user, preferences } = context ?? {};

  return JSON.stringify([
    String(user?._id ?? ""), user?.email, user?.name, user?.systemRole,
    user?.isActive, user?.isEmailVerified,
    preferences?.dailyEmailEnabled, preferences?.timeZone, preferences?.__v ?? 0,
  ]);
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

const displayText = (value, maximum) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, " ")
  .trim().slice(0, maximum);

function buildDigestEmail({ user, summary, window, origin }) {
  const base = clientOrigin(origin);
  const tasksUrl = `${base}/follow-ups`;
  const settingsUrl = `${base}/settings/notifications`;
  const name = displayText(user.name, 50) || "there";

  const formatDue = new Intl.DateTimeFormat("en-GB", {
    timeZone: window.timeZone, dateStyle: "medium", timeStyle: "short",
  });

  const total = summary.overdue.total + summary.today.total;
  const sections = [
    ["Overdue from earlier days", summary.overdue],
    ["Due today", summary.today],
  ];

  const textSections = [];
  const htmlSections = [];

  for (const [heading, section] of sections) {
    const textRows = [];
    const htmlRows = [];

    for (const task of section.rows) {
      const title = displayText(task.title, 120) || "Untitled task";
      const due = formatDue.format(new Date(task.dueAt));
      const kind = task.kind === "follow_up" ? "Lead follow-up" : "Personal task";
      // Do not include lead contact details, notes or user-supplied links.
      textRows.push(`- ${title} | ${kind} | ${due}`);

      htmlRows.push(`<li style="margin-bottom:12px"><strong>${escapeHtml(title)}</strong>` +
        `<br><span>${escapeHtml(kind)} · ${escapeHtml(due)}</span></li>`);
    }

    const remaining = Math.max(0, section.total - section.rows.length);
    const more = remaining ? `${remaining} more in your Follow-ups workspace.` : "";

    textSections.push(`${heading}: ${section.total}\n${textRows.join("\n") || "None."}` + (more ? `\n${more}` : ""));

    htmlSections.push(`<h2 style="font-size:18px">${heading}: ${section.total}</h2>` +
      (htmlRows.length ? `<ul style="padding-left:20px">${htmlRows.join("")}</ul>` : "<p>None.</p>") +
      (more ? `<p>${escapeHtml(more)}</p>` : ""));
  }

  const introduction = `Your LeadFlow summary for ${window.localDate} (${window.timeZone}).`;
  const explanation = "This is a snapshot of your pending tasks when the digest was prepared. " +
    "Open LeadFlow for their current status.";

  return {
    to: user.email,

    subject: `LeadFlow daily summary — ${window.localDate} (${total} pending)`,

    text: `Hello ${name},\n\n${introduction}\n\n${textSections.join("\n\n")}\n\n` +
      `${explanation}\n\nView tasks: ${tasksUrl}\n\n` +
      `You enabled daily email summaries. Change or turn them off here: ${settingsUrl}`,

    html: "<!doctype html><html lang=\"en\"><body style=\"margin:0;background:#f1f5f9;color:#0f172a;" +
      "font-family:Arial,sans-serif;line-height:1.6\">" +
      "<main style=\"max-width:600px;margin:24px auto;padding:28px;background:white;border-radius:12px\">" +
      "<p style=\"color:#1d4ed8;font-weight:bold\">LeadFlow</p>" +
      `<h1 style="font-size:24px">Your daily task summary</h1><p>Hello ${escapeHtml(name)},</p>` +
      `<p>${escapeHtml(introduction)}</p>${htmlSections.join("")}` +
      `<p><a href="${escapeHtml(tasksUrl)}" style="color:#1d4ed8;font-weight:bold">Open Follow-ups &amp; Tasks</a></p>` +
      `<p style="font-size:13px;color:#475569">${escapeHtml(explanation)}</p>` +
      "<hr style=\"border:0;border-top:1px solid #e2e8f0\">" +
      `<p style="font-size:13px">You enabled daily email summaries. ` +
      `<a href="${escapeHtml(settingsUrl)}">Change settings or turn them off</a>.</p>` +
      "</main></body></html>",
  };
}

function smtpAccepted(result, address) {
  return Array.isArray(result?.accepted) && result.accepted.some((accepted) =>
    typeof accepted === "string" && accepted.toLowerCase() === address.toLowerCase());
}

module.exports = {
  ROLES, digestError, clientOrigin, checkCronAuthorization, localDayWindow,
  eligibleRecipient, recipientFingerprint, buildDigestEmail, smtpAccepted,
};
