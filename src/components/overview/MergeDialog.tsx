"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { GitLabMergeRequest } from "@/lib/types/gitlab";
import { apiFetch } from "@/lib/client-errors";
import { useToastContext } from "@/components/providers/ToastProvider";
import styles from "./MergeDialog.module.css";

interface Props {
  mr: GitLabMergeRequest;
  onClose: () => void;
  onRefetch: () => Promise<void>;
}

export function MergeDialog({ mr, onClose, onRefetch }: Props) {
  const { addToast } = useToastContext();
  const [squash, setSquash] = useState(false);
  const [deleteBranch, setDeleteBranch] = useState(true);
  const [autoMerge, setAutoMerge] = useState(false);
  const [merging, setMerging] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const pipelineRunning = mr.head_pipeline?.status === "running" || mr.head_pipeline?.status === "pending";

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }, [onClose]);

  const handleMerge = useCallback(async () => {
    if (!mr.diff_refs?.head_sha) {
      addToast("Error", "Missing head SHA — cannot merge safely", "error");
      return;
    }
    setMerging(true);
    try {
      const base = `/api/gitlab/merge-requests/${mr.project_id}/${mr.iid}/merge`;
      const res = await apiFetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sha: mr.diff_refs.head_sha,
          squash,
          should_remove_source_branch: deleteBranch,
          ...(pipelineRunning && autoMerge ? { merge_when_pipeline_succeeds: true } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      addToast("Merged", `!${mr.iid} has been merged`, "success");
      onClose();
      await onRefetch();
    } catch (err) {
      addToast("Merge failed", err instanceof Error ? err.message : "Unknown error", "error");
    } finally {
      setMerging(false);
    }
  }, [mr, squash, deleteBranch, autoMerge, pipelineRunning, addToast, onClose, onRefetch]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className={styles.content}>
        <div className={styles.title}>Merge options</div>
        <label className={styles.option}>
          <input type="checkbox" checked={squash} onChange={(e) => setSquash(e.target.checked)} />
          <span>Squash commits</span>
        </label>
        <label className={styles.option}>
          <input type="checkbox" checked={deleteBranch} onChange={(e) => setDeleteBranch(e.target.checked)} />
          <span>Delete source branch</span>
        </label>
        {pipelineRunning && (
          <label className={styles.option}>
            <input type="checkbox" checked={autoMerge} onChange={(e) => setAutoMerge(e.target.checked)} />
            <span>Auto-merge when pipeline succeeds</span>
          </label>
        )}
        <div className={styles.buttons}>
          <button className={styles.cancel} onClick={onClose}>Cancel</button>
          <button className={styles.confirm} onClick={handleMerge} disabled={merging}>
            {merging ? <span className={styles.spinner} /> : null}
            {merging ? "Merging..." : "Confirm merge"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
