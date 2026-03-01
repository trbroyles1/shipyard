import { gitlabFetch, gitlabFetchAllPages } from "./gitlab-client";
import { env } from "./env";
import { createLogger } from "./logger";
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
} from "./types/events";

const log = createLogger("mr-poller");

const POLL_INTERVAL_MS = 25_000; // 25 seconds

type SSEEventPayload =
  | MRListEvent
  | MRNewEvent
  | MRUpdateEvent
  | MRRemovedEvent
  | MRReadyToMergeEvent
  | MRDetailUpdateEvent
  | StatusEvent;

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

/**
 * Starts a polling loop for one SSE connection. Uses the user's access token.
 * Calls `emit` with SSE events whenever the MR list changes.
 */
export function startPoller(
  token: string,
  userId: number | undefined,
  emit: (event: SSEEventPayload) => void,
): PollerHandle {
  const store = new MRStore();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  // Track last-known approval state for the viewed MR to detect changes
  let lastApprovalKey = "";

  async function poll() {
    if (stopped) return;

    try {
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
      } else {
        // Diff against store
        const events: SSEEventPayload[] = [];

        // Detect new and updated MRs
        freshMap.forEach((freshMR) => {
          const existing = store.get(freshMR.id);
          if (!existing) {
            store.upsert(freshMR);
            events.push({ type: "mr-new", data: freshMR });
          } else if (hasChanged(existing, freshMR)) {
            // Check for status transition to mergeable
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

        // Emit events
        for (const event of events) {
          emit(event);
        }

        if (events.length > 0) {
          log.debug(`Poll diff: ${events.length} events emitted`);
        }
      }
    } catch (err) {
      log.error(`Poll error: ${err}`);
    }

    // Poll approval state for the currently-viewed MR
    if (userId) {
      try {
        const viewed = getViewedMR(userId);
        if (viewed) {
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

          // Build a lightweight fingerprint to detect changes
          const approvalKey = JSON.stringify({
            approved: approvals.approved,
            approvals_left: approvals.approvals_left,
            approved_by: approvals.approved_by.map((a) => a.user.id).sort(),
            merge_status: mr.detailed_merge_status,
            state: mr.state,
            user_notes_count: mr.user_notes_count,
          });

          if (lastApprovalKey && approvalKey !== lastApprovalKey) {
            emit({ type: "mr-detail-update", data: { mr, approvals } });
            log.debug(`Detail update emitted for project=${viewed.projectId} iid=${viewed.iid}`);
          }
          lastApprovalKey = approvalKey;
        } else {
          lastApprovalKey = "";
        }
      } catch (err) {
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
