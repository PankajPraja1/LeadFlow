// Local operator check. Preview is the default; --send explicitly requests one
// real digest through the same permission checks and delivery ledger as cron.
const { eligibleRecipient, clientOrigin, localDayWindow } = require("../src/utils/dailyDigest");

const checkError = (message) => Object.assign(new Error(message), { code: "DIGEST_CHECK" });

function parseDigestCheckArguments(argumentsList) {
  if (argumentsList.length === 1 && argumentsList[0] === "--help") return { help: true };

  const options = { send: false };
  const seen = new Set();

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (!["--email", "--database", "--send"].includes(argument) || seen.has(argument)) {
      throw checkError("Use --email, --database and optionally --send once each. There is no force-send option.");
    }

    seen.add(argument);
    if (argument === "--send") { options.send = true; continue; }
    const value = argumentsList[++index];

    if (typeof value !== "string" || !value.trim() || value.startsWith("--")) {
      throw checkError(`Provide a value after ${argument}.`);
    }
    options[argument.slice(2)] = value.trim();
  }

  if (typeof options.email !== "string" || options.email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(options.email)) {
    throw checkError("Provide --email with an account email you own.");
  }

  if (typeof options.database !== "string" || !/^[a-zA-Z0-9_-]{1,63}$/.test(options.database)) {
    throw checkError("Provide --database with the expected database name.");
  }

  options.email = options.email.toLowerCase();
  return options;
}

function assertDigestCheckEnvironment(environment) {
  if (environment.VERCEL || environment.VERCEL_ENV) {
    throw checkError("Run this check from your local backend terminal.");
  }

  if (environment.DAILY_DIGEST_ENABLED !== "false") {
    throw checkError("Keep DAILY_DIGEST_ENABLED=false while running this controlled check.");
  }

  if (!environment.MONGODB_URI) throw checkError("MONGODB_URI is missing.");
}

function singleRecipientSender(email, sendEmail) {
  return async (message) => {
    if (typeof message?.to !== "string" || message.to.toLowerCase() !== email) {
      throw checkError("The account email changed. No email was sent by this check.");
    }

    return sendEmail(message);
  };
}

async function main() {
  const options = parseDigestCheckArguments(process.argv.slice(2));

  if (options.help) {
    console.log("Preview: node scripts/checkDailyDigest.cjs --email you@example.com --database leadflow");
    console.log("Send one: add --send after reviewing the preview. Keep DAILY_DIGEST_ENABLED=false.");

    return;
  }

  require("dotenv").config({ quiet: true });
  assertDigestCheckEnvironment(process.env);
  const origin = clientOrigin(process.env.CLIENT_URL);

  if (options.send && (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD)) {
    throw checkError("Email configuration is missing.");
  }

  // Prevent automatic model initialization while producing a read-only preview.
  const mongoose = require("mongoose");
  mongoose.set("autoCreate", false);
  mongoose.set("autoIndex", false);
  const User = require("../src/models/User");
  const DigestDelivery = require("../src/models/DigestDelivery");
  const { createDailyDigestRepository } = require("../src/services/dailyDigestRepository");
  const { createDailyDigestRunner } = require("../src/services/dailyDigestRunner");

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, autoCreate: false, autoIndex: false,
    });
    // Verify the configured database; never redirect the URI into a named database.
    const database = mongoose.connection.db.databaseName;
    if (database !== options.database) {
      throw checkError("The connected database does not match --database. Check your backend configuration.");
    }

    const user = await User.findOne({ email: options.email }).select("_id").maxTimeMS(8000).lean();

    if (!user) throw checkError("No account with that email exists in this database.");

    const repository = createDailyDigestRepository({ recipientId: user._id });
    const context = await repository.context(user._id);

    if (!eligibleRecipient(context) || context.user.email.toLowerCase() !== options.email) {
      throw checkError("Use an active, verified account with daily email summaries enabled in Notification settings.");
    }

    const now = new Date();
    const runDay = now.toISOString().slice(0, 10);
    const window = localDayWindow(now, context.preferences.timeZone);
    const summary = await repository.summary(context.user, window);

    const readDelivery = (day = runDay) =>
      DigestDelivery.findOne({ recipient: user._id, runDay: day }).select("status reason leaseUntil").maxTimeMS(8000).lean();

    const existing = await readDelivery();
    const notAlreadyAttempted = !existing || (existing.status === "claimed" && existing.leaseUntil && existing.leaseUntil <= now);
    const pendingCount = summary.overdue.total + summary.today.total;

    const preview = {
      mode: options.send ? "single-account send" : "preview only",
      database, recipient: options.email, timeZone: window.timeZone,
      localDate: window.localDate, runDay,
      overdue: summary.overdue.total, dueToday: summary.today.total,
      deliveryStatus: existing?.status ?? "not_attempted",
      canAttemptToday: Boolean(pendingCount > 0 && notAlreadyAttempted),
    };

    console.log(JSON.stringify(preview, null, 2));
    if (!options.send) {
      console.log("PREVIEW ONLY: no email sent and no delivery record changed");
      return;
    }
    if (!pendingCount) {
      console.log("No eligible tasks. Create a dated pending task for today, then preview again.");
      return;
    }
    if (!notAlreadyAttempted) {
      console.log("NO NEW EMAIL: this account already has a delivery record or an active claim for this UTC date.");
      return;
    }

    const actualSender = require("../src/utils/sendEmail");
    const sendEmail = singleRecipientSender(options.email, async (message) => {
      try { return await actualSender(message); }
      catch (error) {
        const known = ["EAUTH", "ETIMEDOUT", "ESOCKET", "ECONNECTION", "EENVELOPE", "EMESSAGE", "EMAIL_CONFIG_MISSING"];
        console.error("Email provider error:", known.includes(error.code) ? error.code : "UNCONFIRMED");
        throw error;
      }
    });

    const run = createDailyDigestRunner({ repository, sendEmail });
    const result = await run({ origin });
    const delivery = await readDelivery(result.runDay);

    console.log(JSON.stringify({
      ...result, deliveryStatus: delivery?.status ?? "not_attempted",
      reason: delivery?.reason ?? null
    }, null, 2));

    if (result.sent === 1) {
      console.log("ONE DIGEST ACCEPTED BY THE EMAIL PROVIDER: check your inbox and spam folder");
    } else if (result.uncertain || result.unconfirmed || result.failed || result.hasMore || result.activeClaims) {
      console.log("Delivery was not confirmed. Keep the delivery record and share this result before trying again.");
      process.exitCode = 1;
    } else {
      console.log("NO NEW EMAIL: the account, its tasks, or delivery state changed during the check.");
    }

  } finally { await mongoose.disconnect(); }
}

module.exports = { parseDigestCheckArguments, assertDigestCheckEnvironment, singleRecipientSender };

if (require.main === module) {
  main().catch((error) => {
    const expected = ["DIGEST_CHECK", "DIGEST_CONFIGURATION", "DIGEST_TIME_ZONE", "DIGEST_SCOPE"];

    console.error("Digest check stopped:", expected.includes(error.code) ? error.message : `${error.name}; check the backend configuration and connection`);

    process.exitCode = 1;
  });
}
