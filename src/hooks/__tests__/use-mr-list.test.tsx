// @vitest-environment jsdom
import "@/test/setup-dom";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SSEEventType } from "@/lib/types/events";
import { SSE_ERROR_GITLAB_GROUP_UNAVAILABLE } from "@/lib/errors";
import { MOCK_MR_AUTHORED, MOCK_MR_TO_REVIEW } from "@/test/fixtures/mr-summary.fixture";

let capturedOnEvent: (type: SSEEventType, data: unknown) => void;
let mockIsDisplaced = false;

vi.mock("../use-sse", () => ({
  useSSE: vi.fn(({ onEvent }: { onEvent: (type: SSEEventType, data: unknown) => void }) => {
    capturedOnEvent = onEvent;
    return { isDisplaced: mockIsDisplaced };
  }),
}));

// Import after mock setup
const { useMRList } = await import("../use-mr-list");

describe("useMRList", () => {
  beforeEach(() => {
    mockIsDisplaced = false;
  });

  it("returns correct initial state", () => {
    const { result } = renderHook(() => useMRList());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.mrs).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.connectionHealth).toBe("connected");
  });

  it("sets isLoading false and connectionHealth connected on status ready", () => {
    const { result } = renderHook(() => useMRList());

    act(() => {
      capturedOnEvent("status", { state: "ready" });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.connectionHealth).toBe("connected");
  });

  it("sets connectionHealth degraded on status degraded", () => {
    const { result } = renderHook(() => useMRList());

    act(() => {
      capturedOnEvent("status", { state: "degraded" });
    });

    expect(result.current.connectionHealth).toBe("degraded");
  });

  it("populates mrs and sets isLoading false on mr-list event", () => {
    const { result } = renderHook(() => useMRList());
    const mrList = [MOCK_MR_AUTHORED, MOCK_MR_TO_REVIEW];

    act(() => {
      capturedOnEvent("mr-list", mrList);
    });

    expect(result.current.mrs).toEqual(mrList);
    expect(result.current.isLoading).toBe(false);
  });

  it("appends new MR and calls onMREvent on mr-new", () => {
    const onMREvent = vi.fn();
    const { result } = renderHook(() => useMRList(onMREvent));

    act(() => {
      capturedOnEvent("mr-list", [MOCK_MR_AUTHORED]);
    });

    act(() => {
      capturedOnEvent("mr-new", MOCK_MR_TO_REVIEW);
    });

    expect(result.current.mrs).toHaveLength(2);
    expect(result.current.mrs[1]).toEqual(MOCK_MR_TO_REVIEW);
    expect(onMREvent).toHaveBeenCalledWith({ type: "mr-new", data: MOCK_MR_TO_REVIEW });
  });

  it("replaces matching MR by id on mr-update", () => {
    const onMREvent = vi.fn();
    const { result } = renderHook(() => useMRList(onMREvent));

    act(() => {
      capturedOnEvent("mr-list", [MOCK_MR_AUTHORED, MOCK_MR_TO_REVIEW]);
    });

    const updatedMR = { ...MOCK_MR_AUTHORED, title: "Updated title" };
    act(() => {
      capturedOnEvent("mr-update", updatedMR);
    });

    expect(result.current.mrs[0].title).toBe("Updated title");
    expect(result.current.mrs).toHaveLength(2);
    expect(onMREvent).toHaveBeenCalledWith({ type: "mr-update", data: updatedMR });
  });

  it("filters out MR by id on mr-removed", () => {
    const onMREvent = vi.fn();
    const { result } = renderHook(() => useMRList(onMREvent));

    act(() => {
      capturedOnEvent("mr-list", [MOCK_MR_AUTHORED, MOCK_MR_TO_REVIEW]);
    });

    act(() => {
      capturedOnEvent("mr-removed", { id: MOCK_MR_AUTHORED.id });
    });

    expect(result.current.mrs).toHaveLength(1);
    expect(result.current.mrs[0].id).toBe(MOCK_MR_TO_REVIEW.id);
    expect(onMREvent).toHaveBeenCalledWith({ type: "mr-removed", data: { id: MOCK_MR_AUTHORED.id } });
  });

  it("fires onMREvent on mr-ready-to-merge without changing list", () => {
    const onMREvent = vi.fn();
    const { result } = renderHook(() => useMRList(onMREvent));

    act(() => {
      capturedOnEvent("mr-list", [MOCK_MR_AUTHORED]);
    });

    act(() => {
      capturedOnEvent("mr-ready-to-merge", MOCK_MR_AUTHORED);
    });

    expect(result.current.mrs).toHaveLength(1);
    expect(onMREvent).toHaveBeenCalledWith({ type: "mr-ready-to-merge", data: MOCK_MR_AUTHORED });
  });

  it("fires onMREvent on mr-detail-update", () => {
    const onMREvent = vi.fn();
    renderHook(() => useMRList(onMREvent));

    const detailData = { mr: { id: 1 }, approvals: { approved: true } };
    act(() => {
      capturedOnEvent("mr-detail-update", detailData);
    });

    expect(onMREvent).toHaveBeenCalledWith({ type: "mr-detail-update", data: detailData });
  });

  it("sets custom error message for gitlab_group_unavailable error", () => {
    const onMREvent = vi.fn();
    const { result } = renderHook(() => useMRList(onMREvent));

    act(() => {
      capturedOnEvent("error", { code: SSE_ERROR_GITLAB_GROUP_UNAVAILABLE, message: "group not found" });
    });

    expect(result.current.error).toBe(
      "Could not load merge requests because the configured GitLab group is not accessible. Verify GITLAB_GROUP_ID and your GitLab permissions.",
    );
    expect(result.current.connectionHealth).toBe("error");
    expect(result.current.isLoading).toBe(false);
    expect(onMREvent).toHaveBeenCalledWith({
      type: "error",
      data: { code: SSE_ERROR_GITLAB_GROUP_UNAVAILABLE, message: "group not found" },
    });
  });

  it("uses data.message for non-group-unavailable errors", () => {
    const onMREvent = vi.fn();
    const { result } = renderHook(() => useMRList(onMREvent));

    act(() => {
      capturedOnEvent("error", { code: "some_other_error", message: "Something went wrong" });
    });

    expect(result.current.error).toBe("Something went wrong");
    expect(result.current.connectionHealth).toBe("error");
  });

  it("fires onMREvent on warning", () => {
    const onMREvent = vi.fn();
    renderHook(() => useMRList(onMREvent));

    act(() => {
      capturedOnEvent("warning", { code: "poll_failed", message: "Poll failed" });
    });

    expect(onMREvent).toHaveBeenCalledWith({
      type: "warning",
      data: { code: "poll_failed", message: "Poll failed" },
    });
  });

  it("fires onMREvent on session-displaced and reflects isDisplaced", () => {
    mockIsDisplaced = true;
    const onMREvent = vi.fn();
    const { result } = renderHook(() => useMRList(onMREvent));

    act(() => {
      capturedOnEvent("session-displaced", { code: "session_displaced", message: "displaced" });
    });

    expect(onMREvent).toHaveBeenCalledWith({
      type: "session-displaced",
      data: { code: "session_displaced", message: "displaced" },
    });
    expect(result.current.isDisplaced).toBe(true);
  });
});
