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

import { GET } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/commits/route";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { MOCK_COMMIT } from "../fixtures/gitlab-commits.fixture";
import {
  GITLAB_API,
  VALID_PROJECT_ID, VALID_IID,
  setupRouteTestEnv, routeParams, createGETRequest,
} from "./route-test-utils";

beforeAll(() => { server.listen(); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });
beforeEach(() => { setupRouteTestEnv(); });

describe("GET /api/gitlab/merge-requests/[projectId]/[iid]/commits", () => {
  it("returns commits array on success", async () => {
    server.use(
      http.get(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/commits`, () =>
        HttpResponse.json([MOCK_COMMIT], { headers: { "x-total-pages": "1" } })
      ),
    );

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/commits`);
    const res = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([MOCK_COMMIT]);
  });

  it("returns empty array when there are no commits", async () => {
    server.use(
      http.get(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/commits`, () =>
        HttpResponse.json([], { headers: { "x-total-pages": "1" } })
      ),
    );

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/commits`);
    const res = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns 400 for non-numeric projectId", async () => {
    const req = createGETRequest("/api/gitlab/merge-requests/abc/17/commits");
    const res = await GET(req, routeParams({ projectId: "abc", iid: VALID_IID }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("validation_error");
  });

  it("returns 401 on auth error", async () => {
    vi.mocked(getAuthenticatedSession).mockRejectedValueOnce(new Error("Not authenticated"));

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/commits`);
    const res = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));

    expect(res.status).toBe(401);
  });
});
