type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

function getConfiguredLevel(): LogLevel {
  const raw = (typeof process !== "undefined" ? process.env?.LOG_LEVEL : null) || "INFO";
  return raw in LEVELS ? (raw as LogLevel) : "INFO";
}

function timestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[getConfiguredLevel()];
}

const isServer = typeof window === "undefined";

function formatMessage(level: LogLevel, module: string, message: string): string {
  return `[${level}] [${timestamp()}] [${module}] ${message}`;
}

export function createLogger(module: string) {
  return {
    debug(message: string, ...args: unknown[]) {
      if (!shouldLog("DEBUG")) return;
      if (isServer) {
        process.stdout.write(formatMessage("DEBUG", module, message) + "\n");
      } else {
        console.debug(formatMessage("DEBUG", module, message), ...args);
      }
    },
    info(message: string, ...args: unknown[]) {
      if (!shouldLog("INFO")) return;
      if (isServer) {
        process.stdout.write(formatMessage("INFO", module, message) + "\n");
      } else {
        console.info(formatMessage("INFO", module, message), ...args);
      }
    },
    warn(message: string, ...args: unknown[]) {
      if (!shouldLog("WARN")) return;
      if (isServer) {
        process.stdout.write(formatMessage("WARN", module, message) + "\n");
      } else {
        console.warn(formatMessage("WARN", module, message), ...args);
      }
    },
    error(message: string, ...args: unknown[]) {
      if (!shouldLog("ERROR")) return;
      if (isServer) {
        process.stderr.write(formatMessage("ERROR", module, message) + "\n");
      } else {
        console.error(formatMessage("ERROR", module, message), ...args);
      }
    },
  };
}
