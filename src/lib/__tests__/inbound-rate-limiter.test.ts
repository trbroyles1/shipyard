import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function cleanupGlobalState() {
  const apiKey = Symbol.for("shipyard.inboundRateLimiter.api");
  const authKey = Symbol.for("shipyard.inboundRateLimiter.auth");
  const g = globalThis as Record<symbol, unknown>;

  // Clear interval handles before deleting state to prevent leaks
  for (const key of [apiKey, authKey]) {
    const state = g[key] as
      | { intervalHandle: ReturnType<typeof setInterval> | null }
      | undefined;
    if (state?.intervalHandle) {
      clearInterval(state.intervalHandle);
    }
    delete g[key];
  }
}

describe("inbound-rate-limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    cleanupGlobalState();
  });

  afterEach(() => {
    cleanupGlobalState();
    vi.useRealTimers();
  });

  async function loadModule() {
    return await import("@/lib/inbound-rate-limiter");
  }

  describe("apiRateLimiter (120 req / 60s)", () => {
    it("allows 120 requests within the window", async () => {
      const { apiRateLimiter } = await loadModule();

      for (let i = 0; i < 120; i++) {
        expect(apiRateLimiter.check("1.2.3.4")).toBe(true);
      }
    });

    it("denies the 121st request", async () => {
      const { apiRateLimiter } = await loadModule();

      for (let i = 0; i < 120; i++) {
        apiRateLimiter.check("1.2.3.4");
      }

      expect(apiRateLimiter.check("1.2.3.4")).toBe(false);
    });

    it("tracks different IPs independently", async () => {
      const { apiRateLimiter } = await loadModule();

      for (let i = 0; i < 120; i++) {
        apiRateLimiter.check("1.2.3.4");
      }

      // First IP is exhausted
      expect(apiRateLimiter.check("1.2.3.4")).toBe(false);

      // Different IP should still be allowed
      expect(apiRateLimiter.check("5.6.7.8")).toBe(true);
    });

    it("resets the window after 60s", async () => {
      const { apiRateLimiter } = await loadModule();

      for (let i = 0; i < 120; i++) {
        apiRateLimiter.check("1.2.3.4");
      }

      expect(apiRateLimiter.check("1.2.3.4")).toBe(false);

      vi.advanceTimersByTime(60_000);

      expect(apiRateLimiter.check("1.2.3.4")).toBe(true);
    });
  });

  describe("authRateLimiter (60 req / 60s)", () => {
    it("allows 60 requests within the window", async () => {
      const { authRateLimiter } = await loadModule();

      for (let i = 0; i < 60; i++) {
        expect(authRateLimiter.check("10.0.0.1")).toBe(true);
      }
    });

    it("denies the 61st request", async () => {
      const { authRateLimiter } = await loadModule();

      for (let i = 0; i < 60; i++) {
        authRateLimiter.check("10.0.0.1");
      }

      expect(authRateLimiter.check("10.0.0.1")).toBe(false);
    });
  });

  describe("checkInboundRateLimit (deprecated)", () => {
    it("delegates to apiRateLimiter with the same 120-request limit", async () => {
      const { checkInboundRateLimit } = await loadModule();

      for (let i = 0; i < 120; i++) {
        expect(checkInboundRateLimit("192.168.1.1")).toBe(true);
      }

      expect(checkInboundRateLimit("192.168.1.1")).toBe(false);
    });
  });
});
