// Only one instance is mounted, in AppLayout. Both bell buttons share its data.
export const startNotificationPolling = ({
  refresh,
  documentTarget = document,
  windowTarget = window,
  isOnline = () => navigator.onLine,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  interval = 60000,
  backlogInterval = 5000, }) => {

  let disposed = false;
  let timer = null;
  let pending = null;
  let refreshAgain = false;
  const active = () => !disposed && documentTarget.visibilityState === "visible" && isOnline();

  const clear = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };

  const schedule = (delay) => {
    clear();
    if (active()) timer = setTimer(tick, delay);
  };

  async function tick() {
    timer = null;
    if (!active() || pending) return;
    let hasMore = false;

    try {
      pending = refresh();
      const result = await pending;
      hasMore = result?.meta?.requestStatus === "fulfilled" && result.payload.hasMore === true;
    } catch {
      // Redux thunks normally resolve to actions; a rejected adapter must not
      // leave a rejected timer callback or start a rapid retry loop.
      hasMore = false;
    } finally {
      pending = null;
      if (active()) {
        schedule(refreshAgain ? 0 : hasMore ? backlogInterval : interval);
        refreshAgain = false;
      }
    }
  }

  const wake = () => {
    clear();
    if (!active()) {
      pending?.abort?.();
      return;
    }
    if (pending) refreshAgain = true;
    else schedule(0);
  };

  documentTarget.addEventListener("visibilitychange", wake);
  
  for (const event of ["focus", "online", "offline"]) {
    windowTarget.addEventListener(event, wake);
  }
  // Deferring also allows StrictMode's setup/cleanup cycle to finish first.
  schedule(0);

  return () => {
    disposed = true;
    clear();
    pending?.abort?.();
    documentTarget.removeEventListener("visibilitychange", wake);
    for (const event of ["focus", "online", "offline"]) {
      windowTarget.removeEventListener(event, wake);
    }
  };
};
