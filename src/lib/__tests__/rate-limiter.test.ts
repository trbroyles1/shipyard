import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const mockLoggers: Array<{ warn: ReturnType<typeof vi.fn> }> = [];

vi.mock("@/lib/logger", () => ({
  createLogger: () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockLoggers.push(logger);
    return logger;
  },
}));

describe("rate-limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    mockLoggers.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function loadModule() {
    return await import("@/lib/rate-limiter");
  }

  function getWarnMock() {
    return mockLoggers[mockLoggers.length - 1].warn;
  }

  it("resolves immediately when tokens are available", async () => {
    const { acquire } = await loadModule();
    await acquire();
  });

  it("delays when all 2000 tokens are consumed", async () => {
    const { acquire } = await loadModule();

    for (let i = 0; i < 2000; i++) {
      await acquire();
    }

    let resolved = false;
    const promise = acquire().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    vi.advanceTimersByTime(60_000);
    await promise;

    expect(resolved).toBe(true);
  });

  it("fully refills tokens after REFILL_INTERVAL_MS (60s)", async () => {
    const { acquire } = await loadModule();

    for (let i = 0; i < 2000; i++) {
      await acquire();
    }

    vi.advanceTimersByTime(60_000);

    await acquire();
  });

  it("partially refills tokens proportionally over time", async () => {
    const { acquire } = await loadModule();

    for (let i = 0; i < 2000; i++) {
      await acquire();
    }

    vi.advanceTimersByTime(30_000);

    for (let i = 0; i < 1000; i++) {
      await acquire();
    }
  });

  it("logs a warning at 80% utilization", async () => {
    const { acquire } = await loadModule();
    const warn = getWarnMock();

    // The utilization check runs before the token decrement, so after 1600
    // calls tokens = 400 (utilization 0.8). The 1601st call sees that value
    // and triggers the warning.
    for (let i = 0; i < 1601; i++) {
      await acquire();
    }

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("utilization")
    );
  });

  it("does not log a warning below 80% utilization", async () => {
    const { acquire } = await loadModule();
    const warn = getWarnMock();

    for (let i = 0; i < 10; i++) {
      await acquire();
    }

    expect(warn).not.toHaveBeenCalled();
  });
});
