"use client";

import { useState, useCallback } from "react";
import type { GitLabMergeRequest, GitLabApprovals } from "@/lib/types/gitlab";
import { apiFetch } from "@/lib/client-errors";
import { useToastContext } from "@/components/providers/ToastProvider";
import { CheckIcon, DoubleCheckIcon, XIcon, MergeIcon, ExternalLinkIcon } from "@/components/shared/icons";
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
      const res = await apiFetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      addToast(hasApproved ? "Unapproved" : "Approved", `!${mr.iid} ${mr.title}`, "success");
      await onRefetch();
    } catch (err) {
      addToast("Error", err instanceof Error ? err.message : "Action failed", "error");
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
          <DoubleCheckIcon />
        ) : (
          <CheckIcon />
        )}
        {hasApproved ? "Unapprove" : "Approve"}
      </button>
      <button className={`${styles.btn} ${styles.requestChanges}`} disabled title="Requires GraphQL — coming soon">
        <XIcon />
        Request Changes
      </button>
      <button
        className={`${styles.btn} ${styles.merge}`}
        disabled={!mergeable}
        title={!mergeable ? `Not mergeable: ${mr.detailed_merge_status}${mr.draft ? " (draft)" : ""}` : "Merge this MR"}
        onClick={() => setMergeOpen(true)}
      >
        <MergeIcon />
        {mergeable ? "Merge" : "Not Mergeable"}
      </button>
      {mergeOpen && (
        <MergeDialog
          mr={mr}
          onClose={() => setMergeOpen(false)}
          onRefetch={onRefetch}
        />
      )}
      <a
        href={mr.web_url}
        target="_blank"
        rel="noreferrer"
        className={`${styles.btn} ${styles.external}`}
      >
        Open in GitLab
        <ExternalLinkIcon />
      </a>
    </div>
  );
}
