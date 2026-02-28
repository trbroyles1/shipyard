"use client";

import { useState, useEffect, useCallback } from "react";
import type { MRSummary, MRUser } from "@/lib/types/mr";
import type {
  GitLabMergeRequest,
  GitLabApprovals,
  GitLabDiffFile,
  GitLabDiscussion,
  GitLabCommit,
  GitLabPipeline,
  GitLabNote,
} from "@/lib/types/gitlab";

export interface MRDetailData {
  mr: GitLabMergeRequest;
  approvals: GitLabApprovals;
  diffs: GitLabDiffFile[];
  discussions: GitLabDiscussion[];
  commits: GitLabCommit[];
  pipelines: GitLabPipeline[];
  notes: GitLabNote[];
}

export function useMRDetail(selected: MRSummary | null) {
  const [data, setData] = useState<MRDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (mr: MRSummary) => {
    setIsLoading(true);
    setError(null);

    const base = `/api/gitlab/merge-requests/${mr.projectId}/${mr.iid}`;

    try {
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
        diffsRes.json() as Promise<GitLabDiffFile[]>,
        discussionsRes.json() as Promise<GitLabDiscussion[]>,
        commitsRes.json() as Promise<GitLabCommit[]>,
        pipelinesRes.json() as Promise<GitLabPipeline[]>,
        notesRes.json() as Promise<GitLabNote[]>,
      ]);

      setData({
        mr: detail.mr,
        approvals: detail.approvals,
        diffs,
        discussions,
        commits,
        pipelines,
        notes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MR details");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) {
      fetchDetail(selected);
    } else {
      setData(null);
    }
  }, [selected, fetchDetail]);

  return { data, isLoading, error, refetch: selected ? () => fetchDetail(selected) : undefined };
}
