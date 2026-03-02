import { createLogger } from "./logger";

const log = createLogger("env");

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

const DEFAULT_MR_POLL_INTERVAL = 25;

function optionalPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== raw) {
    log.warn(
      `${name} must be a positive integer — got "${raw}", defaulting to ${fallback}`,
    );
    return fallback;
  }
  return parsed;
}

function optionalWithWarning(name: string, fallback: string, message: string): string {
  const value = process.env[name];
  if (value) return value;
  if (!optionalWithWarning._warned.has(name)) {
    optionalWithWarning._warned.add(name);
    log.warn(message);
  }
  return fallback;
}
optionalWithWarning._warned = new Set<string>();

/** Typed environment variable access. All values are resolved lazily via getters. */
export const env = {
  get AUTH_SECRET() {
    return required("AUTH_SECRET");
  },
  get AUTH_GITLAB_ID() {
    return required("AUTH_GITLAB_ID");
  },
  get AUTH_GITLAB_SECRET() {
    return required("AUTH_GITLAB_SECRET");
  },
  get GITLAB_URL() {
    return optionalWithWarning(
      "GITLAB_URL",
      "https://gitlab.com",
      "GITLAB_URL is not set — defaulting to https://gitlab.com",
    );
  },
  get GITLAB_GROUP_ID() {
    return required("GITLAB_GROUP_ID");
  },
  get LOG_LEVEL() {
    return optional("LOG_LEVEL", "INFO") as "DEBUG" | "INFO" | "WARN" | "ERROR";
  },
  get MR_POLL_INTERVAL(): number {
    return optionalPositiveInt("MR_POLL_INTERVAL", DEFAULT_MR_POLL_INTERVAL);
  },
};
