"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { GitLabMergeRequest } from "@/lib/types/gitlab";
import { useToastContext } from "@/components/providers/ToastProvider";
import styles from "./MergeDialog.module.css";

interface Props {
  mr: GitLabMergeRequest;
  anchorRef: React.RefObject<HTMLButtonElement>;
  onClose: () => void;
  onRefetch: () => Promise<void>;
}

export function MergeDialog({ mr, anchorRef, onClose, onRefetch }: Props) {
  const { addToast } = useToastContext();
  const [squash, setSquash] = useState(false);
  const [deleteBranch, setDeleteBranch] = useState(true);
  const [autoMerge, setAutoMerge] = useState(false);
  const [merging, setMerging] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const pipelineRunning = mr.head_pipeline?.status === "running" || mr.head_pipeline?.status === "pending";

  // Position the dialog below the anchor button
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
  }, [anchorRef]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleMerge = useCallback(async () => {
    if (!mr.diff_refs?.head_sha) {
      addToast("Error", "Missing head SHA — cannot merge safely", "warning");
      return;
    }
    setMerging(true);
    try {
      const base = `/api/gitlab/merge-requests/${mr.project_id}/${mr.iid}/merge`;
      const res = await fetch(base, {
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
      addToast("Merge failed", err instanceof Error ? err.message : "Unknown error", "warning");
    } finally {
      setMerging(false);
    }
  }, [mr, squash, deleteBranch, autoMerge, pipelineRunning, addToast, onClose, onRefetch]);

  if (!pos) return null;

  return createPortal(
    <div className={styles.dialog} ref={dialogRef} style={{ top: pos.top, left: pos.left }}>
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
    </div>,
    document.body,
  );
}
