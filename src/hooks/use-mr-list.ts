"use client";

import { useState, useCallback, useRef } from "react";
import type { MRSummary } from "@/lib/types/mr";
import type { GitLabMergeRequest, GitLabApprovals } from "@/lib/types/gitlab";
import type { SSEEventType } from "@/lib/types/events";
import { SSE_ERROR_GITLAB_GROUP_UNAVAILABLE } from "@/lib/errors";
import { useSSE } from "./use-sse";

export type ConnectionHealth = "connected" | "degraded" | "error";

export type MREvent =
  | { type: "mr-new"; data: MRSummary }
  | { type: "mr-update"; data: MRSummary }
  | { type: "mr-removed"; data: { id: number } }
  | { type: "mr-ready-to-merge"; data: MRSummary }
  | { type: "mr-detail-update"; data: { mr: GitLabMergeRequest; approvals: GitLabApprovals } }
  | { type: "error"; data: { code: string; message: string } }
  | { type: "warning"; data: { code: string; message: string } }
  | { type: "session-displaced"; data: { code: string; message: string } };

interface UseMRListResult {
  mrs: MRSummary[];
  isLoading: boolean;
  error: string | null;
  connectionHealth: ConnectionHealth;
  isDisplaced: boolean;
}

export function useMRList(onMREvent?: (event: MREvent) => void) {
  const [mrs, setMrs] = useState<MRSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>("connected");
  const onMREventRef = useRef(onMREvent);
  onMREventRef.current = onMREvent;

  // The `data as X` casts below are safe because the data originates from
  // same-origin SSE events emitted by our own server with known schemas.
  const handleSSE = useCallback((type: SSEEventType, data: unknown) => {
    switch (type) {
      case "status": {
        const status = data as { state: string };
        if (status.state === "ready") {
          setIsLoading(false);
          setError(null);
          setConnectionHealth("connected");
        } else if (status.state === "degraded") {
          setConnectionHealth("degraded");
        }
        break;
      }
      case "mr-list": {
        const list = data as MRSummary[];
        setMrs(list);
        setIsLoading(false);
        break;
      }
      case "mr-new": {
        const mr = data as MRSummary;
        setMrs((prev) => [...prev, mr]);
        onMREventRef.current?.({ type: "mr-new", data: mr });
        break;
      }
      case "mr-update": {
        const mr = data as MRSummary;
        setMrs((prev) => prev.map((m) => (m.id === mr.id ? mr : m)));
        onMREventRef.current?.({ type: "mr-update", data: mr });
        break;
      }
      case "mr-removed": {
        const { id } = data as { id: number };
        setMrs((prev) => prev.filter((m) => m.id !== id));
        onMREventRef.current?.({ type: "mr-removed", data: { id } });
        break;
      }
      case "mr-ready-to-merge": {
        const mr = data as MRSummary;
        onMREventRef.current?.({ type: "mr-ready-to-merge", data: mr });
        break;
      }
      case "mr-detail-update": {
        const detail = data as { mr: GitLabMergeRequest; approvals: GitLabApprovals };
        onMREventRef.current?.({ type: "mr-detail-update", data: detail });
        break;
      }
      case "error": {
        const errorData = data as { code: string; message: string };
        const message = errorData.code === SSE_ERROR_GITLAB_GROUP_UNAVAILABLE
          ? "Could not load merge requests because the configured GitLab group is not accessible. Verify GITLAB_GROUP_ID and your GitLab permissions."
          : errorData.message;
        setError(message);
        setIsLoading(false);
        setConnectionHealth("error");
        onMREventRef.current?.({ type: "error", data: errorData });
        break;
      }
      case "warning": {
        const warningData = data as { code: string; message: string };
        onMREventRef.current?.({ type: "warning", data: warningData });
        break;
      }
      case "session-displaced": {
        const displacedData = data as { code: string; message: string };
        onMREventRef.current?.({ type: "session-displaced", data: displacedData });
        break;
      }
    }
  }, []);

  const { isDisplaced } = useSSE({ onEvent: handleSSE });

  return { mrs, isLoading, error, connectionHealth, isDisplaced } as UseMRListResult;
}
