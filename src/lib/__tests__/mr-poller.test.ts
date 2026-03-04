import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { createMockLogger } from "./test-utils";
import {
  MOCK_MERGE_REQUEST,
  MOCK_MERGE_REQUEST_MINIMAL,
} from "./fixtures/gitlab-mr.fixture";
import { MOCK_APPROVALS, MOCK_APPROVALS_EMPTY } from "./fixtures/gitlab-approvals.fixture";
import type { GitLabApiError } from "@/lib/errors";
import type { PollerHandle } from "@/lib/mr-poller";

vi.mock("@/lib/gitlab-client");
vi.mock("@/lib/viewed-mr-store");
vi.mock("@/lib/logger", () => ({
  createLogger: () => createMockLogger(),
}));

interface SSEEvent {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

type EmitFn = Mock;

function emittedEvents(emit: EmitFn): SSEEvent[] {
  return emit.mock.calls.map((call: unknown[]) => call[0] as SSEEvent);
}

function eventsOfType(emit: EmitFn, type: string): SSEEvent[] {
  return emittedEvents(emit).filter((e) => e.type === type);
}

const TOKEN = "test-token";
const USER_ID = 1;

/**
 * These tests exercise the startPoller loop from mr-poller.ts.
 *
 * POLL_INTERVAL_MS is evaluated at module load time from env.MR_POLL_INTERVAL,
 * so the env var must be set before the module is first imported. We use
 * vi.resetModules() + dynamic import() to ensure a fresh module evaluation
 * with the right env. GitLabApiError must also be dynamically imported from the
 * same module graph so that `instanceof` checks inside mr-poller work.
 *
 * Each test gets its own poller instance. We must stop old pollers and fully
 * drain their in-flight async work before starting a new test, otherwise
 * leaked poll() calls accumulate on the shared mock functions.
 */
describe("mr-poller", () => {
  let startPoller: (
    token: string,
    userId: number | undefined,
    expiresAt: number,
    emit: (event: unknown) => void,
  ) => PollerHandle;
  let DynamicGitLabApiError: typeof GitLabApiError;
  let gitlabFetchAllPages: Mock;
  let gitlabFetch: Mock;
  let getViewedMR: Mock;
  let handle: PollerHandle | null;
  let emit: EmitFn;
  let expiresAt: number;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllTimers();

    process.env.MR_POLL_INTERVAL = "1";
    process.env.GITLAB_URL = "https://gitlab.test";
    process.env.GITLAB_GROUP_ID = "99";

    vi.resetModules();

    const pollerMod = await import("@/lib/mr-poller");
    const clientMod = await import("@/lib/gitlab-client");
    const viewedMod = await import("@/lib/viewed-mr-store");
    const errorsMod = await import("@/lib/errors");

    startPoller = pollerMod.startPoller;
    DynamicGitLabApiError = errorsMod.GitLabApiError;
    gitlabFetchAllPages = clientMod.gitlabFetchAllPages as Mock;
    gitlabFetch = clientMod.gitlabFetch as Mock;
    getViewedMR = viewedMod.getViewedMR as Mock;

    // Clear any call history from leaked pollers of prior tests, then configure
    gitlabFetchAllPages.mockClear();
    gitlabFetch.mockClear();
    getViewedMR.mockClear();

    getViewedMR.mockReturnValue(undefined);
    gitlabFetchAllPages.mockResolvedValue([]);
    gitlabFetch.mockResolvedValue({});

    emit = vi.fn();
    expiresAt = Math.floor(Date.now() / 1000) + 3600;
    handle = null;
  });

  afterEach(async () => {
    // Stop the poller — this sets stopped=true and clears the pending timer
    handle?.stop();
    handle = null;

    // Drain any in-flight poll() promises. The stopped flag prevents new timers
    // from being scheduled, but we need to let currently-awaiting polls resolve.
    // Running all timers will drain both macrotasks and associated microtasks.
    await vi.runAllTimersAsync();

    vi.useRealTimers();
    delete process.env.MR_POLL_INTERVAL;
    delete process.env.GITLAB_URL;
    delete process.env.GITLAB_GROUP_ID;
  });

  // ---------------------------------------------------------------------------
  // First poll (hydration)
  // ---------------------------------------------------------------------------

  describe("first poll (hydration)", () => {
    it("emits hydrating, ready, and mr-list with MRs", async () => {
      gitlabFetchAllPages.mockResolvedValue([
        MOCK_MERGE_REQUEST,
        MOCK_MERGE_REQUEST_MINIMAL,
      ]);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);

      const events = emittedEvents(emit);
      expect(events[0]).toEqual({ type: "status", data: { state: "hydrating" } });
      expect(events[1]).toEqual({ type: "status", data: { state: "ready" } });
      expect(events[2].type).toBe("mr-list");
      expect(events[2].data).toHaveLength(2);
    });

    it("emits mr-list with empty array for empty group", async () => {
      gitlabFetchAllPages.mockResolvedValue([]);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);

      const events = emittedEvents(emit);
      expect(events[0]).toEqual({ type: "status", data: { state: "hydrating" } });
      expect(events[1]).toEqual({ type: "status", data: { state: "ready" } });
      expect(events[2]).toEqual({ type: "mr-list", data: [] });
    });
  });

  // ---------------------------------------------------------------------------
  // Subsequent polls (diff detection)
  // ---------------------------------------------------------------------------

  describe("subsequent polls (diff detection)", () => {
    it("emits nothing when MRs are unchanged", async () => {
      gitlabFetchAllPages.mockResolvedValue([MOCK_MERGE_REQUEST]);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);
      emit.mockClear();

      await vi.advanceTimersByTimeAsync(1000);

      expect(emittedEvents(emit)).toHaveLength(0);
    });

    it("emits mr-update when MR has changed", async () => {
      gitlabFetchAllPages.mockResolvedValue([MOCK_MERGE_REQUEST]);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);
      emit.mockClear();

      gitlabFetchAllPages.mockResolvedValue([
        { ...MOCK_MERGE_REQUEST, updated_at: "2025-02-01T00:00:00Z" },
      ]);
      await vi.advanceTimersByTimeAsync(1000);

      const updates = eventsOfType(emit, "mr-update");
      expect(updates).toHaveLength(1);
      expect(updates[0].data.id).toBe(MOCK_MERGE_REQUEST.id);
    });

    it("emits mr-new when a new MR appears", async () => {
      gitlabFetchAllPages.mockResolvedValue([MOCK_MERGE_REQUEST]);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);
      emit.mockClear();

      gitlabFetchAllPages.mockResolvedValue([
        MOCK_MERGE_REQUEST,
        MOCK_MERGE_REQUEST_MINIMAL,
      ]);
      await vi.advanceTimersByTimeAsync(1000);

      const newEvents = eventsOfType(emit, "mr-new");
      expect(newEvents).toHaveLength(1);
      expect(newEvents[0].data.id).toBe(MOCK_MERGE_REQUEST_MINIMAL.id);
    });

    it("emits mr-removed when an MR disappears", async () => {
      gitlabFetchAllPages.mockResolvedValue([
        MOCK_MERGE_REQUEST,
        MOCK_MERGE_REQUEST_MINIMAL,
      ]);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);
      emit.mockClear();

      gitlabFetchAllPages.mockResolvedValue([MOCK_MERGE_REQUEST]);
      await vi.advanceTimersByTimeAsync(1000);

      const removed = eventsOfType(emit, "mr-removed");
      expect(removed).toHaveLength(1);
      expect(removed[0].data).toEqual({ id: MOCK_MERGE_REQUEST_MINIMAL.id });
    });

    it("emits mr-ready-to-merge and mr-update when non-draft MR becomes mergeable", async () => {
      const notApproved = {
        ...MOCK_MERGE_REQUEST,
        detailed_merge_status: "not_approved",
        draft: false,
      };
      gitlabFetchAllPages.mockResolvedValue([notApproved]);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);
      emit.mockClear();

      const nowMergeable = {
        ...notApproved,
        detailed_merge_status: "mergeable",
        updated_at: "2025-02-01T00:00:00Z",
      };
      gitlabFetchAllPages.mockResolvedValue([nowMergeable]);
      await vi.advanceTimersByTimeAsync(1000);

      const events = emittedEvents(emit);
      const readyIdx = events.findIndex((e) => e.type === "mr-ready-to-merge");
      const updateIdx = events.findIndex((e) => e.type === "mr-update");
      expect(readyIdx).toBeGreaterThanOrEqual(0);
      expect(updateIdx).toBeGreaterThanOrEqual(0);
      expect(readyIdx).toBeLessThan(updateIdx);
    });

    it("does not emit mr-ready-to-merge when draft MR becomes mergeable", async () => {
      const draftNotApproved = {
        ...MOCK_MERGE_REQUEST,
        detailed_merge_status: "not_approved",
        draft: true,
      };
      gitlabFetchAllPages.mockResolvedValue([draftNotApproved]);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);
      emit.mockClear();

      const draftMergeable = {
        ...draftNotApproved,
        detailed_merge_status: "mergeable",
        updated_at: "2025-02-01T00:00:00Z",
      };
      gitlabFetchAllPages.mockResolvedValue([draftMergeable]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(eventsOfType(emit, "mr-ready-to-merge")).toHaveLength(0);
      expect(eventsOfType(emit, "mr-update")).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Viewed MR approval polling
  // ---------------------------------------------------------------------------

  describe("viewed MR approval polling", () => {
    const VIEWED = { projectId: 42, iid: 17 };

    function setupApprovalMocks(
      mr = MOCK_MERGE_REQUEST,
      approvals = MOCK_APPROVALS,
    ) {
      getViewedMR.mockReturnValue(VIEWED);
      gitlabFetch.mockImplementation((path: string) => {
        if (path.includes("/approvals")) return Promise.resolve(approvals);
        return Promise.resolve(mr);
      });
    }

    it("initializes approval key without emitting mr-detail-update on first poll", async () => {
      gitlabFetchAllPages.mockResolvedValue([MOCK_MERGE_REQUEST]);
      setupApprovalMocks();

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);

      expect(eventsOfType(emit, "mr-detail-update")).toHaveLength(0);
    });

    it("emits mr-detail-update when approval key changes", async () => {
      gitlabFetchAllPages.mockResolvedValue([MOCK_MERGE_REQUEST]);
      setupApprovalMocks();

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);
      emit.mockClear();

      setupApprovalMocks(MOCK_MERGE_REQUEST, MOCK_APPROVALS_EMPTY);
      await vi.advanceTimersByTimeAsync(1000);

      const detailUpdates = eventsOfType(emit, "mr-detail-update");
      expect(detailUpdates).toHaveLength(1);
      expect(detailUpdates[0].data.approvals).toEqual(MOCK_APPROVALS_EMPTY);
    });

    it("does not emit mr-detail-update when approval key is unchanged", async () => {
      gitlabFetchAllPages.mockResolvedValue([MOCK_MERGE_REQUEST]);
      setupApprovalMocks();

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);
      emit.mockClear();

      await vi.advanceTimersByTimeAsync(1000);

      expect(eventsOfType(emit, "mr-detail-update")).toHaveLength(0);
    });

    it("skips approval polling when no MR is viewed", async () => {
      gitlabFetchAllPages.mockResolvedValue([MOCK_MERGE_REQUEST]);
      getViewedMR.mockReturnValue(undefined);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);

      expect(eventsOfType(emit, "mr-detail-update")).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe("error handling", () => {
    it("emits auth_expired and stops on 401", async () => {
      gitlabFetchAllPages.mockRejectedValue(
        new DynamicGitLabApiError(401, "Unauthorized", ""),
      );

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);

      const errors = eventsOfType(emit, "error");
      expect(errors).toHaveLength(1);
      expect(errors[0].data.code).toBe("auth_expired");

      emit.mockClear();
      await vi.advanceTimersByTimeAsync(5000);
      expect(emittedEvents(emit)).toHaveLength(0);
    });

    it("emits gitlab_group_unavailable and stops on 404", async () => {
      gitlabFetchAllPages.mockRejectedValue(
        new DynamicGitLabApiError(404, "Not Found", ""),
      );

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);

      const errors = eventsOfType(emit, "error");
      expect(errors).toHaveLength(1);
      expect(errors[0].data.code).toBe("gitlab_group_unavailable");

      emit.mockClear();
      await vi.advanceTimersByTimeAsync(5000);
      expect(emittedEvents(emit)).toHaveLength(0);
    });

    it("emits poll_failed warning on transient error and continues polling", async () => {
      gitlabFetchAllPages.mockRejectedValueOnce(
        new DynamicGitLabApiError(500, "Internal Server Error", ""),
      );
      gitlabFetchAllPages.mockResolvedValue([]);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);

      const warnings = eventsOfType(emit, "warning");
      expect(warnings).toHaveLength(1);
      expect(warnings[0].data.code).toBe("poll_failed");

      emit.mockClear();
      await vi.advanceTimersByTimeAsync(1000);
      // Second poll succeeds → hydration events prove the poller continued
      expect(eventsOfType(emit, "status")).toContainEqual({
        type: "status",
        data: { state: "ready" },
      });
    });

    it("emits status:degraded after 3 consecutive transient errors", async () => {
      gitlabFetchAllPages.mockRejectedValue(
        new DynamicGitLabApiError(500, "Internal Server Error", ""),
      );

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      const degraded = eventsOfType(emit, "status").filter(
        (e) => e.data.state === "degraded",
      );
      expect(degraded).toHaveLength(1);
      expect(eventsOfType(emit, "warning")).toHaveLength(3);
    });

    it("emits status:ready after recovery from degraded state", async () => {
      gitlabFetchAllPages.mockRejectedValue(
        new DynamicGitLabApiError(500, "Internal Server Error", ""),
      );

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      emit.mockClear();

      gitlabFetchAllPages.mockResolvedValue([]);
      await vi.advanceTimersByTimeAsync(1000);

      const statusEvents = eventsOfType(emit, "status");
      expect(statusEvents).toContainEqual({
        type: "status",
        data: { state: "ready" },
      });
    });

    it("emits auth_expired and stops when token is near expiry", async () => {
      const nearExpiryAt = Math.floor(Date.now() / 1000) + 60;

      handle = startPoller(TOKEN, USER_ID, nearExpiryAt, emit);
      await vi.advanceTimersByTimeAsync(0);

      const errors = eventsOfType(emit, "error");
      expect(errors).toHaveLength(1);
      expect(errors[0].data.code).toBe("auth_expired");

      emit.mockClear();
      await vi.advanceTimersByTimeAsync(5000);
      expect(emittedEvents(emit)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Poller lifecycle
  // ---------------------------------------------------------------------------

  describe("poller lifecycle", () => {
    it("stops the poll loop when handle.stop() is called", async () => {
      gitlabFetchAllPages.mockResolvedValue([MOCK_MERGE_REQUEST]);

      handle = startPoller(TOKEN, USER_ID, expiresAt, emit);
      await vi.advanceTimersByTimeAsync(0);

      handle.stop();
      emit.mockClear();

      await vi.advanceTimersByTimeAsync(10000);

      expect(emittedEvents(emit)).toHaveLength(0);
    });
  });
});
