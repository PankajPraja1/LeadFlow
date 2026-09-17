const sendEmail = require("../utils/sendEmail");
const { createDailyDigestRepository } = require("./dailyDigestRepository");
const { createDailyDigestRunner } = require("./dailyDigestRunner");

const runDailyDigests = createDailyDigestRunner({
  repository: createDailyDigestRepository(), sendEmail,
});

module.exports = { runDailyDigests };
