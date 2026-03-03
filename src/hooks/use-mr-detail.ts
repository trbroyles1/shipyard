"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDetailPatch } from "@/components/providers/DetailPatchProvider";
import { apiFetch } from "@/lib/client-errors";
import { mrApiPath } from "@/lib/api-path";
import { createLogger } from "@/lib/logger";
import type { MRSummary } from "@/lib/types/mr";
import type {
  GitLabMergeRequest,
  GitLabApprovals,
  EnrichedDiffFile,
  GitLabDiscussion,
  GitLabCommit,
  GitLabPipeline,
  GitLabNote,
} from "@/lib/types/gitlab";

export interface MRDetailData {
  mr: GitLabMergeRequest;
  approvals: GitLabApprovals;
  diffs: EnrichedDiffFile[];
  discussions: GitLabDiscussion[];
  commits: GitLabCommit[];
  pipelines: GitLabPipeline[];
  notes: GitLabNote[];
  partialErrors?: string[];
}

const log = createLogger("use-mr-detail");

const DETAIL_FAILED_MSG = "Failed to load MR details";

/** Extracts the critical MR detail + approvals from index 0. Throws on failure. */
async function fetchCriticalDetail(
  results: PromiseSettledResult<Response>[],
): Promise<{ mr: GitLabMergeRequest; approvals: GitLabApprovals }> {
  const detailResult = results[0];
  if (detailResult.status === "rejected") {
    throw new Error(detailResult.reason?.message || DETAIL_FAILED_MSG);
  }
  const detailRes = detailResult.value;
  if (!detailRes.ok) {
    const body = await detailRes.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${detailRes.status}`);
  }
  return (await detailRes.json()) as {
    mr: GitLabMergeRequest;
    approvals: GitLabApprovals;
  };
}

const TAB_NAMES = ["changes", "discussions", "commits", "pipelines", "notes"] as const;

/** Extracts tab data from indices 1-5 with graceful degradation for failures. */
async function fetchTabData(
  results: PromiseSettledResult<Response>[],
): Promise<{
  diffs: EnrichedDiffFile[];
  discussions: GitLabDiscussion[];
  commits: GitLabCommit[];
  pipelines: GitLabPipeline[];
  notes: GitLabNote[];
  partialErrors: string[] | undefined;
}> {
  const errors: string[] = [];

  async function extract<T>(index: number, name: string, fallback: T): Promise<T> {
    const result = results[index];
    if (result.status === "rejected") {
      errors.push(`Failed to load ${name}`);
      return fallback;
    }
    const res = result.value;
    if (!res.ok) {
      errors.push(`Failed to load ${name}`);
      return fallback;
    }
    try {
      return (await res.json()) as T;
    } catch {
      errors.push(`Failed to parse ${name}`);
      return fallback;
    }
  }

  const [diffs, discussions, commits, pipelines, notes] = await Promise.all([
    extract<EnrichedDiffFile[]>(1, TAB_NAMES[0], []),
    extract<GitLabDiscussion[]>(2, TAB_NAMES[1], []),
    extract<GitLabCommit[]>(3, TAB_NAMES[2], []),
    extract<GitLabPipeline[]>(4, TAB_NAMES[3], []),
    extract<GitLabNote[]>(5, TAB_NAMES[4], []),
  ]);

  return {
    diffs,
    discussions,
    commits,
    pipelines,
    notes,
    partialErrors: errors.length > 0 ? errors : undefined,
  };
}

export function useMRDetail(selected: MRSummary | null, detailVersion = 0) {
  const { detailPatchVersion, consumeAllDetailPatches } = useDetailPatch();
  const [data, setData] = useState<MRDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to `selected` so effects that intentionally trigger on other
  // deps can read the latest value without re-firing when the object changes.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const fetchAll = useCallback(async (mr: MRSummary): Promise<MRDetailData> => {
    const base = mrApiPath(mr.projectId, mr.iid);

    const results = await Promise.allSettled([
      apiFetch(base),
      apiFetch(`${base}/changes`),
      apiFetch(`${base}/discussions`),
      apiFetch(`${base}/commits`),
      apiFetch(`${base}/pipelines`),
      apiFetch(`${base}/notes`),
    ]);

    const { mr: detailMR, approvals } = await fetchCriticalDetail(results);
    const tabData = await fetchTabData(results);

    return { mr: detailMR, approvals, ...tabData };
  }, []);

  const fetchDetail = useCallback(
    async (mr: MRSummary) => {
      setIsLoading(true);
      setError(null);
      try {
        setData(await fetchAll(mr));
      } catch (err) {
        setError(err instanceof Error ? err.message : DETAIL_FAILED_MSG);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchAll],
  );

  const silentRefetch = useCallback(
    async (mr: MRSummary) => {
      try {
        setData(await fetchAll(mr));
      } catch {
        // Silent — don't overwrite existing data on transient errors
      }
    },
    [fetchAll],
  );

  // Full fetch when the selected MR changes (keyed on ID only so object
  // identity changes from SSE patches don't trigger a full reload).
  // Intentionally depend on `selected?.id` instead of `selected` object identity.

  useEffect(() => {
    if (selected) {
      fetchDetail(selected);
    } else {
      setData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, fetchDetail]);

  // Silent re-fetch when detailVersion bumps (live update, no loading spinner)
  useEffect(() => {
    if (detailVersion > 0 && selectedRef.current) {
      silentRefetch(selectedRef.current);
    }
  }, [detailVersion, silentRefetch]);

  // Apply mr+approvals patch from SSE detail-update, then full refetch for discussions etc.
  useEffect(() => {
    if (detailPatchVersion === 0) return;
    const patches = consumeAllDetailPatches();
    log.debug(
      `detailPatchVersion=${detailPatchVersion}, patches=${patches.length}`,
    );
    if (patches.length === 0) return;
    // Apply the latest patch for snappy approval state updates
    const latest = patches[patches.length - 1];
    log.debug(
      `Applying patch: approved_by=${latest.approvals.approved_by.map((a) => a.user.id)}`,
    );
    setData((prev) => (prev ? { ...prev, mr: latest.mr, approvals: latest.approvals } : prev));
    // Full refetch to pick up discussion/note changes (e.g. new replies)
    if (selectedRef.current) silentRefetch(selectedRef.current);
  }, [detailPatchVersion, consumeAllDetailPatches, silentRefetch]);

  const refetch = useCallback(async () => {
    if (selected) await silentRefetch(selected);
  }, [selected, silentRefetch]);

  return { data, isLoading, error, refetch };
}
