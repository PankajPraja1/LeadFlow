import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { Bell, RefreshCw, X } from "lucide-react";
import { requestNotificationRefresh, setNotificationRead, setNotificationView, } from "../../features/notifications/notificationSlice";
import { canUseNotifications } from "../../features/notifications/notificationState";

const focusStyle = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const formatDate = (value) => new Date(value).toLocaleString(undefined, {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
});

const subscribeOnline = (listener) => {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);

  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
};

const onlineSnapshot = () => navigator.onLine;

function NotificationBell() {
  const dispatch = useDispatch();
  const enabled = useSelector((state) => canUseNotifications(state.auth));
  const token = useSelector((state) => state.auth.token);
  const {
    items, unreadCount, pagination, query, refreshStatus, refreshError,
    readStatus, readingId, readError, hasMore, inAppEnabled, lastUpdated,
  } = useSelector((state) => state.notifications);
  const [openedSession, setOpenedSession] = useState(null);

  const online = useSyncExternalStore(subscribeOnline, onlineSnapshot, () => true);
  const isOpen = enabled && openedSession !== null && openedSession === token;
  const dialogRef = useRef(null);
  const buttonRef = useRef(null);
  const closeRef = useRef(null);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const loading = refreshStatus === "loading";
  const saving = readStatus === "loading";

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    const button = buttonRef.current;

    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;

    if (!dialog.open) dialog.showModal();

    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;

      if (button?.isConnected && button.getClientRects().length > 0) {
        button.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  const close = () => setOpenedSession(null);
  const refresh = () => dispatch(requestNotificationRefresh());
  const changeView = (page, unread = query.unread) => {
    dispatch(setNotificationView({ page, unread }));
  };
  const changeRead = async (item) => {
    const action = await dispatch(setNotificationRead({ id: item._id, isRead: item.readAt === null }));
    // The focused row disappears from Unread after a successful read action.
    if (action.meta.requestStatus === "fulfilled" && query.unread && dialogRef.current?.open) {
      closeRef.current?.focus({ preventScroll: true });
    }
  };

  if (!enabled) return null;

  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => { setOpenedSession(token); refresh(); }}
        aria-label={`Open notifications${unreadCount === null ? "" : `, ${unreadCount} unread`}`}
        aria-haspopup="dialog" aria-controls={dialogId} aria-expanded={isOpen}
        className={`relative inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 ${focusStyle}`}
      >
        <Bell size={20} aria-hidden="true" />

        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute -right-2 -top-2 min-w-5 rounded-full bg-blue-700 px-1 text-center text-[11px] font-bold leading-5 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}

        {(refreshError || !online) && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-500" />
        )}
      </button>

      {createPortal(
        <dialog ref={dialogRef} id={dialogId} aria-labelledby={titleId}
          onCancel={(event) => { event.preventDefault(); close(); }}
          onClose={(event) => { if (!event.currentTarget.open) close(); }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
          }}
          className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40"
        >
          <div className="flex max-h-[85dvh] flex-col">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <h2 id={titleId} className="text-xl font-bold">Notifications</h2>

                <p className="mt-1 text-sm text-slate-500" aria-live="polite" aria-atomic="true">
                  {unreadCount === null
                    ? refreshError ? "Unread count unavailable" : "Checking unread count…"
                    : `${unreadCount} unread reminder${unreadCount === 1 ? "" : "s"}`}
                </p>
              </div>

              <button ref={closeRef} type="button" onClick={close} aria-label="Close notifications"
                className={`cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 ${focusStyle}`}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div role="group" aria-label="Filter notifications" className="flex gap-2">
                {[{ label: "All", unread: false }, { label: "Unread", unread: true }].map((view) => (
                  <button key={view.label} type="button" aria-pressed={query.unread === view.unread} disabled={loading || saving || !online} onClick={() => changeView(1, view.unread)}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle} ${query.unread === view.unread ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
                    {view.label}
                  </button>
                ))}
              </div>

              <button type="button" onClick={refresh} disabled={loading || saving || !online}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}>
                <RefreshCw size={16} aria-hidden="true" />

                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {!online && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                You're offline. Reconnect to refresh your reminders.
              </p>}

              {inAppEnabled === false && (
                <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  New reminders are paused in your notification preferences. Existing reminders remain available.
                </p>
              )}

              {(refreshError || readError) && (
                <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {readError || refreshError}
                </p>
              )}

              {items.length === 0 && (
                <p role="status" className="py-10 text-center text-sm text-slate-500">
                  {!online ? "Notifications will refresh when you're back online."
                    : refreshError ? "Select Refresh to try again."
                      : loading || pagination === null ? "Loading notifications…"
                        : query.unread ? "You're all caught up. No unread reminders."
                          : "No reminders for your pending tasks yet."}
                </p>
              )}

              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item._id} className={`rounded-xl border p-4 ${item.readAt ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 break-words text-sm font-bold text-slate-900">{item.task.title}</h3>

                      <span className={`shrink-0 text-xs font-semibold ${item.readAt ? "text-slate-500" : "text-blue-700"}`}>
                        {item.readAt ? "Read" : "Unread"}
                      </span>
                    </div>

                    <p className="mt-1 break-words text-xs text-slate-500">
                      {item.task.kind === "follow_up" ? `Follow-up · ${item.task.lead.name}` : "Personal task"}
                    </p>

                    <p className="mt-3 text-sm text-slate-600">
                      Due <time dateTime={item.task.dueAt}>{formatDate(item.task.dueAt)}</time>
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <Link to={item.task.lead ? `/leads/${item.task.lead._id}` : "/follow-ups"}
                        onClick={close} className={`rounded text-sm font-semibold text-blue-700 hover:underline ${focusStyle}`}>
                        {item.task.lead ? "View lead" : "View tasks"}
                      </Link>

                      <button type="button" disabled={saving || !online}
                        onClick={() => changeRead(item)}
                        className={`cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}>
                        {saving && readingId === item._id ? "Saving…" : item.readAt ? "Mark unread" : "Mark read"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {hasMore && <p className="mt-4 text-sm text-slate-500">More reminders will load shortly.</p>}
            </div>

            <div className="shrink-0 space-y-3 border-t border-slate-200 px-5 py-4">
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <button type="button" disabled={loading || saving || !online || query.page <= 1} onClick={() => changeView(query.page - 1)}
                    className={`cursor-pointer rounded-lg border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 ${focusStyle}`}>Previous</button>

                  <span>Page {query.page} of {pagination.pages}</span>

                  <button type="button" disabled={loading || saving || !online || query.page >= pagination.pages || query.page >= 10000}
                    onClick={() => changeView(query.page + 1)}
                    className={`cursor-pointer rounded-lg border border-slate-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 ${focusStyle}`}>Next</button>
                </div>
              )}

              <Link to="/settings/notifications" onClick={close}
                className={`inline-block rounded text-sm font-semibold text-blue-700 hover:underline ${focusStyle}`}>
                Notification settings
              </Link>

              <p className="text-xs leading-5 text-slate-500">
                Marking a reminder read keeps its task pending.
                {lastUpdated && ` Updated ${new Date(lastUpdated).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`}
              </p>
            </div>
          </div>
        </dialog>,
        document.body
      )}
    </>
  );
}

export default NotificationBell;
