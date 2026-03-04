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

import { GET } from "@/app/api/gitlab/merge-requests/route";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import {
  GITLAB_API,
  setupRouteTestEnv, createGETRequest,
} from "./route-test-utils";
import type { MRSummary } from "@/lib/types/mr";

beforeAll(() => { server.listen(); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });
beforeEach(() => { setupRouteTestEnv(); });

describe("GET /api/gitlab/merge-requests", () => {
  it("returns mapped MRSummary array on success", async () => {
    const req = createGETRequest("/api/gitlab/merge-requests");
    const res = await GET(req);
    const body: MRSummary[] = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);

    const first = body[0];
    expect(first.id).toBe(1001);
    expect(first.iid).toBe(17);
    expect(first.repo).toBe("project");
    expect(first.draft).toBe(false);
    expect(first.pipeline).toEqual({
      id: 100,
      status: "success",
      webUrl: "https://gitlab.example.com/org/project/-/pipelines/100",
    });
  });

  it("returns empty array when no MRs exist", async () => {
    server.use(
      http.get(`${GITLAB_API}/groups/:groupId/merge_requests`, () =>
        HttpResponse.json([], { headers: { "x-total-pages": "1" } })
      ),
    );

    const req = createGETRequest("/api/gitlab/merge-requests");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("handles null head_pipeline by mapping to null", async () => {
    const req = createGETRequest("/api/gitlab/merge-requests");
    const res = await GET(req);
    const body: MRSummary[] = await res.json();

    expect(body[1].pipeline).toBeNull();
  });

  it("returns 401 on auth failure", async () => {
    vi.mocked(getAuthenticatedSession).mockRejectedValueOnce(new Error("Not authenticated"));

    const req = createGETRequest("/api/gitlab/merge-requests");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 502 when GitLab returns 500", async () => {
    server.use(
      http.get(`${GITLAB_API}/groups/:groupId/merge_requests`, () =>
        HttpResponse.json({ error: "Internal" }, { status: 500 })
      ),
    );

    const req = createGETRequest("/api/gitlab/merge-requests");
    const res = await GET(req);

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("gitlab_unavailable");
  });
});
