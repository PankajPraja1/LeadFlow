// Mocked frontend HTTP only. This script never connects to your backend or Atlas.
import assert from "node:assert/strict";
import {
  makePreferencePatch,
  readPreferenceResponse,
  detectTimeZone,
  isSupportedTimeZone,
  timeZoneChoices,
} from "../src/features/notifications/notificationPreferenceValues.js";

const saved = () => ({
  inAppEnabled: true, dailyEmailEnabled: true, reminderMinutes: 15,
  timeZone: "Asia/Kolkata", version: 4,
});
const response = (preferences) => ({ data: { success: true, preferences: structuredClone(preferences) } });
const flush = () => new Promise((done) => setImmediate(done));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function checkValues() {
  assert.deepEqual(makePreferencePatch({ version: 4, changes: { inAppEnabled: false, reminderMinutes: 0 } }),
    { version: 4, inAppEnabled: false, reminderMinutes: 0 });
  for (const minutes of [0, 15, 30, 60]) {
    assert.equal(makePreferencePatch({ version: 0, changes: { reminderMinutes: minutes } }).reminderMinutes, minutes);
  }
  assert.deepEqual(makePreferencePatch({ version: 4,
    changes: { dailyEmailEnabled: false, timeZone: " Asia/Kolkata " } }),
  { version: 4, dailyEmailEnabled: false, timeZone: "Asia/Kolkata" });
  assert.deepEqual(makePreferencePatch({ version: 4, changes: { dailyEmailEnabled: true } }),
    { version: 4, dailyEmailEnabled: true });
  assert.deepEqual(makePreferencePatch({ version: 4, changes: { timeZone: "Asia/Calcutta" } }),
    { version: 4, timeZone: "Asia/Calcutta" });
  for (const argument of [
    {}, { version: -1, changes: { inAppEnabled: true } },
    { version: Number.MAX_SAFE_INTEGER, changes: { inAppEnabled: false } },
    { version: "4", changes: { inAppEnabled: true } },
    { version: 4, changes: {} }, { version: 4, changes: [] },
    { version: 4, changes: { reminderMinutes: "15" } },
    { version: 4, changes: { reminderMinutes: 5 } },
    { version: 4, changes: { inAppEnabled: "false" } },
    { version: 4, changes: { dailyEmailEnabled: "false" } },
    { version: 4, changes: { dailyEmailEnabled: 1 } },
    { version: 4, changes: { timeZone: "Invalid/Zone" } },
    { version: 4, changes: { timeZone: "" } },
    { version: 4, changes: { timeZone: null } },
    { version: 4, changes: { timeZone: "+05:30" } },
    { version: 4, changes: { digestHour: 9 } },
    { version: 4, changes: { user: "someone-else" } },
  ]) assert.throws(() => makePreferencePatch(argument), (error) => error.statusCode === 400);

  const parsed = readPreferenceResponse(response(saved()).data);
  assert.equal(parsed.dailyEmailEnabled, true);
  assert.equal(parsed.timeZone, "Asia/Kolkata");
  for (const preferences of [
    null, { ...saved(), version: "4" }, { ...saved(), inAppEnabled: "false" },
    { ...saved(), dailyEmailEnabled: null }, { ...saved(), reminderMinutes: 5 },
    { ...saved(), timeZone: "" },
  ]) assert.throws(() => readPreferenceResponse({ success: true, preferences }));
  const options = timeZoneChoices("Asia/Calcutta", "America/New_York");
  for (const zone of ["UTC", "Asia/Kolkata", "Asia/Calcutta", "America/New_York"]) {
    assert.ok(options.includes(zone));
  }
  assert.equal(new Set(options).size, options.length);
  assert.ok(detectTimeZone() === null || isSupportedTimeZone(detectTimeZone()));
  const supportedValues = Intl.supportedValuesOf;
  try {
    Intl.supportedValuesOf = undefined;
    const fallback = timeZoneChoices("Asia/Calcutta", "Asia/Kolkata");
    assert.ok(fallback.includes("Asia/Calcutta"));
    assert.ok(fallback.includes("Asia/Kolkata"));
    assert.ok(fallback.includes("UTC"));
  } finally { Intl.supportedValuesOf = supportedValues; }
  console.log("PASS: Explicit email opt-in/out, valid zones, preserved aliases and fallback zone choices");
}

async function checkState() {
  const [{ configureStore }, { createNotificationState }] = await Promise.all([
    import("@reduxjs/toolkit"),
    import("../src/features/notifications/notificationState.js"),
  ]);
  const initialAuth = {
    token: "test-token-a",
    user: { id: "a".repeat(24), systemRole: "member", isActive: true, isEmailVerified: true },
    isCheckingAuth: false, authCheckError: null,
  };
  const client = () => {
    const api = {
      preferences: saved(), patches: [], syncCalls: 0,
      get: async (path, config) => path === "/notifications/preferences"
        ? response(api.preferences)
        : { data: {
          success: true, notifications: [], unreadCount: 0,
          pagination: { page: config.params.page, limit: config.params.limit, pages: 1, total: 0 },
        } },
      post: async () => {
        api.syncCalls += 1;
        return { data: { success: true, inAppEnabled: api.preferences.inAppEnabled, processed: 0, created: 0, hasMore: false } };
      },
      patch: async (path, body) => {
        assert.equal(path, "/notifications/preferences");
        api.patches.push(structuredClone(body));
        if (body.version !== api.preferences.version) {
          throw { response: { status: 409, data: { code: "PREFERENCES_CONFLICT", message: "Settings changed" } } };
        }
        api.preferences = { ...api.preferences, ...body, version: body.version + 1 };
        return response(api.preferences);
      },
    };
    return api;
  };
  const harness = (api = client()) => {
    let authChecks = 0;
    const feature = createNotificationState({ api, getCurrentUser: () => () => { authChecks += 1; } });
    const store = configureStore({ reducer: {
      auth: (state = initialAuth, action) => action.type === "test/session" ? action.payload : state,
      notifications: feature.reducer,
    } });
    return {
      api, feature, store,
      state: () => store.getState().notifications,
      checks: () => authChecks,
      load: () => store.dispatch(feature.fetchNotificationPreferences()),
      save: (version, changes) => store.dispatch(feature.saveNotificationPreferences({ version, changes })),
      switchSession: (auth) => {
        store.dispatch({ type: "test/session", payload: auth });
        // App rootReducer performs this reset on accepted auth-access changes.
        store.dispatch(feature.actions.resetNotifications());
      },
    };
  };

  const h = harness();
  await h.load();
  assert.equal(h.state().preferences.version, 4);
  await h.save(4, { inAppEnabled: false });
  assert.deepEqual(h.api.patches, [{ version: 4, inAppEnabled: false }]);
  assert.equal(h.state().preferences.version, 5);
  assert.equal(h.state().preferences.dailyEmailEnabled, true);
  assert.equal(h.state().preferences.timeZone, "Asia/Kolkata");
  assert.equal(h.state().inAppEnabled, false);
  assert.equal(h.state().refreshKey, 1);
  assert.equal(h.state().preferencesMessage, "Notification settings saved.");
  await h.save(5, { dailyEmailEnabled: false, timeZone: "UTC" });
  assert.deepEqual(h.api.patches[1], { version: 5, dailyEmailEnabled: false, timeZone: "UTC" });
  assert.equal(h.state().preferences.dailyEmailEnabled, false);
  assert.equal(h.state().preferences.timeZone, "UTC");
  assert.equal(h.state().preferences.reminderMinutes, 15);
  assert.equal(h.state().preferences.inAppEnabled, false);
  console.log("PASS: Versioned save changes only selected fields and requests an inbox refresh");

  const shared = client();
  const tabA = harness(shared);
  const tabB = harness(shared);
  await Promise.all([tabA.load(), tabB.load()]);
  await tabA.save(4, { reminderMinutes: 30 });
  await tabB.save(4, { inAppEnabled: false });
  assert.equal(tabB.state().preferencesNeedsReload, true);
  assert.match(tabB.state().preferencesError, /another tab/);
  const count = shared.patches.length;
  const blocked = await tabB.save(4, { inAppEnabled: false });
  assert.equal(blocked.meta.condition, true);
  assert.equal(shared.patches.length, count);
  tabB.store.dispatch(tabB.feature.actions.clearPreferenceFeedback());
  assert.equal(tabB.state().preferencesNeedsReload, true);
  assert.match(tabB.state().preferencesError, /another tab/);
  await tabB.load();
  assert.equal(tabB.state().preferences.version, 5);
  assert.equal(tabB.state().preferencesNeedsReload, false);
  await tabB.save(5, { inAppEnabled: false });
  assert.equal(shared.preferences.reminderMinutes, 30);
  assert.equal(shared.preferences.inAppEnabled, false);
  assert.equal(shared.preferences.version, 6);
  console.log("PASS: Two-tab conflicts require reload and preserve the other tab's changes");

  const emailSettings = client();
  const emailTab = harness(emailSettings);
  const zoneTab = harness(emailSettings);
  await Promise.all([emailTab.load(), zoneTab.load()]);
  await emailTab.save(4, { dailyEmailEnabled: false });
  await zoneTab.save(4, { timeZone: "America/New_York" });
  assert.equal(zoneTab.state().preferencesNeedsReload, true);
  await zoneTab.load();
  await zoneTab.save(5, { timeZone: "America/New_York" });
  assert.equal(emailSettings.preferences.dailyEmailEnabled, false);
  assert.equal(emailSettings.preferences.timeZone, "America/New_York");
  assert.equal(emailSettings.preferences.inAppEnabled, true);
  console.log("PASS: A time-zone edit cannot silently undo another tab's email opt-out");

  const pendingLoad = harness();
  const lateGet = deferred();
  let header;
  pendingLoad.api.get = (_, config) => { header = config.headers.Authorization; return lateGet.promise; };
  const oldLoad = pendingLoad.load();
  pendingLoad.switchSession({ ...initialAuth, token: "test-token-b", user: { ...initialAuth.user, id: "b".repeat(24) } });
  lateGet.resolve(response(saved()));
  await oldLoad;
  assert.equal(header, "Bearer test-token-a");
  assert.equal(pendingLoad.state().preferences, null);

  const pendingSave = harness();
  await pendingSave.load();
  const latePatch = deferred();
  pendingSave.api.patch = () => latePatch.promise;
  const oldSave = pendingSave.save(4, { inAppEnabled: false });
  pendingSave.switchSession({ ...initialAuth, token: null, user: null });
  latePatch.resolve(response({ ...saved(), inAppEnabled: false, version: 5 }));
  await oldSave;
  assert.equal(pendingSave.state().preferences, null);
  assert.equal(pendingSave.state().preferencesMessage, null);
  assert.equal(pendingSave.state().inAppEnabled, null);
  console.log("PASS: Late loads and saves cannot restore a previous account's settings");

  const racing = harness();
  await racing.load();
  const oldSync = deferred();
  racing.api.post = () => oldSync.promise;
  const refresh = racing.store.dispatch(racing.feature.refreshNotifications());
  const write = racing.save(4, { inAppEnabled: false });
  const skipped = await racing.store.dispatch(racing.feature.refreshNotifications());
  assert.equal(skipped.meta.condition, true);
  await write;
  oldSync.resolve({ data: { success: true, inAppEnabled: true, processed: 0, created: 0, hasMore: false } });
  await refresh;
  assert.equal(racing.state().inAppEnabled, false);
  console.log("PASS: A pre-save sync cannot restore an old enabled flag");

  const uncertain = harness();
  await uncertain.load();
  let attempts = 0;
  uncertain.api.patch = async () => {
    attempts += 1;
    uncertain.api.preferences = { ...saved(), inAppEnabled: false, version: 5 };
    throw { isAxiosError: true, response: { status: 503, data: { message: "Connection interrupted" } } };
  };
  await uncertain.save(4, { inAppEnabled: false });
  assert.equal(uncertain.state().preferencesNeedsReload, true);
  await uncertain.save(4, { inAppEnabled: false });
  assert.equal(attempts, 1);
  await uncertain.load();
  assert.equal(uncertain.state().preferences.version, 5);
  assert.equal(uncertain.state().preferences.inAppEnabled, false);
  assert.equal(uncertain.state().preferencesNeedsReload, false);
  console.log("PASS: An uncertain save is recovered by reading without automatically retrying the write");

  const invalid = harness();
  invalid.api.get = async () => response({ ...saved(), version: "4" });
  await invalid.load();
  assert.equal(invalid.state().preferencesStatus, "failed");
  assert.equal(invalid.state().preferences, null);
  const badSave = harness();
  await badSave.load();
  await badSave.save(4, { digestHour: 9 });
  assert.equal(badSave.api.patches.length, 0);
  badSave.api.patch = async () => response({ ...saved(), inAppEnabled: false });
  await badSave.save(4, { inAppEnabled: false });
  assert.equal(badSave.state().preferencesNeedsReload, true);
  assert.equal(badSave.state().preferencesMessage, null);
  console.log("PASS: Malformed responses, unsupported fields and unconfirmed writes are rejected");

  const viewer = harness();
  viewer.switchSession({ ...initialAuth, user: { ...initialAuth.user, systemRole: "viewer" } });
  await viewer.load();
  await viewer.save(4, { reminderMinutes: 0 });
  assert.equal(viewer.state().preferences.reminderMinutes, 0);
  viewer.switchSession({ ...initialAuth, user: { ...initialAuth.user, isEmailVerified: false } });
  const unavailable = await viewer.load();
  assert.equal(unavailable.meta.condition, true);
  const denied = harness();
  denied.api.get = async () => { throw { response: { status: 401, data: { message: "Session expired" } } }; };
  await denied.load();
  assert.equal(denied.checks(), 1);

  const cancelled = harness();
  const work = deferred();
  let signal;
  cancelled.api.get = (_, config) => { signal = config.signal; return work.promise; };
  const cancelledRequest = cancelled.load();
  cancelledRequest.abort();
  await cancelledRequest;
  assert.equal(signal.aborted, true);
  work.resolve(response(saved()));
  await flush();
  assert.equal(cancelled.state().preferences, null);
  assert.equal(cancelled.state().preferencesStatus, "idle");
  console.log("PASS: Viewer preferences, session checks and cancelled loads follow the existing auth flow");
}

checkValues();
if (!process.argv.includes("--values-only")) await checkState();
console.log(process.argv.includes("--values-only")
  ? "PREFERENCE VALUE CHECKS PASSED; Redux checks still need the frontend dependencies"
  : "ALL FRONTEND NOTIFICATION PREFERENCE CHECKS PASSED");
