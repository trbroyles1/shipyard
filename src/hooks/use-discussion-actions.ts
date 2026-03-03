"use client";

import { useCallback } from "react";
import { apiFetch, throwResponseError } from "@/lib/client-errors";
import { mrApiPath } from "@/lib/api-path";
import { FALLBACK_ERROR_MESSAGE } from "@/lib/constants";
import type { GitLabDiffPosition } from "@/lib/types/gitlab";

interface UseDiscussionActionsOptions {
  projectId: number;
  iid: number;
  onRefetch: () => Promise<void>;
  addToast: (title: string, message: string, type?: "info" | "success" | "warning" | "error") => void;
}

/**
 * Shared discussion action handlers for reply, resolve, and new comment.
 * Extracted from ChangesTab and DiscussionsTab to eliminate duplication.
 */
export function useDiscussionActions({ projectId, iid, onRefetch, addToast }: UseDiscussionActionsOptions) {
  const base = mrApiPath(projectId, iid);

  const handleReply = useCallback(async (discussionId: string, body: string) => {
    try {
      const res = await apiFetch(`${base}/discussions/${discussionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) await throwResponseError(res);
      await onRefetch();
    } catch (err) {
      addToast("Reply failed", err instanceof Error ? err.message : FALLBACK_ERROR_MESSAGE, "error");
      throw err;
    }
  }, [base, onRefetch, addToast]);

  const handleResolve = useCallback(async (discussionId: string, resolved: boolean) => {
    try {
      const res = await apiFetch(`${base}/discussions/${discussionId}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      if (!res.ok) await throwResponseError(res);
      await onRefetch();
    } catch (err) {
      addToast("Resolve failed", err instanceof Error ? err.message : FALLBACK_ERROR_MESSAGE, "error");
    }
  }, [base, onRefetch, addToast]);

  const handleNewComment = useCallback(async (body: string, position?: GitLabDiffPosition) => {
    try {
      const payload: Record<string, unknown> = { body };
      if (position) payload.position = position;
      const res = await apiFetch(`${base}/discussions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) await throwResponseError(res);
      await onRefetch();
    } catch (err) {
      addToast("Comment failed", err instanceof Error ? err.message : FALLBACK_ERROR_MESSAGE, "error");
      throw err;
    }
  }, [base, onRefetch, addToast]);

  return { handleReply, handleResolve, handleNewComment };
}
