const express = require("express");
const connectDB = require("../config/db");
const { runDailyDigests } = require("../services/dailyDigestService");
const { checkCronAuthorization, clientOrigin, digestError } = require("../utils/dailyDigest");

function createDailyDigestRouter({ run = runDailyDigests, connect = connectDB, environment = process.env, report = (value) => console.log("Daily digest:", value) } = {}) {

  const router = express.Router();
  router.all("/daily-digest", async (req, res) => {
    res.set("Cache-Control", "no-store");

    // Express routes GET handlers for HEAD too. Explicitly prevent HEAD sends.
    if (req.method !== "GET") {
      res.set("Allow", "GET");
      return res.status(405).json({ success: false, message: "Use GET for this endpoint" });
    }

    try {
      if (!checkCronAuthorization(req.headers.authorization, environment.CRON_SECRET)) {
        return res.status(401).json({ success: false, message: "Scheduler authentication required" });
      }
      if (Object.keys(req.query).length || (req.body !== undefined && (req.body === null || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length))) {
        return res.status(400).json({ success: false, message: "This endpoint accepts no parameters" });
      }
      if (environment.DAILY_DIGEST_ENABLED !== "true") {
        return res.json({ success: true, enabled: false });
      }
      // Preview deployments must never send to the shared production database.
      if (environment.VERCEL_ENV && environment.VERCEL_ENV !== "production") {
        return res.json({ success: true, enabled: false, reason: "non-production deployment" });
      }

      // Local tests use the injected fake sender. Real delivery is configured
      // explicitly later; credentials never appear in HTTP results or logs.
      const origin = clientOrigin(environment.CLIENT_URL);
      if (!environment.EMAIL_USER || !environment.EMAIL_APP_PASSWORD) {
        throw digestError("Email configuration is missing");
      }

      await connect();
      const result = await run({ origin });

      const complete = !result.hasMore && result.failed === 0 && result.uncertain === 0 && result.unconfirmed === 0 && result.activeClaims === 0;
      report({ ...result, complete });

      return res.status(complete ? 200 : 503).json({ success: complete, enabled: true, ...result });
    } catch (error) {
      // Do not log the SMTP error object: it can contain recipient/message data.
      const code = error.code === "DIGEST_CONFIGURATION" ? "DIGEST_CONFIGURATION" : "DIGEST_RUN_FAILED";
      report({ code });

      return res.status(503).json({
        success: false, code,
        message: "Daily summary processing is unavailable. Review the backend configuration and logs.",
      });
    }
  });
  return router;
}

module.exports = createDailyDigestRouter();
module.exports.createDailyDigestRouter = createDailyDigestRouter;
