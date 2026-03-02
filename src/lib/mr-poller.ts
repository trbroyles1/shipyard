import { gitlabFetch, gitlabFetchAllPages } from "./gitlab-client";
import { env } from "./env";
import { createLogger } from "./logger";
import { isAuthError, SSE_ERROR_AUTH_EXPIRED, SSE_WARNING_POLL_FAILED } from "./errors";
import { MRStore } from "./mr-store";
import { getViewedMR } from "./viewed-mr-store";
import type { GitLabMergeRequest, GitLabApprovals } from "./types/gitlab";
import type { MRSummary } from "./types/mr";
import { mapMRSummary } from "./types/mr";
import type {
  MRNewEvent,
  MRUpdateEvent,
  MRRemovedEvent,
  MRReadyToMergeEvent,
  MRDetailUpdateEvent,
  MRListEvent,
  StatusEvent,
  ErrorEvent,
  WarningEvent,
} from "./types/events";

const log = createLogger("mr-poller");

const POLL_INTERVAL_MS = 25_000; // 25 seconds
const DEGRADED_THRESHOLD = 3;
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

type SSEEventPayload =
  | MRListEvent
  | MRNewEvent
  | MRUpdateEvent
  | MRRemovedEvent
  | MRReadyToMergeEvent
  | MRDetailUpdateEvent
  | StatusEvent
  | ErrorEvent
  | WarningEvent;

function extractRepoSlug(webUrl: string): { slug: string; repoUrl: string } {
  const match = webUrl.match(/^(https?:\/\/[^/]+\/(.+))\/-\/merge_requests\/\d+$/);
  if (match) {
    const repoUrl = match[1];
    const fullPath = match[2];
    const slug = fullPath.split("/").pop() || fullPath;
    return { slug, repoUrl };
  }
  return { slug: "unknown", repoUrl: "" };
}

function hasChanged(a: MRSummary, b: MRSummary): boolean {
  return a.updatedAt !== b.updatedAt
    || a.detailedMergeStatus !== b.detailedMergeStatus
    || a.draft !== b.draft
    || a.title !== b.title
    || a.hasConflicts !== b.hasConflicts;
}

export interface PollerHandle {
  stop: () => void;
}

async function pollMRList(
  store: MRStore,
  token: string,
  emit: (event: SSEEventPayload) => void,
): Promise<void> {
  const mrs = await gitlabFetchAllPages<GitLabMergeRequest>(
    `/groups/${env.GITLAB_GROUP_ID}/merge_requests`,
    token,
    { state: "opened", scope: "all", include_subgroups: "true" },
  );

  const freshMap = new Map<number, MRSummary>();
  for (const mr of mrs) {
    const { slug, repoUrl } = extractRepoSlug(mr.web_url);
    freshMap.set(mr.id, mapMRSummary(mr, slug, repoUrl));
  }

  if (!store.isHydrated) {
    // First poll: populate silently, send full list
    freshMap.forEach((mr) => store.upsert(mr));
    store.markHydrated();
    emit({ type: "status", data: { state: "ready" } });
    emit({ type: "mr-list", data: store.getAll() });
    log.info(`Initial hydration complete: ${freshMap.size} MRs`);
    return;
  }

  // Diff against store
  const events: SSEEventPayload[] = [];

  // Detect new and updated MRs
  freshMap.forEach((freshMR) => {
    const existing = store.get(freshMR.id);
    if (!existing) {
      store.upsert(freshMR);
      events.push({ type: "mr-new", data: freshMR });
    } else if (hasChanged(existing, freshMR)) {
      if (
        existing.detailedMergeStatus !== "mergeable" &&
        freshMR.detailedMergeStatus === "mergeable" &&
        !freshMR.draft
      ) {
        events.push({ type: "mr-ready-to-merge", data: freshMR });
      }
      store.upsert(freshMR);
      events.push({ type: "mr-update", data: freshMR });
    }
  });

  // Detect removed MRs
  for (const existing of store.getAll()) {
    if (!freshMap.has(existing.id)) {
      store.remove(existing.id);
      events.push({ type: "mr-removed", data: { id: existing.id } });
    }
  }

  for (const event of events) {
    emit(event);
  }

  if (events.length > 0) {
    log.debug(`Poll diff: ${events.length} events emitted`);
  }
}

async function pollViewedMRApprovals(
  token: string,
  userId: number,
  emit: (event: SSEEventPayload) => void,
  lastKeyRef: { value: string },
): Promise<void> {
  const viewed = getViewedMR(userId);
  if (!viewed) {
    if (lastKeyRef.value) {
      log.debug("Viewed MR cleared — resetting approval key");
    }
    lastKeyRef.value = "";
    return;
  }

  const [mr, approvals] = await Promise.all([
    gitlabFetch<GitLabMergeRequest>(
      `/projects/${viewed.projectId}/merge_requests/${viewed.iid}?with_merge_status_recheck=true`,
      token,
    ),
    gitlabFetch<GitLabApprovals>(
      `/projects/${viewed.projectId}/merge_requests/${viewed.iid}/approvals`,
      token,
    ),
  ]);

  const approvalKey = JSON.stringify({
    approved: approvals.approved,
    approvals_left: approvals.approvals_left,
    approved_by: approvals.approved_by.map((a) => a.user.id).sort(),
    merge_status: mr.detailed_merge_status,
    state: mr.state,
    user_notes_count: mr.user_notes_count,
  });

  if (!lastKeyRef.value) {
    log.debug(`Approval key initialized for project=${viewed.projectId} iid=${viewed.iid}: ${approvalKey}`);
  } else if (approvalKey !== lastKeyRef.value) {
    log.info(`Approval key changed for project=${viewed.projectId} iid=${viewed.iid}`);
    log.debug(`  old: ${lastKeyRef.value}`);
    log.debug(`  new: ${approvalKey}`);
    emit({ type: "mr-detail-update", data: { mr, approvals } });
  } else {
    log.debug(`Approval key unchanged for project=${viewed.projectId} iid=${viewed.iid}`);
  }
  lastKeyRef.value = approvalKey;
}

/**
 * Starts a polling loop for one SSE connection. Uses the user's access token.
 * Calls `emit` with SSE events whenever the MR list changes.
 */
export function startPoller(
  token: string,
  userId: number | undefined,
  expiresAt: number,
  emit: (event: SSEEventPayload) => void,
): PollerHandle {
  const store = new MRStore();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let consecutiveErrors = 0;
  const lastApprovalKey = { value: "" };

  async function poll() {
    if (stopped) return;

    if (Date.now() > expiresAt * 1000 - TOKEN_EXPIRY_BUFFER_MS) {
      emit({ type: "error", data: { code: SSE_ERROR_AUTH_EXPIRED, message: "Token expiring, reconnect required" } });
      stopped = true;
      return;
    }

    try {
      await pollMRList(store, token, emit);
      if (consecutiveErrors >= DEGRADED_THRESHOLD) {
        emit({ type: "status", data: { state: "ready" } });
      }
      consecutiveErrors = 0;
    } catch (err) {
      if (isAuthError(err)) {
        emit({ type: "error", data: { code: SSE_ERROR_AUTH_EXPIRED, message: "Your session has expired. Please sign in again." } });
        stopped = true;
        return;
      }
      consecutiveErrors++;
      log.error(`Poll error (${consecutiveErrors}): ${err}`);
      emit({ type: "warning", data: { code: SSE_WARNING_POLL_FAILED, message: "Temporary issue reaching GitLab. Retrying..." } });
      if (consecutiveErrors >= DEGRADED_THRESHOLD) {
        emit({ type: "status", data: { state: "degraded" } });
      }
    }

    if (userId && !stopped) {
      try {
        await pollViewedMRApprovals(token, userId, emit, lastApprovalKey);
      } catch (err) {
        if (isAuthError(err)) {
          emit({ type: "error", data: { code: SSE_ERROR_AUTH_EXPIRED, message: "Your session has expired. Please sign in again." } });
          stopped = true;
          return;
        }
        log.error(`Viewed MR poll error: ${err}`);
      }
    }

    if (!stopped) {
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }

  // Start immediately
  emit({ type: "status", data: { state: "hydrating" } });
  poll();

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
