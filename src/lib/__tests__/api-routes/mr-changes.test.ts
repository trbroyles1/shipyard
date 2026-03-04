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

import { GET as getChanges } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/changes/route";
import { GET as getChangesFile } from "@/app/api/gitlab/merge-requests/[projectId]/[iid]/changes/file/route";
import { getAuthenticatedSession } from "@/lib/auth-helpers";
import {
  MOCK_CHANGES_RESPONSE,
  MOCK_CHANGES_OVERFLOW_RESPONSE,
  MOCK_DIFF_TEXT_FILE,
  MOCK_DIFF_LARGE_FILE,
  MOCK_DIFF_NO_DIFF_TEXT,
} from "../fixtures/gitlab-changes.fixture";
import {
  GITLAB_API,
  VALID_PROJECT_ID,
  VALID_IID,
  setupRouteTestEnv,
  routeParams,
  createGETRequest,
} from "./route-test-utils";
import type { EnrichedDiffFile } from "@/lib/types/gitlab";

beforeAll(() => { server.listen(); });
afterEach(() => { server.resetHandlers(); });
afterAll(() => { server.close(); });
beforeEach(() => { setupRouteTestEnv(); });

function changesHandler(payload: unknown) {
  return http.get(
    `${GITLAB_API}/projects/:projectId/merge_requests/:iid/changes`,
    () => HttpResponse.json(payload),
  );
}

describe("GET /api/gitlab/merge-requests/[projectId]/[iid]/changes", () => {
  it("returns enriched diffs with addition/deletion counts", async () => {
    server.use(changesHandler(MOCK_CHANGES_RESPONSE));

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/changes`);
    const response = await getChanges(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body: EnrichedDiffFile[] = await response.json();

    expect(response.status).toBe(200);

    const textFile = body[0];
    expect(textFile.new_path).toBe(MOCK_DIFF_TEXT_FILE.new_path);
    expect(textFile.additions).toBe(10);
    expect(textFile.deletions).toBe(3);
    expect(textFile.truncated).toBe(false);
    expect(textFile.binary).toBe(false);
  });

  it("marks binary files correctly", async () => {
    server.use(changesHandler(MOCK_CHANGES_RESPONSE));

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/changes`);
    const response = await getChanges(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body: EnrichedDiffFile[] = await response.json();

    const binaryFile = body[1];
    expect(binaryFile.binary).toBe(true);
    expect(binaryFile.additions).toBe(0);
    expect(binaryFile.deletions).toBe(0);
  });

  it("truncates large diffs exceeding the line threshold", async () => {
    server.use(changesHandler({ changes: [MOCK_DIFF_LARGE_FILE], overflow: false }));

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/changes`);
    const response = await getChanges(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body: EnrichedDiffFile[] = await response.json();

    expect(body[0].truncated).toBe(true);
    expect(body[0].diff).toBe("");
    expect(body[0].additions).toBe(1600);
  });

  it("handles overflow flag without error", async () => {
    server.use(changesHandler(MOCK_CHANGES_OVERFLOW_RESPONSE));

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/changes`);
    const response = await getChanges(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));

    expect(response.status).toBe(200);
    const body: EnrichedDiffFile[] = await response.json();
    expect(body.length).toBeGreaterThan(0);
  });

  it("handles empty diff text gracefully", async () => {
    server.use(changesHandler({ changes: [MOCK_DIFF_NO_DIFF_TEXT], overflow: false }));

    const req = createGETRequest(`/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/changes`);
    const response = await getChanges(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body: EnrichedDiffFile[] = await response.json();

    expect(body[0].additions).toBe(0);
    expect(body[0].deletions).toBe(0);
    expect(body[0].truncated).toBe(false);
    expect(body[0].binary).toBe(false);
  });

  it("returns 400 for non-numeric projectId", async () => {
    const req = createGETRequest("/api/gitlab/merge-requests/abc/17/changes");
    const response = await getChanges(req, routeParams({ projectId: "abc", iid: VALID_IID }));

    expect(response.status).toBe(400);
  });
});

describe("GET /api/gitlab/merge-requests/[projectId]/[iid]/changes/file", () => {
  it("returns diff for matching file by new_path", async () => {
    server.use(changesHandler(MOCK_CHANGES_RESPONSE));

    const req = new NextRequest(
      `http://localhost:3000/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/changes/file?path=src/utils/helpers.ts`,
    );
    const response = await getChangesFile(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.diff).toBe(MOCK_DIFF_TEXT_FILE.diff);
  });

  it("matches by old_path for renamed files", async () => {
    server.use(changesHandler(MOCK_CHANGES_RESPONSE));

    const req = new NextRequest(
      `http://localhost:3000/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/changes/file?path=src/old-name.ts`,
    );
    const response = await getChangesFile(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.diff).toBeDefined();
  });

  it("returns 400 when ?path= query parameter is missing", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/changes/file`,
    );
    const response = await getChangesFile(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("path");
  });

  it("returns 404 when file is not found in diffs", async () => {
    server.use(changesHandler(MOCK_CHANGES_RESPONSE));

    const req = new NextRequest(
      `http://localhost:3000/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/changes/file?path=nonexistent.ts`,
    );
    const response = await getChangesFile(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("not found");
  });

  it("returns 401 when session is not authenticated", async () => {
    vi.mocked(getAuthenticatedSession).mockRejectedValueOnce(new Error("Not authenticated"));

    const req = new NextRequest(
      `http://localhost:3000/api/gitlab/merge-requests/${VALID_PROJECT_ID}/${VALID_IID}/changes/file?path=src/utils/helpers.ts`,
    );
    const response = await getChangesFile(req, routeParams({ projectId: VALID_PROJECT_ID, iid: VALID_IID }));

    expect(response.status).toBe(401);
  });
});
