require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const requiredEnvironmentVariables = [
  "MONGODB_URI",
  "JWT_SECRET",
];

const missingVariables = requiredEnvironmentVariables.filter(
  (variable) => !process.env[variable]
);

if (missingVariables.length > 0) {
  console.error(
    `Missing environment variables: ${missingVariables.join(", ")}`
  );

  process.exit(1);
}

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();