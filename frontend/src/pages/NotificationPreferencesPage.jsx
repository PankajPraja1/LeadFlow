import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { BellRing, Globe2, Mail, RefreshCw, Save } from "lucide-react";
import { clearPreferenceFeedback, fetchNotificationPreferences, saveNotificationPreferences, } from "../features/notifications/notificationSlice";
import { canUseNotifications } from "../features/notifications/notificationState";
import { detectTimeZone, preferenceFields, timeZoneChoices, } from "../features/notifications/notificationPreferenceValues";

const focusStyle = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const initialForm = (preferences) => ({
  inAppEnabled: preferences.inAppEnabled,
  dailyEmailEnabled: preferences.dailyEmailEnabled,
  reminderMinutes: preferences.reminderMinutes,
  timeZone: preferences.timeZone,
});

function PreferencesForm({ preferences, saving, needsReload, onReload }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState(() => initialForm(preferences));
  const [detectedZone] = useState(detectTimeZone);
  const [zones] = useState(() => timeZoneChoices(preferences.timeZone, detectedZone));
  const dirty = preferenceFields.some((field) => form[field] !== preferences[field]);

  const change = (field, value) => {
    dispatch(clearPreferenceFeedback());
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!dirty || saving || needsReload) return;
    const changes = {};

    for (const field of preferenceFields) {
      if (form[field] !== preferences[field]) changes[field] = form[field];
    }
    await dispatch(saveNotificationPreferences({ version: preferences.version, changes }));
  };

  return (
    <>
      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <fieldset disabled={saving || needsReload} className="space-y-7 disabled:opacity-60">
          <legend className="sr-only">Notification preferences</legend>

          <div>
            <label htmlFor="in-app-reminders" className="flex cursor-pointer items-start gap-3">
              <input id="in-app-reminders" type="checkbox" checked={form.inAppEnabled}
                onChange={(event) => change("inAppEnabled", event.target.checked)} aria-describedby="in-app-help"
                className={`mt-1 h-5 w-5 shrink-0 cursor-pointer accent-blue-700 disabled:cursor-not-allowed ${focusStyle}`}
              />

              <span>
                <span className="block font-semibold text-slate-900">In-app reminders</span>

                <span className="mt-1 block text-sm leading-6 text-slate-600">
                  Receive reminders for your personal tasks and lead follow-ups.
                </span>
              </span>
            </label>

            <p id="in-app-help" className="mt-2 pl-8 text-sm leading-6 text-slate-500">
              Turning this off pauses new reminders. Existing reminders stay available in your inbox.
            </p>
          </div>

          <div>
            <label htmlFor="reminder-minutes" className="mb-2 block text-sm font-semibold text-slate-700">
              Remind me
            </label>

            <select id="reminder-minutes" value={form.reminderMinutes} onChange={(event) => change("reminderMinutes", Number(event.target.value))} aria-describedby="timing-help"
              className={`w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 disabled:cursor-not-allowed sm:max-w-xs ${focusStyle}`}
            >
              <option value={0}>At the due time</option>
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
            </select>

            <p id="timing-help" className="mt-2 text-sm leading-6 text-slate-500">
              Applies to newly created in-app reminders. Daily emails follow the separate schedule below.
              Reminders already in your inbox keep their current timing.
            </p>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="mb-4 flex items-center gap-2 text-slate-900">
              <Mail size={19} aria-hidden="true" className="text-blue-700" />

              <h2 className="font-bold">Daily email summary</h2>
            </div>

            <label htmlFor="daily-email-summary" className="flex cursor-pointer items-start gap-3">
              <input id="daily-email-summary" type="checkbox" checked={form.dailyEmailEnabled}
                onChange={(event) => change("dailyEmailEnabled", event.target.checked)}
                aria-describedby="daily-email-help daily-email-schedule"
                className={`mt-1 h-5 w-5 shrink-0 cursor-pointer accent-blue-700 disabled:cursor-not-allowed ${focusStyle}`}
              />

              <span>
                <span className="block font-semibold text-slate-900">Email me a daily task summary</span>

                <span id="daily-email-help" className="mt-1 block text-sm leading-6 text-slate-600">
                  See pending tasks due today and overdue from earlier days.
                  Summaries go to your verified account email, and empty summaries are skipped.
                </span>
              </span>
            </label>

            <p id="daily-email-schedule" className="mt-3 pl-8 text-sm leading-6 text-slate-500">
              The daily run is scheduled between 03:00 and 04:00 UTC. Delivery time can vary.
              You can turn email summaries off here at any time.
            </p>
          </div>

          <div>
            <label htmlFor="email-time-zone" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Globe2 size={17} aria-hidden="true" />
              Email time zone
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select id="email-time-zone" value={form.timeZone} aria-describedby="email-time-zone-help"
                onChange={(event) => change("timeZone", event.target.value)}
                className={`min-w-0 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 disabled:cursor-not-allowed sm:flex-1 ${focusStyle}`}
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone === "Asia/Kolkata" ? "Asia/Kolkata (India)" : zone.replaceAll("_", " ")}
                  </option>
                ))}
              </select>

              <button type="button" disabled={!detectedZone || detectedZone === form.timeZone}
                onClick={() => { if (detectedZone) change("timeZone", detectedZone); }}
                className={`shrink-0 cursor-pointer rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}
              >
                Use device time zone
              </button>
            </div>

            <p id="email-time-zone-help" className="mt-2 text-sm leading-6 text-slate-500">
              Sets which tasks count as today and how dates appear in your emails.
              The daily delivery schedule stays the same for everyone.
            </p>

            {detectedZone && (
              <p className="mt-1 text-xs text-slate-500">Device time zone: {detectedZone}</p>
            )}
          </div>
        </fieldset>

        <div className="mt-7 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          In-app reminders update while your workspace is open. Email summaries can arrive while it is closed.
          Personal tasks need a due date to appear in either.
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <button type="button" onClick={onReload} disabled={saving}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Reload saved settings
          </button>

          <button type="submit" disabled={!dirty || saving || needsReload}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 ${focusStyle}`}
          >
            <Save size={16} aria-hidden="true" />

            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>

        {dirty && (
          <p className="mt-3 text-sm text-slate-500">
            You have unsaved changes. Reloading replaces them with your saved settings.
          </p>
        )}
      </form>
    </>
  );
}

function NotificationPreferencesPage() {
  const dispatch = useDispatch();
  const enabled = useSelector((state) => canUseNotifications(state.auth));
  const token = useSelector((state) => state.auth.token);
  const userId = useSelector((state) => state.auth.user?.id ?? state.auth.user?._id);
  const role = useSelector((state) => state.auth.user?.systemRole);
  const {
    preferences, preferencesStatus, preferencesError,
    preferencesMessage, preferencesNeedsReload, } = useSelector((state) => state.notifications);

  useEffect(() => {
    if (!enabled) return;
    let request;
    // Avoid a StrictMode cleanup aborting the next mount's initial load.
    const timer = setTimeout(() => { request = dispatch(fetchNotificationPreferences()); }, 0);

    return () => { clearTimeout(timer); request?.abort(); };
  }, [dispatch, enabled, token, userId, role]);

  const reload = () => dispatch(fetchNotificationPreferences());
  if (!enabled) return null;

  return (
    <>
      <main className="mx-auto max-w-4xl px-5 py-8">
        <div className="mb-7 flex items-start gap-3">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
            <BellRing size={22} aria-hidden="true" />
          </div>

          <div>
            <h1 className="text-3xl font-bold text-slate-900">Notification settings</h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Choose in-app reminders and daily email summaries for your tasks.
            </p>
          </div>
        </div>

        {preferencesError && (
          <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            {preferencesError}
            {preferencesNeedsReload && " Reload saved settings before saving again."}
          </p>
        )}

        {preferencesMessage && (
          <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {preferencesMessage}
          </p>
        )}

        {preferences ? (
          <PreferencesForm key={userId} preferences={preferences} saving={preferencesStatus === "saving"} needsReload={preferencesNeedsReload} onReload={reload} />
        ) : preferencesStatus === "failed" ? (
          <button type="button" onClick={reload}
            className={`cursor-pointer rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 ${focusStyle}`}>
            Try loading settings again
          </button>
        ) : (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
            Loading notification settings…
          </p>
        )}
      </main>
    </>
  );
}

export default NotificationPreferencesPage;
