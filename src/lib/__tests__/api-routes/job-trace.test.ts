import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
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

import { GET } from "@/app/api/gitlab/projects/[projectId]/jobs/[jobId]/trace/route";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import { MOCK_JOB, MOCK_JOB_TRACE_TEXT } from "../fixtures/gitlab-jobs.fixture";
import {
  GITLAB_API,
  VALID_PROJECT_ID,
  setupRouteTestEnv,
  routeParams,
} from "./route-test-utils";

const VALID_JOB_ID = "301";

beforeAll(() => { server.listen(); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });
beforeEach(() => { setupRouteTestEnv(); });

/** Registers both trace and job-status MSW handlers with the given overrides. */
function registerTraceHandlers(
  traceResponse?: { body: string; status?: number; headers?: Record<string, string> },
  jobResponse?: { body?: unknown; status?: number },
) {
  const traceHandler = http.get(
    `${GITLAB_API}/projects/:projectId/jobs/:jobId/trace`,
    () => {
      const status = traceResponse?.status ?? 200;
      const headers: Record<string, string> = {
        "Content-Type": "text/plain",
        ...(traceResponse?.headers ?? {}),
      };
      return new HttpResponse(traceResponse?.body ?? MOCK_JOB_TRACE_TEXT, { status, headers });
    },
  );

  const jobHandler = http.get(
    `${GITLAB_API}/projects/:projectId/jobs/:jobId`,
    ({ params }) => {
      if (String(params.jobId).includes("/")) {
        return HttpResponse.json({ error: "Not found" }, { status: 404 });
      }
      const status = jobResponse?.status ?? 200;
      const body = jobResponse?.body ?? MOCK_JOB;
      if (status >= 400) {
        return HttpResponse.json({ error: "Server error" }, { status });
      }
      return HttpResponse.json(body);
    },
  );

  server.use(traceHandler, jobHandler);
}

function createTraceRequest(
  projectId: string = VALID_PROJECT_ID,
  jobId: string = VALID_JOB_ID,
  headers?: Record<string, string>,
): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/gitlab/projects/${projectId}/jobs/${jobId}/trace`,
    headers ? { headers } : undefined,
  );
}

describe("GET /api/gitlab/projects/[projectId]/jobs/[jobId]/trace", () => {
  it("returns trace text with X-Job-Status header on success", async () => {
    registerTraceHandlers();

    const req = createTraceRequest();
    const response = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, jobId: VALID_JOB_ID }));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain("Running with gitlab-runner");
    expect(text).toContain("Job succeeded");
    expect(response.headers.get("X-Job-Status")).toBe("success");
    expect(response.headers.get("Content-Type")).toContain("text/plain");
  });

  it("forwards valid Range header and returns 206 with Content-Range", async () => {
    server.use(
      http.get(
        `${GITLAB_API}/projects/:projectId/jobs/:jobId/trace`,
        () => new HttpResponse("partial trace", {
          status: 206,
          headers: {
            "Content-Type": "text/plain",
            "Content-Range": "bytes 100-200/500",
          },
        }),
      ),
      http.get(
        `${GITLAB_API}/projects/:projectId/jobs/:jobId`,
        () => HttpResponse.json(MOCK_JOB),
      ),
    );

    const req = new NextRequest(
      `http://localhost:3000/api/gitlab/projects/${VALID_PROJECT_ID}/jobs/${VALID_JOB_ID}/trace`,
      { headers: { Range: "bytes=100-200" } },
    );
    const response = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, jobId: VALID_JOB_ID }));

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 100-200/500");
  });

  it("ignores invalid Range header and returns 200", async () => {
    let capturedRangeHeader: string | null = null;

    server.use(
      http.get(
        `${GITLAB_API}/projects/:projectId/jobs/:jobId/trace`,
        ({ request }) => {
          capturedRangeHeader = request.headers.get("Range");
          return new HttpResponse(MOCK_JOB_TRACE_TEXT, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        },
      ),
      http.get(
        `${GITLAB_API}/projects/:projectId/jobs/:jobId`,
        () => HttpResponse.json(MOCK_JOB),
      ),
    );

    const req = new NextRequest(
      `http://localhost:3000/api/gitlab/projects/${VALID_PROJECT_ID}/jobs/${VALID_JOB_ID}/trace`,
      { headers: { Range: "invalid" } },
    );
    const response = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, jobId: VALID_JOB_ID }));

    expect(response.status).toBe(200);
    expect(capturedRangeHeader).toBeNull();
  });

  it("maps GitLab 5xx to 502", async () => {
    server.use(
      http.get(
        `${GITLAB_API}/projects/:projectId/jobs/:jobId/trace`,
        () => new HttpResponse("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
      http.get(
        `${GITLAB_API}/projects/:projectId/jobs/:jobId`,
        () => HttpResponse.json(MOCK_JOB),
      ),
    );

    const req = createTraceRequest();
    const response = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, jobId: VALID_JOB_ID }));

    expect(response.status).toBe(502);
  });

  it("returns X-Job-Status unknown when job status fetch fails", async () => {
    server.use(
      http.get(
        `${GITLAB_API}/projects/:projectId/jobs/:jobId/trace`,
        () => new HttpResponse(MOCK_JOB_TRACE_TEXT, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
      http.get(
        `${GITLAB_API}/projects/:projectId/jobs/:jobId`,
        () => HttpResponse.json({ error: "Server error" }, { status: 500 }),
      ),
    );

    const req = createTraceRequest();
    const response = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, jobId: VALID_JOB_ID }));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Job-Status")).toBe("unknown");
  });

  it("returns 400 for non-numeric jobId", async () => {
    const req = createTraceRequest(VALID_PROJECT_ID, "abc");
    const response = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, jobId: "abc" }));

    expect(response.status).toBe(400);
  });

  it("returns 401 when session is not authenticated", async () => {
    vi.mocked(getAuthenticatedSession).mockRejectedValueOnce(new Error("Not authenticated"));

    const req = createTraceRequest();
    const response = await GET(req, routeParams({ projectId: VALID_PROJECT_ID, jobId: VALID_JOB_ID }));

    expect(response.status).toBe(401);
  });
});
