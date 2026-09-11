const mongoose = require("mongoose");

let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      })
      .then((mongooseInstance) => {
        console.log(
          `MongoDB connected: ${mongooseInstance.connection.host}`
        );

        return mongooseInstance.connection;
      })
      .finally(() => {
        connectionPromise = null;
      });
  }

  return connectionPromise;
};

module.exports = connectDB;