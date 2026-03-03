/**
 * Per-IP inbound rate limiter factory for API routes.
 *
 * State is attached to globalThis via Symbol.for() so that each limiter
 * instance's Map and cleanup interval survive HMR module re-evaluation in
 * development. Without this, each hot reload leaks an interval and loses
 * existing window entries.
 *
 * Use `createInboundRateLimiter()` to produce named, independently-configured
 * limiter instances. Two pre-built instances are exported: `apiRateLimiter`
 * for general API routes and `authRateLimiter` for auth endpoints.
 */

import { createLogger } from "./logger";

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const API_RATE_LIMIT_WINDOW_MS = 60_000;
const API_RATE_LIMIT_MAX_REQUESTS = 120;
const AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
const AUTH_RATE_LIMIT_MAX_REQUESTS = 60;

interface WindowEntry {
  count: number;
  windowStart: number;
}

interface RateLimiterState {
  ipWindows: Map<string, WindowEntry>;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

interface RateLimiterConfig {
  name: string;
  windowMs: number;
  maxRequests: number;
}

export interface InboundRateLimiter {
  check(ip: string): boolean;
}

function createInboundRateLimiter(config: RateLimiterConfig): InboundRateLimiter {
  const log = createLogger(`inbound-rate-limiter:${config.name}`);
  const globalKey = Symbol.for(`shipyard.inboundRateLimiter.${config.name}`);

  function getState(): RateLimiterState {
    const g = globalThis as Record<symbol, RateLimiterState | undefined>;
    if (!g[globalKey]) {
      g[globalKey] = { ipWindows: new Map(), intervalHandle: null };
    }
    return g[globalKey];
  }

  if (typeof setInterval !== "undefined") {
    const state = getState();
    if (!state.intervalHandle) {
      state.intervalHandle = setInterval(() => {
        const { ipWindows } = getState();
        const now = Date.now();
        ipWindows.forEach((entry, ip) => {
          if (now - entry.windowStart >= config.windowMs) {
            ipWindows.delete(ip);
          }
        });
      }, CLEANUP_INTERVAL_MS);
      state.intervalHandle.unref?.();
    }
  }

  return {
    check(ip: string): boolean {
      const { ipWindows } = getState();
      const now = Date.now();
      const entry = ipWindows.get(ip);

      if (!entry || now - entry.windowStart >= config.windowMs) {
        ipWindows.set(ip, { count: 1, windowStart: now });
        return true;
      }

      entry.count++;
      if (entry.count > config.maxRequests) {
        log.warn(`Rate limit exceeded for IP ${ip}: ${entry.count} requests in window`);
        return false;
      }

      return true;
    },
  };
}

export const apiRateLimiter = createInboundRateLimiter({
  name: "api",
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  maxRequests: API_RATE_LIMIT_MAX_REQUESTS,
});

export const authRateLimiter = createInboundRateLimiter({
  name: "auth",
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  maxRequests: AUTH_RATE_LIMIT_MAX_REQUESTS,
});

/** @deprecated Use apiRateLimiter.check() directly. */
export function checkInboundRateLimit(ip: string): boolean {
  return apiRateLimiter.check(ip);
}
