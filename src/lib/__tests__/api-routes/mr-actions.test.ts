import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { createMockLogger } from "../test-utils";

// Mock upstream deps so importOriginal on auth-helpers doesn't chain through next-auth
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(), refreshAccessToken: vi.fn() }));
vi.mock("@/lib/auth-helpers", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthenticatedSession: vi.fn().mockResolvedValue({ gitlabUserId: 1 }),
    getAccessToken: vi.fn().mockResolvedValue("test-token"),
  };
});
vi.mock("@/lib/rate-limiter", () => ({ acquire: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/logger", () => ({ createLogger: () => createMockLogger() }));

import { POST as approve } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/approve/route";
import { POST as unapprove } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/unapprove/route";
import { PUT as merge } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/merge/route";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import {
  GITLAB_API,
  VALID_PROJECT_ID,
  VALID_IID,
  setupRouteTestEnv,
  routeParams,
  createPOSTRequest,
  createPUTRequest,
  parseJSONResponse,
} from "./route-test-utils";

beforeAll(() => { server.listen(); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });
beforeEach(() => { setupRouteTestEnv(); });

const APPROVE_PATH = `/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/approve`;
const UNAPPROVE_PATH = `/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/unapprove`;
const MERGE_PATH = `/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/merge`;

describe("POST /merge-requests/[projectId]/[iid]/approve", () => {
  it("succeeds with empty body", async () => {
    server.use(
      http.post(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/approve`, () => {
        return HttpResponse.json({ approved: true });
      }),
    );

    const response = await approve(
      createPOSTRequest(APPROVE_PATH, {}),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("succeeds with optional sha", async () => {
    let capturedBody: Record<string, unknown> | undefined;

    server.use(
      http.post(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/approve`, async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ approved: true });
      }),
    );

    const response = await approve(
      createPOSTRequest(APPROVE_PATH, { sha: "abc123" }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(capturedBody).toEqual({ sha: "abc123" });
  });

  it("returns 400 for invalid projectId", async () => {
    const response = await approve(
      createPOSTRequest("/api/gitlab/merge-requests/abc/17/approve", {}),
      routeParams({ projectId: "abc", iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(400);
    expect(body.code).toBe("validation_error");
  });
});

describe("POST /merge-requests/[projectId]/[iid]/unapprove", () => {
  it("succeeds on valid request", async () => {
    server.use(
      http.post(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/unapprove`, () => {
        return HttpResponse.json({});
      }),
    );

    const response = await unapprove(
      createPOSTRequest(UNAPPROVE_PATH, {}),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("returns 400 for non-numeric iid", async () => {
    const response = await unapprove(
      createPOSTRequest("/api/gitlab/merge-requests/42/abc/unapprove", {}),
      routeParams({ projectId: VALID_PROJECT_ID, iid: "abc" }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(400);
    expect(body.code).toBe("validation_error");
  });

  it("returns 401 on auth error", async () => {
    const mockedGetAuth = vi.mocked(getAuthenticatedSession);
    mockedGetAuth.mockRejectedValueOnce(new Error("Not authenticated"));

    const response = await unapprove(
      createPOSTRequest(UNAPPROVE_PATH, {}),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(401);
    expect(body.code).toBe("not_authenticated");
  });
});

describe("PUT /merge-requests/[projectId]/[iid]/merge", () => {
  it("succeeds with required sha", async () => {
    server.use(
      http.put(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/merge`, () => {
        return HttpResponse.json({ state: "merged" });
      }),
    );

    const response = await merge(
      createPUTRequest(MERGE_PATH, { sha: "abc123" }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual({ state: "merged" });
  });

  it("forwards all merge options to GitLab", async () => {
    let capturedBody: Record<string, unknown> | undefined;

    server.use(
      http.put(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/merge`, async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json({ state: "merged" });
      }),
    );

    const mergePayload = {
      sha: "abc123",
      squash: true,
      should_remove_source_branch: true,
      merge_when_pipeline_succeeds: false,
    };

    const response = await merge(
      createPUTRequest(MERGE_PATH, mergePayload),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(capturedBody).toBeDefined();
    expect(capturedBody!.sha).toBe("abc123");
    expect(capturedBody!.squash).toBe(true);
    expect(capturedBody!.should_remove_source_branch).toBe(true);
    expect(capturedBody!.merge_when_pipeline_succeeds).toBe(false);
  });

  it("returns 400 for missing sha", async () => {
    const response = await merge(
      createPUTRequest(MERGE_PATH, {}),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(400);
    expect(body.code).toBe("validation_error");
  });

  it("returns 409 on GitLab conflict", async () => {
    server.use(
      http.put(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/merge`, () => {
        return HttpResponse.json(
          { message: "SHA does not match" },
          { status: 409 },
        );
      }),
    );

    const response = await merge(
      createPUTRequest(MERGE_PATH, { sha: "abc123" }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(409);
    expect(body.code).toBe("conflict");
  });

  it("returns 422 on SHA mismatch", async () => {
    server.use(
      http.put(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/merge`, () => {
        return HttpResponse.json(
          { message: "SHA does not match HEAD" },
          { status: 422 },
        );
      }),
    );

    const response = await merge(
      createPUTRequest(MERGE_PATH, { sha: "abc123" }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(422);
    expect(body.code).toBe("validation_error");
    expect(body.error).toBe("SHA does not match HEAD");
  });
});
