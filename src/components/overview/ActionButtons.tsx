"use client";

import { useState, useCallback } from "react";
import type { GitLabMergeRequest, GitLabApprovals } from "@/lib/types/gitlab";
import { useToastContext } from "@/components/providers/ToastProvider";
import { MergeDialog } from "./MergeDialog";
import styles from "./ActionButtons.module.css";

interface Props {
  mr: GitLabMergeRequest;
  approvals: GitLabApprovals;
  currentUserId: number | undefined;
  onRefetch: () => Promise<void>;
}

export function ActionButtons({ mr, approvals, currentUserId, onRefetch }: Props) {
  const { addToast } = useToastContext();
  const [approving, setApproving] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const hasApproved = currentUserId != null && approvals.approved_by.some((a) => a.user.id === currentUserId);
  const mergeable = mr.detailed_merge_status === "mergeable" && !mr.draft;
  const base = `/api/gitlab/merge-requests/${mr.project_id}/${mr.iid}`;

  const handleApproveToggle = useCallback(async () => {
    setApproving(true);
    try {
      const endpoint = hasApproved ? `${base}/unapprove` : `${base}/approve`;
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      addToast(hasApproved ? "Unapproved" : "Approved", `!${mr.iid} ${mr.title}`, "success");
      await onRefetch();
    } catch (err) {
      addToast("Error", err instanceof Error ? err.message : "Action failed", "warning");
    } finally {
      setApproving(false);
    }
  }, [hasApproved, base, mr.iid, mr.title, addToast, onRefetch]);

  return (
    <div className={styles.actions}>
      <button
        className={`${styles.btn} ${hasApproved ? styles.unapprove : styles.approve}`}
        onClick={handleApproveToggle}
        disabled={approving}
      >
        {approving ? (
          <span className={styles.spinner} />
        ) : hasApproved ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l5 5L21 4"/><line x1="3" y1="12" x2="8" y2="17"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        )}
        {hasApproved ? "Unapprove" : "Approve"}
      </button>
      <button className={`${styles.btn} ${styles.requestChanges}`} disabled title="Requires GraphQL — coming soon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Request Changes
      </button>
      <div className={styles.mergeWrap}>
        <button
          className={`${styles.btn} ${styles.merge}`}
          disabled={!mergeable}
          title={!mergeable ? `Not mergeable: ${mr.detailed_merge_status}${mr.draft ? " (draft)" : ""}` : "Merge this MR"}
          onClick={() => setMergeOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
          {mergeable ? "Merge" : "Not Mergeable"}
        </button>
        {mergeOpen && (
          <MergeDialog
            mr={mr}
            onClose={() => setMergeOpen(false)}
            onRefetch={onRefetch}
          />
        )}
      </div>
      <a
        href={mr.web_url}
        target="_blank"
        rel="noreferrer"
        className={`${styles.btn} ${styles.external}`}
      >
        Open in GitLab
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>
  );
}
