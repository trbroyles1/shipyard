/**
 * Per-IP inbound rate limiter for API routes.
 *
 * State is attached to globalThis via Symbol.for() so that the Map and
 * cleanup interval survive HMR module re-evaluation in development.
 * Without this, each hot reload leaks an interval and loses existing
 * window entries.
 */

import { createLogger } from "./logger";

const log = createLogger("inbound-rate-limiter");

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface WindowEntry {
  count: number;
  windowStart: number;
}

interface RateLimiterState {
  ipWindows: Map<string, WindowEntry>;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

const GLOBAL_KEY = Symbol.for("shipyard.inboundRateLimiter");

function getState(): RateLimiterState {
  const g = globalThis as Record<symbol, RateLimiterState | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { ipWindows: new Map(), intervalHandle: null };
  }
  return g[GLOBAL_KEY];
}

/** Returns true if the request is allowed, false if rate-limited. */
export function checkInboundRateLimit(ip: string): boolean {
  const { ipWindows } = getState();
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

// Periodic cleanup of stale entries — only create the interval once
if (typeof setInterval !== "undefined") {
  const state = getState();
  if (!state.intervalHandle) {
    state.intervalHandle = setInterval(() => {
      const { ipWindows } = getState();
      const now = Date.now();
      ipWindows.forEach((entry, ip) => {
        if (now - entry.windowStart >= WINDOW_MS) {
          ipWindows.delete(ip);
        }
      });
    }, CLEANUP_INTERVAL_MS);
    state.intervalHandle.unref?.();
  }
}
