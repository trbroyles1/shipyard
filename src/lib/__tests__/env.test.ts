import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createMockLogger } from "@/lib/__tests__/test-utils";

const mockLogger = createMockLogger();

vi.mock("@/lib/logger", () => ({
  createLogger: () => mockLogger,
}));

describe("env", () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    vi.resetModules();
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  async function loadEnv() {
    const mod = await import("@/lib/env");
    return mod.env;
  }

  describe("required variables", () => {
    const requiredVars = [
      "AUTH_SECRET",
      "AUTH_GITLAB_ID",
      "AUTH_GITLAB_SECRET",
      "GITLAB_GROUP_ID",
    ] as const;

    for (const varName of requiredVars) {
      it(`returns value when ${varName} is set`, async () => {
        process.env[varName] = "test-value";
        const env = await loadEnv();
        expect(env[varName]).toBe("test-value");
      });

      it(`throws when ${varName} is missing`, async () => {
        delete process.env[varName];
        const env = await loadEnv();
        expect(() => env[varName]).toThrow(varName);
      });

      it(`throws when ${varName} is empty string`, async () => {
        process.env[varName] = "";
        const env = await loadEnv();
        expect(() => env[varName]).toThrow(varName);
      });
    }
  });

  describe("LOG_LEVEL (optional with default)", () => {
    it("returns the set value", async () => {
      process.env.LOG_LEVEL = "DEBUG";
      const env = await loadEnv();
      expect(env.LOG_LEVEL).toBe("DEBUG");
    });

    it('defaults to "INFO" when not set', async () => {
      delete process.env.LOG_LEVEL;
      const env = await loadEnv();
      expect(env.LOG_LEVEL).toBe("INFO");
    });
  });

  describe("MR_POLL_INTERVAL (optionalPositiveInt, default 25)", () => {
    it("returns parsed value for valid positive integer", async () => {
      process.env.MR_POLL_INTERVAL = "30";
      const env = await loadEnv();
      expect(env.MR_POLL_INTERVAL).toBe(30);
    });

    it("returns default when not set", async () => {
      delete process.env.MR_POLL_INTERVAL;
      const env = await loadEnv();
      expect(env.MR_POLL_INTERVAL).toBe(25);
    });

    it('returns default and warns for "0"', async () => {
      process.env.MR_POLL_INTERVAL = "0";
      const env = await loadEnv();
      expect(env.MR_POLL_INTERVAL).toBe(25);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("MR_POLL_INTERVAL"),
      );
    });

    it('returns default and warns for "-5"', async () => {
      process.env.MR_POLL_INTERVAL = "-5";
      const env = await loadEnv();
      expect(env.MR_POLL_INTERVAL).toBe(25);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns default and warns for "fast"', async () => {
      process.env.MR_POLL_INTERVAL = "fast";
      const env = await loadEnv();
      expect(env.MR_POLL_INTERVAL).toBe(25);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns default and warns for "25.5"', async () => {
      process.env.MR_POLL_INTERVAL = "25.5";
      const env = await loadEnv();
      expect(env.MR_POLL_INTERVAL).toBe(25);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns default and warns for "025" (leading zero)', async () => {
      process.env.MR_POLL_INTERVAL = "025";
      const env = await loadEnv();
      expect(env.MR_POLL_INTERVAL).toBe(25);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe("GITLAB_URL (optionalWithWarning, default https://gitlab.com)", () => {
    it("returns the set value without warning", async () => {
      process.env.GITLAB_URL = "https://my-gitlab.example.com";
      const env = await loadEnv();
      expect(env.GITLAB_URL).toBe("https://my-gitlab.example.com");
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("returns default and warns on first access when not set", async () => {
      delete process.env.GITLAB_URL;
      const env = await loadEnv();
      expect(env.GITLAB_URL).toBe("https://gitlab.com");
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("GITLAB_URL"),
      );
    });

    it("warns only once across multiple accesses", async () => {
      delete process.env.GITLAB_URL;
      const env = await loadEnv();
      void env.GITLAB_URL;
      void env.GITLAB_URL;
      void env.GITLAB_URL;
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
