import type { MRSummary } from "./mr";

export type SSEEventType =
  | "mr-list"
  | "mr-new"
  | "mr-update"
  | "mr-removed"
  | "mr-ready-to-merge"
  | "status";

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

export interface StatusEvent {
  type: "status";
  data: { state: "hydrating" | "ready" };
}
