const { performance } = require("node:perf_hooks");
const {
  clientOrigin, localDayWindow, eligibleRecipient, recipientFingerprint,
  buildDigestEmail, smtpAccepted,
} = require("../utils/dailyDigest");

const MAX_RECIPIENTS = 50;
const CONCURRENCY = 2;
const START_BUDGET_MS = 120000;

// Dependencies are explicit so orchestration tests never contact SMTP or Atlas.
function createDailyDigestRunner({ repository, sendEmail, clock = () => new Date(), monotonic = () => performance.now() }) {
  return async function runDailyDigests({ origin }) {
    const base = clientOrigin(origin);
    const runAt = clock();
    const runDay = runAt.toISOString().slice(0, 10);
    const started = monotonic();
    const withinBudget = () => monotonic() - started < START_BUDGET_MS && clock().toISOString().slice(0, 10) === runDay;
    await repository.prepare();
    const candidates = await repository.candidates({ runDay, now: clock(), limit: MAX_RECIPIENTS });
    const counts = { processed: 0, sent: 0, skipped: 0, uncertain: 0, failed: 0, busy: 0 };

    async function processRecipient(recipient) {
      let claim;
      let sending = false;

      try {
        claim = await repository.claim({ recipient, runDay, now: clock() });

        if (!claim) return "busy";
        const context = await repository.context(recipient);

        if (!eligibleRecipient(context)) {
          await repository.skip(claim, "NOT_ELIGIBLE", clock());
          return "skipped";
        }

        const window = localDayWindow(runAt, context.preferences.timeZone);
        const summary = await repository.summary(context.user, window);

        if (summary.overdue.total + summary.today.total === 0) {
          await repository.skip(claim, "NO_TASKS", clock());
          return "skipped";
        }
        // Recheck current account/email and opt-in after reading the task data.
        const latest = await repository.context(recipient);
        if (!eligibleRecipient(latest) ||
          recipientFingerprint(latest) !== recipientFingerprint(context)) {
          await repository.skip(claim, "SETTINGS_CHANGED", clock());
          return "skipped";
        }

        if (!withinBudget()) {
          await repository.release(claim);
          return "busy";
        }

        const message = buildDigestEmail({ user: latest.user, summary, window, origin: base });
        // Only the holder of a live claim may start the external side effect.
        // A 'sending' record is NEVER reclaimed, even after a crash or timeout.
        if (!await repository.beginSend(claim, window, clock())) return "busy";
        sending = true;
        const info = await sendEmail(message);

        if (!smtpAccepted(info, message.to)) throw new Error("SMTP did not confirm acceptance");
        await repository.finish(claim, "sent", clock());

        return "sent";
      } catch {
        if (sending) {
          // SMTP may already have accepted the email. Do not retry it blindly.
          try { await repository.finish(claim, "uncertain", clock()); } catch { /* Keep 'sending'. */ }

          return "uncertain";
        }

        if (claim) {
          // Safe only before beginSend committed. The repository filters status.
          try { await repository.release(claim); } catch { /* The claim can expire. */ }
        }
        return "failed";
      }
    }

    let offset = 0;
    async function worker() {
      while (withinBudget() && offset < candidates.length) {
        const recipient = candidates[offset++];
        const outcome = await processRecipient(recipient);
        counts.processed += 1;
        counts[outcome] += 1;
      }
    }
    // Await every send; there is no fire-and-forget work after the HTTP response.
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    const remaining = await repository.candidates({ runDay, now: clock(), limit: 1 });
    const deliveryStates = await repository.states(runDay);
    return {
      runDay, ...counts, hasMore: remaining.length > 0,
      unconfirmed: deliveryStates.unconfirmed,
      activeClaims: deliveryStates.activeClaims,
    };
  };
}

module.exports = { createDailyDigestRunner };
