const express = require("express");
const { protect } = require("../middleware/authMiddleware");

const { getPreferences, updatePreferences, } = require("../controllers/notificationPreferenceController");

const { syncNotifications, listNotifications, setNotificationRead, } = require("../controllers/notificationController");

const router = express.Router();

router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

router.use(protect);

router.route("/preferences")
    .get(getPreferences)
    .patch(updatePreferences);

router.post("/sync", syncNotifications);
router.get("/", listNotifications);
router.patch("/:id/read", setNotificationRead);

module.exports = router;
