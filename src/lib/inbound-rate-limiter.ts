import { createLogger } from "./logger";

const log = createLogger("inbound-rate-limiter");

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface WindowEntry {
  count: number;
  windowStart: number;
}

const ipWindows = new Map<string, WindowEntry>();

/** Returns true if the request is allowed, false if rate-limited. */
export function checkInboundRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipWindows.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    ipWindows.set(ip, { count: 1, windowStart: now });
    return true;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    log.warn(`Rate limit exceeded for IP ${ip}: ${entry.count} requests in window`);
    return false;
  }

  return true;
}

// Periodic cleanup of stale entries
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    ipWindows.forEach((entry, ip) => {
      if (now - entry.windowStart >= WINDOW_MS) {
        ipWindows.delete(ip);
      }
    });
  }, CLEANUP_INTERVAL_MS).unref?.();
}
