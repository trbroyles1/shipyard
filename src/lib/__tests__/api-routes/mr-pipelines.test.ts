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

import { GET as getPipelines } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/pipelines/route";
import { GET as getPipelineJobs } from "@/app/api/gitlab/projects/[projectId]/pipelines/[pipelineId]/jobs/route";
import { MOCK_PIPELINE } from "../fixtures/gitlab-mr.fixture";
import { MOCK_JOB } from "../fixtures/gitlab-jobs.fixture";
import {
  GITLAB_API,
  VALID_PROJECT_ID, VALID_IID, VALID_PIPELINE_ID,
  setupRouteTestEnv, routeParams, createGETRequest,
} from "./route-test-utils";

beforeAll(() => { server.listen(); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });
beforeEach(() => { setupRouteTestEnv(); });

describe("GET /api/gitlab/merge-requests/[projectId]/[iid]/pipelines", () => {
  it("returns pipelines array on success", async () => {
    server.use(
      http.get(`${GITLAB_API}/projects/:projectId/merge_requests/:iid/pipelines`, () =>
        HttpResponse.json([MOCK_PIPELINE], { headers: { "x-total-pages": "1" } })
      ),
    );

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/pipelines`);
    const res = await getPipelines(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([MOCK_PIPELINE]);
  });

  it("returns 400 for non-numeric projectId", async () => {
    const req = createGETRequest("/api/gitlab/merge-requests/abc/17/pipelines");
    const res = await getPipelines(req, routeParams({ projectId: "abc", iid: VALID_IID }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("validation_error");
  });
});

describe("GET /api/gitlab/projects/[projectId]/pipelines/[pipelineId]/jobs", () => {
  it("returns jobs array on success", async () => {
    server.use(
      http.get(`${GITLAB_API}/projects/:projectId/pipelines/:pipelineId/jobs`, () =>
        HttpResponse.json([MOCK_JOB], { headers: { "x-total-pages": "1" } })
      ),
    );

    const req = createGETRequest(`/api/gitlab/projects/${VALID_PROJECT_ID}/pipelines/${VALID_PIPELINE_ID}/jobs`);
    const res = await getPipelineJobs(req, routeParams({ projectId: VALID_PROJECT_ID, pipelineId: VALID_PIPELINE_ID }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([MOCK_JOB]);
  });

  it("returns 400 for non-numeric pipelineId", async () => {
    const req = createGETRequest(`/api/gitlab/projects/${VALID_PROJECT_ID}/pipelines/abc/jobs`);
    const res = await getPipelineJobs(req, routeParams({ projectId: VALID_PROJECT_ID, pipelineId: "abc" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("validation_error");
  });
});
