const service = require("../services/notificationService");

const handle = (operation) => async (req, res) => {
  try {
    const result = await operation({
      user: req.user,
      query: req.query,
      body: req.body,
      id: req.params.id,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    let status = error.statusCode;
    let message = error.message;

    if (![400, 401, 403, 404, 409, 503].includes(status)) {
      console.error("Notification request failed:", { name: error.name, code: error.code });
      status = 500;
      message = "Unable to process the notification request";
    }
    
    return res.status(status).json({ success: false, message });
  }
};

module.exports = {
  syncNotifications: handle(service.syncNotifications),
  listNotifications: handle(service.listNotifications),
  setNotificationRead: handle(service.setNotificationRead),
};
