export const reminderChoices = [0, 15, 30, 60];
export const preferenceFields = ["inAppEnabled", "dailyEmailEnabled", "reminderMinutes", "timeZone"];

export const isSupportedTimeZone = (value) => {
  if (typeof value !== "string" || !value || value.length > 100 || /^[+-]/.test(value)) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch { return false; }
};

export const detectTimeZone = () => {
  try {
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isSupportedTimeZone(zone) ? zone : null;
  } catch { return null; }
};

export const timeZoneChoices = (savedZone, detectedZone) => {
  let supported = [];

  try { supported = Intl.supportedValuesOf?.("timeZone") ?? []; } catch { /* Use the fallback list. */ }

  const fallback = ["UTC", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo",
    "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Australia/Sydney"];

  // Include the saved identifier verbatim; browsers can use different aliases.
  // Loading settings must not silently replace an existing time-zone choice.
  const extra = [detectedZone, ...fallback].filter(isSupportedTimeZone);

  return [...new Set([savedZone, ...extra, ...supported].filter(Boolean))].sort();
};

export const readPreferenceResponse = (data) => {
  const value = data?.preferences;

  if (data?.success !== true ||
    typeof value?.inAppEnabled !== "boolean" ||
    typeof value.dailyEmailEnabled !== "boolean" ||
    !reminderChoices.includes(value.reminderMinutes) ||
    typeof value.timeZone !== "string" || !value.timeZone.trim() || value.timeZone.length > 100 ||
    !Number.isSafeInteger(value.version) || value.version < 0) {
    throw new Error("Unable to confirm the saved settings. Reload them and try again.");
  }

  return {
    inAppEnabled: value.inAppEnabled,
    dailyEmailEnabled: value.dailyEmailEnabled,
    reminderMinutes: value.reminderMinutes,
    timeZone: value.timeZone,
    version: value.version,
  };
};

export const makePreferencePatch = ({ version, changes } = {}) => {
  const invalid = (message) => { throw Object.assign(new Error(message), { statusCode: 400 }); };

  if (!Number.isSafeInteger(version) || version < 0 || version >= Number.MAX_SAFE_INTEGER) {
    invalid("Reload the saved settings before saving again.");
  }

  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    invalid("Choose a setting to update.");
  }

  const fields = Object.keys(changes);

  if (!fields.length || fields.some((field) => !preferenceFields.includes(field))) {
    invalid("Choose a supported notification setting to change.");
  }

  const body = { version };
  if (Object.hasOwn(changes, "inAppEnabled")) {
    if (typeof changes.inAppEnabled !== "boolean") invalid("Choose whether to enable in-app reminders.");
    body.inAppEnabled = changes.inAppEnabled;
  }

  if (Object.hasOwn(changes, "dailyEmailEnabled")) {
    if (typeof changes.dailyEmailEnabled !== "boolean") invalid("Choose whether to enable daily email summaries.");
    body.dailyEmailEnabled = changes.dailyEmailEnabled;
  }

  if (Object.hasOwn(changes, "reminderMinutes")) {
    if (!reminderChoices.includes(changes.reminderMinutes)) invalid("Choose a supported reminder time.");
    body.reminderMinutes = changes.reminderMinutes;
  }

  if (Object.hasOwn(changes, "timeZone")) {
    const zone = typeof changes.timeZone === "string" ? changes.timeZone.trim() : changes.timeZone;

    if (!isSupportedTimeZone(zone)) invalid("Choose a valid email time zone.");
    body.timeZone = zone;
  }

  return body;
};
