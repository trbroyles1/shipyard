import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { createMockLogger } from "../test-utils";

const { TEST_USER_ID, TEST_TOKEN } = vi.hoisted(() => ({
  TEST_USER_ID: 1,
  TEST_TOKEN: "test-token",
}));

vi.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedSession: vi.fn().mockResolvedValue({ gitlabUserId: TEST_USER_ID }),
  getAccessToken: vi.fn().mockResolvedValue(TEST_TOKEN),
}));
vi.mock("@/lib/rate-limiter", () => ({ acquire: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/logger", () => ({ createLogger: () => createMockLogger() }));

import { GET } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/notes/route";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { MOCK_NOTE, MOCK_SYSTEM_NOTE } from "../fixtures/gitlab-discussions.fixture";
import {
  GITLAB_API,
  VALID_PROJECT_ID, VALID_IID,
  setupRouteTestEnv, routeParams, createGETRequest,
} from "./route-test-utils";

beforeAll(() => { server.listen(); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });
beforeEach(() => { setupRouteTestEnv(); });

describe("GET /api/gitlab/merge-requests/[projectId]/[iid]/notes", () => {
  it("returns notes array on success", async () => {
    server.use(
      http.get(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/notes`, () =>
        HttpResponse.json([MOCK_NOTE, MOCK_SYSTEM_NOTE], { headers: { "x-total-pages": "1" } })
      ),
    );

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/notes`);
    const res = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([MOCK_NOTE, MOCK_SYSTEM_NOTE]);
  });

  it("passes sort=asc query param to GitLab", async () => {
    let capturedUrl: URL | undefined;

    server.use(
      http.get(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/notes`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json([MOCK_NOTE], { headers: { "x-total-pages": "1" } });
      }),
    );

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/notes`);
    await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));

    expect(capturedUrl).toBeDefined();
    expect(capturedUrl?.searchParams.get("sort")).toBe("asc");
  });

  it("returns 400 for non-numeric iid", async () => {
    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/abc/notes`);
    const res = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: "abc" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("validation_error");
  });

  it("returns 401 on auth error", async () => {
    vi.mocked(getAuthenticatedSession).mockRejectedValueOnce(new Error("Not authenticated"));

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/notes`);
    const res = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));

    expect(res.status).toBe(401);
  });
});
