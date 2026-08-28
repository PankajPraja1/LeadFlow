const Lead = require("../models/Lead");

const getDashboardStats = async (req, res) => {
  try {
    const baseFilter = {};

    const hasTeamAccess = ["admin", "leader"].includes(
      req.user.systemRole
    );

    if (!hasTeamAccess) {
      baseFilter.assignedTo = req.user._id;
    }

    const activeFollowUpFilter = {
      ...baseFilter,
      status: {
        $nin: ["converted", "lost"],
      },
    };

    const now = new Date();

    const nextSevenDays = new Date();
    nextSevenDays.setDate(nextSevenDays.getDate() + 7);

    const [
      total,
      newLeads,
      contacted,
      qualified,
      converted,
      lost,
      overdueFollowUps,
      upcomingFollowUps,
    ] = await Promise.all([
      Lead.countDocuments(baseFilter),

      Lead.countDocuments({
        ...baseFilter,
        status: "new",
      }),

      Lead.countDocuments({
        ...baseFilter,
        status: "contacted",
      }),

      Lead.countDocuments({
        ...baseFilter,
        status: "qualified",
      }),

      Lead.countDocuments({
        ...baseFilter,
        status: "converted",
      }),

      Lead.countDocuments({
        ...baseFilter,
        status: "lost",
      }),

      Lead.countDocuments({
        ...activeFollowUpFilter,
        nextFollowUp: {
          $lt: now,
        },
      }),

      Lead.countDocuments({
        ...activeFollowUpFilter,
        nextFollowUp: {
          $gte: now,
          $lte: nextSevenDays,
        },
      }),
    ]);

    const conversionRate =
      total === 0
        ? 0
        : Number(((converted / total) * 100).toFixed(1));

    return res.status(200).json({
      success: true,
      stats: {
        total,
        new: newLeads,
        contacted,
        qualified,
        converted,
        lost,
        conversionRate,
        overdueFollowUps,
        upcomingFollowUps,
      },
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve dashboard statistics",
    });
  }
};

module.exports = {
  getDashboardStats,
};