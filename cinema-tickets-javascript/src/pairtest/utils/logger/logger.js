import winston from "winston";
import path from "path";

const logDirectory = path.join(process.cwd(), "logs");

// Disable logging in test environment.
const isTestEnv = process.env.NODE_ENV === "test";

// Create a Winston logger
const logger = winston.createLogger({
  level: isTestEnv ? "silent" : "info", // Disable logs in test mode
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: isTestEnv
    ? [new winston.transports.Stream({ stream: new (require("stream").Writable)(), level: "silent" })]
    : [
      new winston.transports.Console(),
      // Logging to files to simulate real-world error tracking via tools / persistent storage
      new winston.transports.File({ filename: path.join(logDirectory, "error.log"), level: "error" }),

      new winston.transports.File({ filename: path.join(logDirectory, "info.log"), level: "info" }),

      // This transport logs both "warn" and "error" messages to warnings.log
      new winston.transports.File({ filename: path.join(logDirectory, "warnings.log"), level: "warn" }),
    ],
});

export default logger;
