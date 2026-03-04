// @vitest-environment jsdom
import "@/test/setup-dom";
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWrapper } from "@/test/component-wrapper";
import { MOCK_MR_AUTHORED, MOCK_MR_TO_REVIEW } from "@/test/fixtures/mr-summary.fixture";
import type { MRSummary } from "@/lib/types/mr";

vi.mock("@/lib/client-errors", () => ({
  apiFetch: vi.fn(),
  AUTH_EXPIRED_EVENT: "shipyard:auth-expired",
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const { apiFetch } = await import("@/lib/client-errors");
const { useMRDetail } = await import("../use-mr-detail");

const mockedApiFetch = apiFetch as ReturnType<typeof vi.fn>;

function mockResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(data) } as unknown as Response;
}

const DETAIL_RESPONSE = {
  mr: { id: MOCK_MR_AUTHORED.id, iid: MOCK_MR_AUTHORED.iid, title: "Test MR" },
  approvals: { approved: false, approved_by: [] },
};
const CHANGES_RESPONSE = [{ old_path: "a.ts", new_path: "a.ts" }];
const DISCUSSIONS_RESPONSE = [{ id: "disc-1" }];
const COMMITS_RESPONSE = [{ id: "abc123" }];
const PIPELINES_RESPONSE = [{ id: 100 }];
const NOTES_RESPONSE = [{ id: 1, body: "note" }];

function setupAllSuccessful() {
  mockedApiFetch.mockImplementation((url: string) => {
    if (url.endsWith("/changes")) return Promise.resolve(mockResponse(CHANGES_RESPONSE));
    if (url.endsWith("/discussions")) return Promise.resolve(mockResponse(DISCUSSIONS_RESPONSE));
    if (url.endsWith("/commits")) return Promise.resolve(mockResponse(COMMITS_RESPONSE));
    if (url.endsWith("/pipelines")) return Promise.resolve(mockResponse(PIPELINES_RESPONSE));
    if (url.endsWith("/notes")) return Promise.resolve(mockResponse(NOTES_RESPONSE));
    // Base detail path
    return Promise.resolve(mockResponse(DETAIL_RESPONSE));
  });
}

const wrapper = createWrapper();

describe("useMRDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null data and no fetch when selected is null", () => {
    const { result } = renderHook(
      ({ sel, ver }) => useMRDetail(sel, ver),
      { initialProps: { sel: null as MRSummary | null, ver: 0 }, wrapper },
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockedApiFetch).not.toHaveBeenCalled();
  });

  it("triggers 6 parallel fetches when selected is set", async () => {
    setupAllSuccessful();

    renderHook(
      ({ sel, ver }) => useMRDetail(sel, ver),
      { initialProps: { sel: MOCK_MR_AUTHORED as MRSummary | null, ver: 0 }, wrapper },
    );

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledTimes(6);
    });

    const calls = mockedApiFetch.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain("/api/gitlab/merge-requests/42/17");
    expect(calls).toContain("/api/gitlab/merge-requests/42/17/changes");
    expect(calls).toContain("/api/gitlab/merge-requests/42/17/discussions");
    expect(calls).toContain("/api/gitlab/merge-requests/42/17/commits");
    expect(calls).toContain("/api/gitlab/merge-requests/42/17/pipelines");
    expect(calls).toContain("/api/gitlab/merge-requests/42/17/notes");
  });

  it("transitions isLoading true then false on successful load", async () => {
    setupAllSuccessful();

    const { result } = renderHook(
      ({ sel, ver }) => useMRDetail(sel, ver),
      { initialProps: { sel: MOCK_MR_AUTHORED as MRSummary | null, ver: 0 }, wrapper },
    );

    // isLoading should become true while fetching
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.mr).toEqual(DETAIL_RESPONSE.mr);
    expect(result.current.data!.approvals).toEqual(DETAIL_RESPONSE.approvals);
    expect(result.current.data!.diffs).toEqual(CHANGES_RESPONSE);
    expect(result.current.data!.discussions).toEqual(DISCUSSIONS_RESPONSE);
    expect(result.current.data!.commits).toEqual(COMMITS_RESPONSE);
    expect(result.current.data!.pipelines).toEqual(PIPELINES_RESPONSE);
    expect(result.current.data!.notes).toEqual(NOTES_RESPONSE);
    expect(result.current.error).toBeNull();
  });

  it("sets error when critical detail fetch fails", async () => {
    mockedApiFetch.mockImplementation((url: string) => {
      if (url.endsWith("/changes")) return Promise.resolve(mockResponse(CHANGES_RESPONSE));
      if (url.endsWith("/discussions")) return Promise.resolve(mockResponse(DISCUSSIONS_RESPONSE));
      if (url.endsWith("/commits")) return Promise.resolve(mockResponse(COMMITS_RESPONSE));
      if (url.endsWith("/pipelines")) return Promise.resolve(mockResponse(PIPELINES_RESPONSE));
      if (url.endsWith("/notes")) return Promise.resolve(mockResponse(NOTES_RESPONSE));
      // Detail endpoint rejects
      return Promise.reject(new Error("Network failure"));
    });

    const { result } = renderHook(
      ({ sel, ver }) => useMRDetail(sel, ver),
      { initialProps: { sel: MOCK_MR_AUTHORED as MRSummary | null, ver: 0 }, wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe("Network failure");
    expect(result.current.data).toBeNull();
  });

  it("populates data with empty arrays for failed tab fetches and sets partialErrors", async () => {
    mockedApiFetch.mockImplementation((url: string) => {
      if (url.endsWith("/changes")) return Promise.resolve(mockResponse({}, false, 500));
      if (url.endsWith("/discussions")) return Promise.reject(new Error("timeout"));
      if (url.endsWith("/commits")) return Promise.resolve(mockResponse(COMMITS_RESPONSE));
      if (url.endsWith("/pipelines")) return Promise.resolve(mockResponse(PIPELINES_RESPONSE));
      if (url.endsWith("/notes")) return Promise.resolve(mockResponse(NOTES_RESPONSE));
      return Promise.resolve(mockResponse(DETAIL_RESPONSE));
    });

    const { result } = renderHook(
      ({ sel, ver }) => useMRDetail(sel, ver),
      { initialProps: { sel: MOCK_MR_AUTHORED as MRSummary | null, ver: 0 }, wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.diffs).toEqual([]);
    expect(result.current.data!.discussions).toEqual([]);
    expect(result.current.data!.commits).toEqual(COMMITS_RESPONSE);
    expect(result.current.data!.partialErrors).toBeDefined();
    expect(result.current.data!.partialErrors!.length).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("triggers silent refetch without loading spinner on refetch()", async () => {
    setupAllSuccessful();

    const { result } = renderHook(
      ({ sel, ver }) => useMRDetail(sel, ver),
      { initialProps: { sel: MOCK_MR_AUTHORED as MRSummary | null, ver: 0 }, wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockedApiFetch.mockClear();
    setupAllSuccessful();

    // refetch should not set isLoading to true
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockedApiFetch).toHaveBeenCalledTimes(6);
  });

  it("triggers full refetch with loading state when selected MR id changes", async () => {
    setupAllSuccessful();

    const { result, rerender } = renderHook(
      ({ sel, ver }) => useMRDetail(sel, ver),
      { initialProps: { sel: MOCK_MR_AUTHORED as MRSummary | null, ver: 0 }, wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockedApiFetch.mockClear();
    setupAllSuccessful();

    rerender({ sel: MOCK_MR_TO_REVIEW, ver: 0 });

    // Should show loading for the new MR
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockedApiFetch).toHaveBeenCalledTimes(6);
    const calls = mockedApiFetch.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain(`/api/gitlab/merge-requests/${MOCK_MR_TO_REVIEW.projectId}/${MOCK_MR_TO_REVIEW.iid}`);
  });

  it("triggers silent refetch when detailVersion bumps above 0", async () => {
    setupAllSuccessful();

    const { result, rerender } = renderHook(
      ({ sel, ver }) => useMRDetail(sel, ver),
      { initialProps: { sel: MOCK_MR_AUTHORED as MRSummary | null, ver: 0 }, wrapper },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockedApiFetch.mockClear();
    setupAllSuccessful();

    rerender({ sel: MOCK_MR_AUTHORED, ver: 1 });

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledTimes(6);
    });

    // Silent refetch should not set isLoading
    expect(result.current.isLoading).toBe(false);
  });

  it("clears data when selected changes to null", async () => {
    setupAllSuccessful();

    const { result, rerender } = renderHook(
      ({ sel, ver }) => useMRDetail(sel, ver),
      { initialProps: { sel: MOCK_MR_AUTHORED as MRSummary | null, ver: 0 }, wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    rerender({ sel: null, ver: 0 });

    expect(result.current.data).toBeNull();
  });
});
