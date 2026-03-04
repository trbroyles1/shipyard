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

import { GET as getDiscussions, POST as postDiscussion } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/discussions/route";
import { POST as postNote } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/discussions/[discussionId]/notes/route";
import { PUT as resolveDiscussion } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/discussions/[discussionId]/resolve/route";
import { MOCK_DISCUSSION, MOCK_NOTE } from "../fixtures/gitlab-discussions.fixture";
import {
  GITLAB_API,
  VALID_PROJECT_ID,
  VALID_IID,
  VALID_DISCUSSION_ID,
  setupRouteTestEnv,
  routeParams,
  createGETRequest,
  createPOSTRequest,
  createPUTRequest,
  parseJSONResponse,
} from "./route-test-utils";

beforeAll(() => { server.listen(); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });
beforeEach(() => { setupRouteTestEnv(); });

const DISCUSSIONS_PATH = `/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/discussions`;

describe("GET /merge-requests/[projectId]/[iid]/discussions", () => {
  it("returns discussions array on success", async () => {
    server.use(
      http.get(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/discussions`, () => {
        return HttpResponse.json([MOCK_DISCUSSION], {
          headers: { "x-total-pages": "1" },
        });
      }),
    );

    const response = await getDiscussions(
      createGETRequest(DISCUSSIONS_PATH),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual([MOCK_DISCUSSION]);
  });

  it("returns empty array when no discussions exist", async () => {
    server.use(
      http.get(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/discussions`, () => {
        return HttpResponse.json([], {
          headers: { "x-total-pages": "1" },
        });
      }),
    );

    const response = await getDiscussions(
      createGETRequest(DISCUSSIONS_PATH),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns 400 for non-numeric projectId", async () => {
    const response = await getDiscussions(
      createGETRequest("/api/gitlab/merge-requests/abc/17/discussions"),
      routeParams({ projectId: "abc", iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(400);
    expect(body.code).toBe("validation_error");
  });
});

describe("POST /merge-requests/[projectId]/[iid]/discussions", () => {
  it("creates a discussion with body text", async () => {
    server.use(
      http.post(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/discussions`, () => {
        return HttpResponse.json(MOCK_DISCUSSION);
      }),
    );

    const response = await postDiscussion(
      createPOSTRequest(DISCUSSIONS_PATH, { body: "Great work!" }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(MOCK_DISCUSSION);
  });

  it("creates a discussion with position object", async () => {
    let capturedBody: Record<string, unknown> | undefined;

    server.use(
      http.post(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/discussions`, async ({ request }) => {
        capturedBody = await request.json() as Record<string, unknown>;
        return HttpResponse.json(MOCK_DISCUSSION);
      }),
    );

    const payload = {
      body: "Needs fix here",
      position: {
        position_type: "text" as const,
        base_sha: "a".repeat(40),
        head_sha: "b".repeat(40),
        start_sha: "c".repeat(40),
        old_path: "src/file.ts",
        new_path: "src/file.ts",
        old_line: null,
        new_line: 10,
      },
    };

    const response = await postDiscussion(
      createPOSTRequest(DISCUSSIONS_PATH, payload),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(capturedBody).toBeDefined();
    expect(capturedBody!.body).toBe("Needs fix here");
    expect(capturedBody!.position).toEqual(payload.position);
  });

  it("returns 400 for empty body string", async () => {
    const response = await postDiscussion(
      createPOSTRequest(DISCUSSIONS_PATH, { body: "" }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(400);
    expect(body.code).toBe("validation_error");
  });

  it("returns 400 for missing body field", async () => {
    const response = await postDiscussion(
      createPOSTRequest(DISCUSSIONS_PATH, {}),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(400);
    expect(body.code).toBe("validation_error");
  });
});

describe("POST /merge-requests/[projectId]/[iid]/discussions/[discussionId]/notes", () => {
  const NOTES_PATH = `${DISCUSSIONS_PATH}/${VALID_DISCUSSION_ID}/notes`;

  it("creates a reply note", async () => {
    server.use(
      http.post(
        `${GITLAB_API}/projects/:projectId/merge_requests/:iid/discussions/:discussionId/notes`,
        () => HttpResponse.json(MOCK_NOTE),
      ),
    );

    const response = await postNote(
      createPOSTRequest(NOTES_PATH, { body: "I agree" }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID, discussionId: VALID_DISCUSSION_ID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual(MOCK_NOTE);
  });

  it("returns 400 for invalid discussionId", async () => {
    const response = await postNote(
      createPOSTRequest(`${DISCUSSIONS_PATH}/not-a-sha/notes`, { body: "I agree" }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID, discussionId: "not-a-sha" }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(400);
    expect(body.code).toBe("validation_error");
    expect(body.error).toContain("discussionId");
  });

  it("returns 400 for empty body string", async () => {
    const response = await postNote(
      createPOSTRequest(NOTES_PATH, { body: "" }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID, discussionId: VALID_DISCUSSION_ID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(400);
    expect(body.code).toBe("validation_error");
  });
});

describe("PUT /merge-requests/[projectId]/[iid]/discussions/[discussionId]/resolve", () => {
  const RESOLVE_PATH = `${DISCUSSIONS_PATH}/${VALID_DISCUSSION_ID}/resolve`;

  it("resolves a discussion", async () => {
    server.use(
      http.put(
        `${GITLAB_API}/projects/:projectId/merge_requests/:iid/discussions/:discussionId`,
        () => HttpResponse.json(MOCK_DISCUSSION),
      ),
    );

    const response = await resolveDiscussion(
      createPUTRequest(RESOLVE_PATH, { resolved: true }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID, discussionId: VALID_DISCUSSION_ID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("unresolves a discussion", async () => {
    server.use(
      http.put(
        `${GITLAB_API}/projects/:projectId/merge_requests/:iid/discussions/:discussionId`,
        () => HttpResponse.json(MOCK_DISCUSSION),
      ),
    );

    const response = await resolveDiscussion(
      createPUTRequest(RESOLVE_PATH, { resolved: false }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID, discussionId: VALID_DISCUSSION_ID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("returns 400 for missing resolved field", async () => {
    const response = await resolveDiscussion(
      createPUTRequest(RESOLVE_PATH, {}),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID, discussionId: VALID_DISCUSSION_ID }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(400);
    expect(body.code).toBe("validation_error");
  });

  it("returns 400 for invalid discussionId", async () => {
    const response = await resolveDiscussion(
      createPUTRequest(`${DISCUSSIONS_PATH}/xyz/resolve`, { resolved: true }),
      routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID, discussionId: "xyz" }),
    );
    const { status, body } = await parseJSONResponse(response);

    expect(status).toBe(400);
    expect(body.code).toBe("validation_error");
    expect(body.error).toContain("discussionId");
  });
});
