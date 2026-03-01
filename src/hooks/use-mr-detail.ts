"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppState } from "@/components/providers/AppStateProvider";
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
}

export function useMRDetail(selected: MRSummary | null, detailVersion = 0) {
  const { detailPatchVersion, consumeDetailPatch } = useAppState();
  const [data, setData] = useState<MRDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (mr: MRSummary) => {
    const base = `/api/gitlab/merge-requests/${mr.projectId}/${mr.iid}`;

    const [detailRes, diffsRes, discussionsRes, commitsRes, pipelinesRes, notesRes] =
      await Promise.all([
        fetch(base),
        fetch(`${base}/changes`),
        fetch(`${base}/discussions`),
        fetch(`${base}/commits`),
        fetch(`${base}/pipelines`),
        fetch(`${base}/notes`),
      ]);

    for (const res of [detailRes, diffsRes, discussionsRes, commitsRes, pipelinesRes, notesRes]) {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status} on ${res.url}`);
      }
    }

    const [detail, diffs, discussions, commits, pipelines, notes] = await Promise.all([
      detailRes.json() as Promise<{ mr: GitLabMergeRequest; approvals: GitLabApprovals }>,
      diffsRes.json() as Promise<EnrichedDiffFile[]>,
      discussionsRes.json() as Promise<GitLabDiscussion[]>,
      commitsRes.json() as Promise<GitLabCommit[]>,
      pipelinesRes.json() as Promise<GitLabPipeline[]>,
      notesRes.json() as Promise<GitLabNote[]>,
    ]);

    return {
      mr: detail.mr,
      approvals: detail.approvals,
      diffs,
      discussions,
      commits,
      pipelines,
      notes,
    };
  }, []);

  const fetchDetail = useCallback(async (mr: MRSummary) => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchAll(mr));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MR details");
    } finally {
      setIsLoading(false);
    }
  }, [fetchAll]);

  const silentRefetch = useCallback(async (mr: MRSummary) => {
    try {
      setData(await fetchAll(mr));
    } catch {
      // Silent — don't overwrite existing data on transient errors
    }
  }, [fetchAll]);

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
    if (detailVersion > 0 && selected) {
      silentRefetch(selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailVersion]);

  // Apply mr+approvals patch from SSE detail-update, then full refetch for discussions etc.
  useEffect(() => {
    if (detailPatchVersion === 0) return;
    const patch = consumeDetailPatch();
    if (!patch) return;
    // Immediately patch mr+approvals for snappy approval state updates
    setData((prev) => (prev ? { ...prev, mr: patch.mr, approvals: patch.approvals } : prev));
    // Full refetch to pick up discussion/note changes (e.g. new replies)
    if (selected) silentRefetch(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailPatchVersion]);

  const refetch = useCallback(async () => {
    if (selected) await silentRefetch(selected);
  }, [selected, silentRefetch]);

  return { data, isLoading, error, refetch };
}
