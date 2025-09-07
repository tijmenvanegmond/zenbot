export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

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
      console.log(`[${timestamp}] 🧘 ${prefix}`, message, ...args);
    }
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
