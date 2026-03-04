import { describe, it, expect } from "vitest";
import {
  GitLabApiError,
  TRANSIENT_STATUSES,
  AUTH_FAILURE_STATUSES,
  isTransientError,
  isAuthError,
} from "@/lib/errors";

describe("GitLabApiError", () => {
  it("constructs with correct properties", () => {
    const err = new GitLabApiError(404, "Not Found", '{"message":"not found"}');

    expect(err.status).toBe(404);
    expect(err.statusText).toBe("Not Found");
    expect(err.body).toBe('{"message":"not found"}');
    expect(err.retryAfter).toBeUndefined();
  });

  it("formats message as 'GitLab API error {status}: {statusText}'", () => {
    const err = new GitLabApiError(502, "Bad Gateway", "");
    expect(err.message).toBe("GitLab API error 502: Bad Gateway");
  });

  it("sets name to 'GitLabApiError'", () => {
    const err = new GitLabApiError(500, "Internal Server Error", "");
    expect(err.name).toBe("GitLabApiError");
  });

  it("is an instance of Error", () => {
    const err = new GitLabApiError(500, "Internal Server Error", "");
    expect(err).toBeInstanceOf(Error);
  });

  it("stores optional retryAfter", () => {
    const err = new GitLabApiError(429, "Too Many Requests", "", 60);
    expect(err.retryAfter).toBe(60);
  });
});

describe("TRANSIENT_STATUSES", () => {
  it("contains the expected status codes", () => {
    expect([...TRANSIENT_STATUSES]).toEqual([408, 429, 500, 502, 503, 504]);
  });
});

describe("AUTH_FAILURE_STATUSES", () => {
  it("contains only 401", () => {
    expect([...AUTH_FAILURE_STATUSES]).toEqual([401]);
  });
});

describe("isTransientError", () => {
  it.each([408, 429, 500, 502, 503, 504] as const)(
    "returns true for GitLabApiError with status %d",
    (status) => {
      const err = new GitLabApiError(status, "Error", "");
      expect(isTransientError(err)).toBe(true);
    },
  );

  it("returns true for TypeError", () => {
    expect(isTransientError(new TypeError("fetch failed"))).toBe(true);
  });

  it("returns true for DOMException AbortError", () => {
    const err = new DOMException("The operation was aborted", "AbortError");
    expect(isTransientError(err)).toBe(true);
  });

  it("returns true for DOMException TimeoutError", () => {
    const err = new DOMException("The operation timed out", "TimeoutError");
    expect(isTransientError(err)).toBe(true);
  });

  it.each([400, 401, 403, 404, 409, 422])(
    "returns false for GitLabApiError with status %d",
    (status) => {
      const err = new GitLabApiError(status, "Error", "");
      expect(isTransientError(err)).toBe(false);
    },
  );

  it("returns false for DOMException with non-transient name", () => {
    const err = new DOMException("Syntax error", "SyntaxError");
    expect(isTransientError(err)).toBe(false);
  });

  it("returns false for plain Error", () => {
    expect(isTransientError(new Error("something"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isTransientError("string error")).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError(42)).toBe(false);
  });
});

describe("isAuthError", () => {
  it("returns true for GitLabApiError with status 401", () => {
    const err = new GitLabApiError(401, "Unauthorized", "");
    expect(isAuthError(err)).toBe(true);
  });

  it("returns false for GitLabApiError with status 403", () => {
    const err = new GitLabApiError(403, "Forbidden", "");
    expect(isAuthError(err)).toBe(false);
  });

  it("returns false for plain Error", () => {
    expect(isAuthError(new Error("Unauthorized"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isAuthError("401")).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });
});
