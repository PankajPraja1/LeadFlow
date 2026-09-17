// Uses mocked HTTP only: no server, database, account, or email is touched.
import assert from "node:assert/strict";
import { startNotificationPolling } from "../src/features/notifications/notificationPolling.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const flush = () => new Promise((done) => setImmediate(done));

class Events {
  listeners = new Map();
  visibilityState = "visible";
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(callback);
  }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name) { for (const callback of this.listeners.get(name) ?? []) callback(); }
  size() { return [...this.listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0); }
}

const pollingHarness = (refresh) => {
  const documentTarget = new Events();
  const windowTarget = new Events();
  const timers = new Map();
  let next = 0;
  let online = true;
  const stop = startNotificationPolling({
    refresh, documentTarget, windowTarget,
    isOnline: () => online,
    setTimer: (callback, delay) => { const id = ++next; timers.set(id, { callback, delay }); return id; },
    clearTimer: (id) => timers.delete(id),
  });
  return {
    stop, timers, documentTarget, windowTarget,
    online: (value) => { online = value; windowTarget.emit(value ? "online" : "offline"); },
    fire: () => {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      return timer.callback();
    },
    delay: () => timers.values().next().value?.delay,
  };
};

async function checkPolling() {
  let calls = 0;
  const h = pollingHarness(() => {
    calls += 1;
    return Promise.resolve({ meta: { requestStatus: "fulfilled" }, payload: { hasMore: false } });
  });
  assert.equal(h.delay(), 0);
  await h.fire();
  assert.equal(calls, 1);
  assert.equal(h.delay(), 60000);
  h.documentTarget.visibilityState = "hidden";
  h.documentTarget.emit("visibilitychange");
  assert.equal(h.timers.size, 0);
  h.online(false);
  h.documentTarget.visibilityState = "visible";
  h.documentTarget.emit("visibilitychange");
  assert.equal(h.timers.size, 0);
  h.online(true);
  assert.equal(h.delay(), 0);
  await h.fire();
  assert.equal(calls, 2);
  h.stop();
  assert.equal(h.timers.size, 0);
  assert.equal(h.documentTarget.size() + h.windowTarget.size(), 0);
  console.log("PASS: Foreground/online refresh and complete listener cleanup");

  let aborted = 0;
  const pending = deferred();
  pending.promise.abort = () => {
    aborted += 1;
    pending.resolve({ meta: { requestStatus: "rejected" } });
  };
  const waiting = pollingHarness(() => pending.promise);
  const tick = waiting.fire();
  waiting.documentTarget.visibilityState = "hidden";
  waiting.documentTarget.emit("visibilitychange");
  await tick;
  assert.equal(aborted, 1);
  assert.equal(waiting.timers.size, 0);
  waiting.stop();

  const backlog = pollingHarness(() => Promise.resolve({
    meta: { requestStatus: "fulfilled" }, payload: { hasMore: true },
  }));
  await backlog.fire();
  assert.equal(backlog.delay(), 5000);
  backlog.stop();

  const failedRefresh = pollingHarness(() => Promise.reject(new Error("Offline")));
  await failedRefresh.fire();
  assert.equal(failedRefresh.delay(), 60000);
  failedRefresh.stop();

  const strictSetup = pollingHarness(() => { throw new Error("A stopped setup must not run"); });
  strictSetup.stop();
  assert.equal(strictSetup.timers.size, 0);
  console.log("PASS: In-flight abort, bounded-backlog delay and immediate cleanup");
}

async function checkState() {
  const [{ configureStore }, { createNotificationState }] = await Promise.all([
    import("@reduxjs/toolkit"),
    import("../src/features/notifications/notificationState.js"),
  ]);
  const id = "a".repeat(24);
  const date = "2026-09-16T12:00:00.000Z";
  const row = (readAt = null) => ({
    _id: id, type: "task_reminder", scheduledFor: date, createdAt: date, readAt,
    task: { _id: "1".repeat(24), title: "Test only", kind: "personal", dueAt: date, status: "pending", lead: null },
  });
  const inbox = (items = [row()], query = { page: 1, limit: 10 }, total = items.length) => ({
    data: {
      success: true, notifications: items,
      unreadCount: items.filter((item) => !item.readAt).length,
      pagination: { page: query.page, limit: query.limit, total, pages: Math.max(1, Math.ceil(total / query.limit)) },
    },
  });
  const sync = (hasMore = false) => ({
    data: { success: true, inAppEnabled: true, processed: 0, created: 0, hasMore },
  });
  const auth = {
    token: "test-token-a", user: { id: "2".repeat(24), systemRole: "member", isActive: true, isEmailVerified: true },
    isCheckingAuth: false, authCheckError: null,
  };
  const harness = () => {
    const api = {
      post: async () => sync(),
      get: async (_, config) => inbox([row()], config.params),
      patch: async (_, body) => ({ data: { success: true, notification: row(body.isRead ? date : null) } }),
    };
    let sessionChecks = 0;
    const feature = createNotificationState({
      api,
      getCurrentUser: () => () => { sessionChecks += 1; },
    });
    const store = configureStore({
      reducer: {
        auth: (state = auth, action) => action.type === "test/session" ? action.payload : state,
        notifications: feature.reducer,
      }
    });
    return { api, feature, store, state: () => store.getState().notifications, sessionChecks: () => sessionChecks };
  };

  const h = harness();
  await h.store.dispatch(h.feature.refreshNotifications());
  assert.equal(h.state().unreadCount, 1);
  assert.equal(h.state().items[0].task.title, "Test only");
  const mark = await h.store.dispatch(h.feature.setNotificationRead({ id, isRead: true }));
  assert.equal(mark.meta.requestStatus, "fulfilled");
  assert.equal(h.state().items[0].readAt, date);
  assert.equal(h.state().unreadCount, null); // Await the server's fresh count.
  h.api.get = async (_, config) => inbox([row(date)], config.params);
  await h.store.dispatch(h.feature.refreshNotifications());
  assert.equal(h.state().unreadCount, 0);
  assert.equal(h.state().items.length, 1);
  await h.store.dispatch(h.feature.setNotificationRead({ id, isRead: false }));
  assert.equal(h.state().items[0].readAt, null);
  console.log("PASS: Read/unread changes preserve tasks and use a fresh inbox count");

  const stale = harness();
  const oldGet = deferred();
  stale.api.get = () => oldGet.promise;
  const oldRefresh = stale.store.dispatch(stale.feature.refreshNotifications());
  await flush();
  await stale.store.dispatch(stale.feature.setNotificationRead({ id, isRead: true }));
  oldGet.resolve(inbox());
  await oldRefresh;
  assert.equal(stale.state().unreadCount, null);
  stale.api.get = async (_, config) => inbox([row(date)], config.params);
  await stale.store.dispatch(stale.feature.refreshNotifications());
  assert.equal(stale.state().items[0].readAt, date);
  console.log("PASS: A late GET cannot overwrite a newer read action");

  const account = harness();
  const oldSync = deferred();
  let capturedHeader;
  let gets = 0;
  account.api.post = (_, __, config) => { capturedHeader = config.headers.Authorization; return oldSync.promise; };
  account.api.get = async () => { gets += 1; return inbox(); };
  const previous = account.store.dispatch(account.feature.refreshNotifications());
  account.store.dispatch({ type: "test/session", payload: { ...auth, token: "test-token-b", user: { ...auth.user, id: "3".repeat(24) } } });
  account.store.dispatch(account.feature.actions.resetNotifications());
  oldSync.resolve(sync());
  await previous;
  assert.equal(capturedHeader, "Bearer test-token-a");
  assert.equal(gets, 0);
  assert.deepEqual(account.state().items, []);
  assert.equal(account.state().unreadCount, null);

  const lateWrite = deferred();
  account.api.patch = () => lateWrite.promise;
  const writing = account.store.dispatch(account.feature.setNotificationRead({ id, isRead: true }));
  account.store.dispatch({ type: "test/session", payload: { ...auth, token: null, user: null } });
  account.store.dispatch(account.feature.actions.resetNotifications());
  lateWrite.resolve({ data: { success: true, notification: row(date) } });
  await writing;
  assert.equal(account.state().readStatus, "idle");
  assert.deepEqual(account.state().items, []);
  console.log("PASS: Account switches and logout reject old refresh/write responses");

  const batches = harness();
  let posts = 0;
  batches.api.post = async () => { posts += 1; return sync(true); };
  await batches.store.dispatch(batches.feature.refreshNotifications());
  assert.equal(posts, 3);
  assert.equal(batches.state().hasMore, true);
  batches.api.post = async () => ({ data: { ...sync().data, inAppEnabled: false } });
  await batches.store.dispatch(batches.feature.refreshNotifications());
  assert.equal(batches.state().inAppEnabled, false);
  assert.equal(batches.state().items.length, 1);
  console.log("PASS: Sync is capped at three batches and paused reminders retain their inbox");

  const pages = harness();
  const queriedPages = [];
  pages.store.dispatch(pages.feature.actions.setNotificationView({ page: 2, unread: true }));
  pages.api.get = async (_, config) => {
    queriedPages.push(config.params.page);
    return inbox(config.params.page === 2 ? [] : [row()], config.params, 1);
  };
  await pages.store.dispatch(pages.feature.refreshNotifications());
  assert.deepEqual(queriedPages, [2, 1]);
  assert.equal(pages.state().query.page, 1);
  await pages.store.dispatch(pages.feature.setNotificationRead({ id, isRead: true }));
  assert.equal(pages.state().items.length, 0);
  console.log("PASS: Unread filtering and a disappearing final page recover correctly");

  const filters = harness();
  const firstPage = deferred();
  filters.api.get = () => firstPage.promise;
  const firstRequest = filters.store.dispatch(filters.feature.refreshNotifications());
  await flush();
  filters.store.dispatch(filters.feature.actions.setNotificationView({ page: 1, unread: true }));
  filters.api.get = async (_, config) => inbox([], config.params);
  await filters.store.dispatch(filters.feature.refreshNotifications());
  firstPage.resolve(inbox());
  await firstRequest;
  assert.equal(filters.state().query.unread, true);
  assert.equal(filters.state().items.length, 0);

  const viewer = harness();
  viewer.store.dispatch({ type: "test/session", payload: { ...auth, user: { ...auth.user, systemRole: "viewer" } } });
  const viewerRead = await viewer.store.dispatch(viewer.feature.setNotificationRead({ id, isRead: true }));
  assert.equal(viewerRead.meta.requestStatus, "fulfilled");
  viewer.store.dispatch({ type: "test/session", payload: { ...auth, user: { ...auth.user, isEmailVerified: false } } });
  const refused = await viewer.store.dispatch(viewer.feature.refreshNotifications());
  assert.equal(refused.meta.condition, true);
  console.log("PASS: Changed filters reject older results; viewers can read and unverified sessions cannot request");

  const errors = harness();
  errors.api.get = async () => ({ data: { success: true, notifications: "invalid" } });
  await errors.store.dispatch(errors.feature.refreshNotifications());
  assert.equal(errors.state().refreshStatus, "failed");
  assert.equal(errors.state().unreadCount, null);
  errors.api.post = async () => { throw { response: { status: 401, data: { message: "Expired session" } } }; };
  await errors.store.dispatch(errors.feature.refreshNotifications());
  assert.equal(errors.sessionChecks(), 1);

  const cancelled = harness();
  const work = deferred();
  let requestedSignal;
  cancelled.api.post = (_, __, config) => { requestedSignal = config.signal; return work.promise; };
  const request = cancelled.store.dispatch(cancelled.feature.refreshNotifications());
  request.abort();
  await request;
  assert.equal(requestedSignal.aborted, true);
  assert.equal(cancelled.state().refreshStatus, "idle");
  work.resolve(sync());
  await flush();
  assert.deepEqual(cancelled.state().items, []);
  console.log("PASS: Malformed responses, session failures and aborted refreshes are handled");
}

await checkPolling();
if (!process.argv.includes("--polling-only")) await checkState();
console.log(process.argv.includes("--polling-only")
  ? "POLLING CHECKS PASSED; Redux checks still need the frontend dependencies"
  : "ALL FRONTEND NOTIFICATION STATE AND POLLING CHECKS PASSED");
