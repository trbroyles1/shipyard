import { describe, it, expect, vi } from "vitest";
import { GitLabApiError } from "@/lib/errors";
import { ValidationError } from "@/lib/validation";
import { createMockLogger } from "./test-utils";

vi.mock("@/lib/gitlab-client", async () => {
  const actual: { GitLabApiError: typeof GitLabApiError } =
    await vi.importActual("@/lib/errors");
  return { GitLabApiError: actual.GitLabApiError };
});

// Must import after mock is set up
const { handleApiRouteError } = await import("@/lib/api-error-handler");

async function parseBody(response: Response): Promise<{ error: string; code: string }> {
  return response.json() as Promise<{ error: string; code: string }>;
}

describe("handleApiRouteError", () => {
  it("handles ValidationError with status 400", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(new ValidationError("bad"), log);

    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.error).toBe("bad");
    expect(body.code).toBe("validation_error");
    expect(log.warn).toHaveBeenCalled();
  });

  it("handles GitLabApiError 401 as not_authenticated", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new GitLabApiError(401, "Unauthorized", ""),
      log,
    );

    expect(res.status).toBe(401);
    const body = await parseBody(res);
    expect(body.code).toBe("not_authenticated");
    expect(body.error).toBe("Your GitLab session has expired");
  });

  it("handles GitLabApiError 403 as forbidden", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new GitLabApiError(403, "Forbidden", ""),
      log,
    );

    expect(res.status).toBe(403);
    const body = await parseBody(res);
    expect(body.code).toBe("forbidden");
    expect(body.error).toBe("You don't have permission for this action");
  });

  it("handles GitLabApiError 404 as not_found", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new GitLabApiError(404, "Not Found", ""),
      log,
    );

    expect(res.status).toBe(404);
    const body = await parseBody(res);
    expect(body.code).toBe("not_found");
    expect(body.error).toBe("Resource not found or not accessible");
  });

  it("handles GitLabApiError 408 as gitlab_unavailable", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new GitLabApiError(408, "Request Timeout", ""),
      log,
    );

    expect(res.status).toBe(408);
    const body = await parseBody(res);
    expect(body.code).toBe("gitlab_unavailable");
  });

  it("handles GitLabApiError 409 as conflict", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new GitLabApiError(409, "Conflict", ""),
      log,
    );

    expect(res.status).toBe(409);
    const body = await parseBody(res);
    expect(body.code).toBe("conflict");
  });

  it("handles GitLabApiError 422 with JSON body message", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new GitLabApiError(422, "Unprocessable Entity", '{"message":"sha mismatch"}'),
      log,
    );

    expect(res.status).toBe(422);
    const body = await parseBody(res);
    expect(body.code).toBe("validation_error");
    expect(body.error).toBe("sha mismatch");
  });

  it("handles GitLabApiError 429 as rate_limited", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new GitLabApiError(429, "Too Many Requests", ""),
      log,
    );

    expect(res.status).toBe(429);
    const body = await parseBody(res);
    expect(body.code).toBe("rate_limited");
  });

  it("handles GitLabApiError 500 as gitlab_unavailable with status 502", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new GitLabApiError(500, "Internal Server Error", ""),
      log,
    );

    expect(res.status).toBe(502);
    const body = await parseBody(res);
    expect(body.code).toBe("gitlab_unavailable");
  });

  it("handles GitLabApiError 400 with JSON string message", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new GitLabApiError(400, "Bad Request", '{"message":"Invalid"}'),
      log,
    );

    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.code).toBe("validation_error");
    expect(body.error).toBe("Invalid");
  });

  it("handles GitLabApiError 400 with JSON array message", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new GitLabApiError(400, "Bad Request", '{"message":["e1","e2"]}'),
      log,
    );

    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.error).toBe("e1; e2");
  });

  it("handles Error with token refresh failure message", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new Error("Token refresh failed: expired"),
      log,
    );

    expect(res.status).toBe(401);
    const body = await parseBody(res);
    expect(body.code).toBe("token_expired");
    expect(body.error).toBe("Your GitLab session has expired");
  });

  it("handles Error with 'Not authenticated' message", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(new Error("Not authenticated"), log);

    expect(res.status).toBe(401);
    const body = await parseBody(res);
    expect(body.code).toBe("not_authenticated");
  });

  it("handles Error with 'No access token' message", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(
      new Error("No access token available"),
      log,
    );

    expect(res.status).toBe(401);
    const body = await parseBody(res);
    expect(body.code).toBe("not_authenticated");
  });

  it("handles generic Error as internal_error", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError(new Error("something random"), log);

    expect(res.status).toBe(500);
    const body = await parseBody(res);
    expect(body.code).toBe("internal_error");
    expect(body.error).toBe("Internal server error");
    expect(log.error).toHaveBeenCalled();
  });

  it("handles non-Error values as internal_error", async () => {
    const log = createMockLogger();
    const res = handleApiRouteError("string error", log);

    expect(res.status).toBe(500);
    const body = await parseBody(res);
    expect(body.code).toBe("internal_error");
    expect(log.error).toHaveBeenCalled();
  });
});
