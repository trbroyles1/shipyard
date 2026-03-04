// @vitest-environment jsdom
import "@/test/setup-dom";

import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApiFetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const mockThrowResponseError = vi.fn<(res: Response, fallback?: string) => Promise<never>>();

vi.mock("@/lib/client-errors", () => ({
  apiFetch: (...args: Parameters<typeof mockApiFetch>) => mockApiFetch(...args),
  throwResponseError: (...args: Parameters<typeof mockThrowResponseError>) => mockThrowResponseError(...args),
}));

import { useDiscussionActions } from "../use-discussion-actions";

const PROJECT_ID = 42;
const IID = 7;
const BASE_PATH = `/api/gitlab/merge-requests/${PROJECT_ID}/${IID}`;

describe("useDiscussionActions", () => {
  const onRefetch = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const addToast = vi.fn();

  function renderActions() {
    return renderHook(() =>
      useDiscussionActions({ projectId: PROJECT_ID, iid: IID, onRefetch, addToast }),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    onRefetch.mockResolvedValue(undefined);
    mockApiFetch.mockResolvedValue({ ok: true } as Response);
    mockThrowResponseError.mockImplementation(async () => {
      throw new Error("API error");
    });
  });

  describe("handleReply", () => {
    it("sends POST request and calls onRefetch on success", async () => {
      const { result } = renderActions();

      await result.current.handleReply("disc-1", "my reply");

      expect(mockApiFetch).toHaveBeenCalledWith(
        `${BASE_PATH}/discussions/disc-1/notes`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ body: "my reply" }),
        }),
      );
      expect(onRefetch).toHaveBeenCalled();
    });

    it("calls addToast and re-throws on failure", async () => {
      mockApiFetch.mockResolvedValue({ ok: false, status: 500 } as Response);

      const { result } = renderActions();

      await expect(result.current.handleReply("disc-1", "reply")).rejects.toThrow("API error");

      expect(addToast).toHaveBeenCalledWith("Reply failed", "API error", "error");
    });
  });

  describe("handleResolve", () => {
    it("sends PUT request and calls onRefetch on success", async () => {
      const { result } = renderActions();

      await result.current.handleResolve("disc-2", true);

      expect(mockApiFetch).toHaveBeenCalledWith(
        `${BASE_PATH}/discussions/disc-2/resolve`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ resolved: true }),
        }),
      );
      expect(onRefetch).toHaveBeenCalled();
    });

    it("calls addToast but does NOT re-throw on failure", async () => {
      mockApiFetch.mockResolvedValue({ ok: false, status: 500 } as Response);

      const { result } = renderActions();

      // Should not throw
      await result.current.handleResolve("disc-2", false);

      expect(addToast).toHaveBeenCalledWith("Resolve failed", "API error", "error");
      expect(onRefetch).not.toHaveBeenCalled();
    });
  });

  describe("handleNewComment", () => {
    it("sends POST to discussions endpoint with body", async () => {
      const { result } = renderActions();

      await result.current.handleNewComment("new comment");

      expect(mockApiFetch).toHaveBeenCalledWith(
        `${BASE_PATH}/discussions`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ body: "new comment" }),
        }),
      );
      expect(onRefetch).toHaveBeenCalled();
    });

    it("includes position when provided", async () => {
      const { result } = renderActions();
      const position = {
        position_type: "text" as const,
        base_sha: "abc",
        head_sha: "def",
        start_sha: "ghi",
        old_path: "file.ts",
        new_path: "file.ts",
        old_line: null,
        new_line: 10,
      };

      await result.current.handleNewComment("line comment", position);

      expect(mockApiFetch).toHaveBeenCalledWith(
        `${BASE_PATH}/discussions`,
        expect.objectContaining({
          body: JSON.stringify({ body: "line comment", position }),
        }),
      );
    });

    it("calls addToast and re-throws on failure", async () => {
      mockApiFetch.mockResolvedValue({ ok: false, status: 422 } as Response);

      const { result } = renderActions();

      await expect(result.current.handleNewComment("comment")).rejects.toThrow("API error");

      expect(addToast).toHaveBeenCalledWith("Comment failed", "API error", "error");
    });
  });
});
