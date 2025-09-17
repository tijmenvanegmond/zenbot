import * as fs from "fs";
import * as path from "path";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private logFilePath: string;

  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFilePath = path.join(logsDir, `zenbot-${timestamp}.log`);
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private log(
    level: LogLevel,
    prefix: string,
    message: string,
    ...args: any[]
  ) {
    if (level >= this.level) {
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] 🧘 ${prefix} ${message} ${args.length > 0 ? JSON.stringify(args) : ""}`;

      // Log to console
      console.log(`[${timestamp}] 🧘 ${prefix}`, message, ...args);

      // Log to file
      try {
        fs.appendFileSync(this.logFilePath, logLine + "\n");
      } catch (error) {
        console.error("Failed to write to log file:", error);
      }
    }
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  debug(message: string, ...args: any[]) {
    this.log(LogLevel.DEBUG, "[DEBUG]", message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log(LogLevel.INFO, "[INFO]", message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log(LogLevel.WARN, "[WARN]", message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log(LogLevel.ERROR, "[ERROR]", message, ...args);
  }
}

export const logger = new Logger();

// Set log level based on environment - Experience tranquility through proper logging
if (process.env.LOG_LEVEL === "DEBUG") {
  logger.setLevel(LogLevel.DEBUG);
}
