const express = require("express");
const cors = require("cors");
// Import routes
const authRoutes = require("./routes/authRoutes");
// Import lead routes
const leadRoutes = require("./routes/leadRoutes");
// Import dashboard routes
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LeadFlow Pro API is running",
  });
});

// Use routes
app.use("/api/auth", authRoutes);
// Use lead routes
app.use("/api/leads", leadRoutes);
// Use dashboard routes
app.use("/api/dashboard", dashboardRoutes);

module.exports = app;