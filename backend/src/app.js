const express = require("express");
const cors = require("cors");
// Import the connectDB function to establish a connection to MongoDB
const connectDB = require("./config/db");
// Import routes
const authRoutes = require("./routes/authRoutes");
// Import lead routes
const leadRoutes = require("./routes/leadRoutes");
// Import dashboard routes
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
}));
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LeadFlow API is running",
  });
});

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error(
      `Database connection error: ${error.message}`
    );

    res.status(503).json({
      success: false,
      message: "Database service is temporarily unavailable",
    });
  }
});

// Use routes
app.use("/api/auth", authRoutes);
// Use lead routes
app.use("/api/leads", leadRoutes);
// Use dashboard routes
app.use("/api/dashboard", dashboardRoutes);

module.exports = app;