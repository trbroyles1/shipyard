import type { MRSummary } from "./mr";
import type { GitLabMergeRequest, GitLabApprovals } from "./gitlab";

export type SSEEventType =
  | "mr-list"
  | "mr-new"
  | "mr-update"
  | "mr-removed"
  | "mr-ready-to-merge"
  | "mr-detail-update"
  | "status"
  | "error"
  | "warning"
  | "session-displaced";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

export interface MRListEvent {
  type: "mr-list";
  data: MRSummary[];
}

export interface MRNewEvent {
  type: "mr-new";
  data: MRSummary;
}

export interface MRUpdateEvent {
  type: "mr-update";
  data: MRSummary;
}

export interface MRRemovedEvent {
  type: "mr-removed";
  data: { id: number };
}

export interface MRReadyToMergeEvent {
  type: "mr-ready-to-merge";
  data: MRSummary;
}

export interface MRDetailUpdateEvent {
  type: "mr-detail-update";
  data: { mr: GitLabMergeRequest; approvals: GitLabApprovals };
}

export interface StatusEvent {
  type: "status";
  data: { state: "hydrating" | "ready" | "degraded" };
}

export interface ErrorEvent {
  type: "error";
  data: { code: string; message: string };
}

export interface WarningEvent {
  type: "warning";
  data: { code: string; message: string };
}
