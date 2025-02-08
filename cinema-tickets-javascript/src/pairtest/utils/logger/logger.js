import winston from "winston";

// Create a Winston logger
const logger = winston.createLogger({
  level: "info", // Default Log Level
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(), 
    // Logging to files to simulate real-world error tracking via persistent storage
    new winston.transports.File({ filename: "error.log", level: "error" }), 

    // This transport logs both "warn" and "error" messages to warnings.log
    new winston.transports.File({ filename: "warnings.log", level: "warn" }) 
  ],
});

export default logger;
