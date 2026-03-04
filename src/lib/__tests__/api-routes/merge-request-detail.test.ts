import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";

const { TEST_TOKEN, TEST_USER_ID, mockLogger } = vi.hoisted(() => ({
  TEST_TOKEN: "test-token",
  TEST_USER_ID: 1,
  mockLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedSession: vi.fn().mockResolvedValue({ gitlabUserId: TEST_USER_ID }),
  getAccessToken: vi.fn().mockResolvedValue(TEST_TOKEN),
}));
vi.mock("@/lib/rate-limiter", () => ({ acquire: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/logger", () => ({ createLogger: () => mockLogger }));
vi.mock("@/lib/viewed-mr-store", () => ({
  setViewedMR: vi.fn(),
}));

import { GET } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/route";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { setViewedMR } from "@/lib/viewed-mr-store";
import { MOCK_MERGE_REQUEST } from "../fixtures/gitlab-mr.fixture";
import { MOCK_APPROVALS } from "../fixtures/gitlab-approvals.fixture";
import {
  GITLAB_API,
  VALID_PROJECT_ID,
  VALID_IID,
  setupRouteTestEnv,
  routeParams,
  createGETRequest,
} from "./route-test-utils";

beforeAll(() => { server.listen(); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });
beforeEach(() => {
  setupRouteTestEnv();
  vi.mocked(getAuthenticatedSession).mockResolvedValue({ gitlabUserId: TEST_USER_ID });
  vi.mocked(setViewedMR).mockClear();
});

describe("GET /api/gitlab/merge-requests/[projectId]/[iid]", () => {
  it("returns mr and approvals on success", async () => {
    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}`);
    const response = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mr.id).toBe(MOCK_MERGE_REQUEST.id);
    expect(body.approvals.approved).toBe(MOCK_APPROVALS.approved);
  });

  it("calls setViewedMR with correct arguments", async () => {
    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}`);
    await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));

    expect(vi.mocked(setViewedMR)).toHaveBeenCalledWith(
      TEST_USER_ID,
      Number(VALID_PROJECT_ID),
      Number(VALID_IID),
    );
  });

  it("skips setViewedMR when gitlabUserId is falsy", async () => {
    vi.mocked(getAuthenticatedSession).mockResolvedValueOnce({ gitlabUserId: 0 });

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}`);
    await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));

    expect(vi.mocked(setViewedMR)).not.toHaveBeenCalled();
  });

  it("returns 400 for non-numeric projectId", async () => {
    const req = createGETRequest("/api/gitlab/merge-requests/abc/17");
    const response = await GET(req, routeParams({ projectId: "abc", iid: VALID_IID }));

    expect(response.status).toBe(400);
  });

  it("returns 404 when GitLab MR is not found", async () => {
    server.use(
      http.get(
        `${GITLAB_API}/projects/:projectId/merge_requests/:iid`,
        () => HttpResponse.json({ message: "Not found" }, { status: 404 }),
      ),
    );

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}`);
    const response = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));

    expect(response.status).toBe(404);
  });

  it("returns 401 when session is not authenticated", async () => {
    vi.mocked(getAuthenticatedSession).mockRejectedValueOnce(new Error("Not authenticated"));

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}`);
    const response = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));

    expect(response.status).toBe(401);
  });
});
