"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { EnrichedDiffFile, GitLabDiscussion, GitLabDiffPosition } from "@/lib/types/gitlab";
import type { FileWithStats } from "./changes/diff-stats";
import { useAppState } from "@/components/providers/AppStateProvider";
import { useToastContext } from "@/components/providers/ToastProvider";
import { FileTree } from "./changes/FileTree";
import { DiffViewer } from "./changes/DiffViewer";
import styles from "./ChangesTab.module.css";

interface DiffRefs {
  base_sha: string;
  head_sha: string;
  start_sha: string;
}

interface Props {
  diffs: EnrichedDiffFile[];
  discussions: GitLabDiscussion[];
  projectId: number;
  iid: number;
  diffRefs: DiffRefs | null;
  onRefetch: () => Promise<void>;
}

export function ChangesTab({ diffs, discussions, projectId, iid, diffRefs, onRefetch }: Props) {
  const { scrollToFile, setScrollToFile } = useAppState();
  const { addToast } = useToastContext();

  const base = `/api/gitlab/merge-requests/${projectId}/${iid}`;

  const handleReply = useCallback(async (discussionId: string, body: string) => {
    try {
      const res = await fetch(`${base}/discussions/${discussionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await onRefetch();
    } catch (err) {
      addToast("Reply failed", err instanceof Error ? err.message : "Unknown error", "warning");
      throw err;
    }
  }, [base, onRefetch, addToast]);

  const handleResolve = useCallback(async (discussionId: string, resolved: boolean) => {
    try {
      const res = await fetch(`${base}/discussions/${discussionId}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await onRefetch();
    } catch (err) {
      addToast("Resolve failed", err instanceof Error ? err.message : "Unknown error", "warning");
    }
  }, [base, onRefetch, addToast]);

  const handleNewComment = useCallback(async (body: string, position?: GitLabDiffPosition) => {
    try {
      const payload: Record<string, unknown> = { body };
      if (position) payload.position = position;
      const res = await fetch(`${base}/discussions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await onRefetch();
    } catch (err) {
      addToast("Comment failed", err instanceof Error ? err.message : "Unknown error", "warning");
      throw err;
    }
  }, [base, onRefetch, addToast]);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const diffAreaRef = useRef<HTMLDivElement>(null);

  const fileMap = useMemo(() => {
    const map = new Map<string, FileWithStats>();
    for (const d of diffs) {
      map.set(d.new_path || d.old_path, d);
    }
    return map;
  }, [diffs]);

  // Handle scrollToFile from Discussions tab
  useEffect(() => {
    if (scrollToFile && fileMap.has(scrollToFile)) {
      setSelectedFile(scrollToFile);
      setScrollToFile(null);
      // Scroll the diff area to top after selecting
      requestAnimationFrame(() => {
        diffAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    } else if (scrollToFile) {
      // File not found — clear anyway
      setScrollToFile(null);
    }
  }, [scrollToFile, fileMap, setScrollToFile]);

  if (diffs.length === 0) {
    return <div className={styles.empty}>No changes found.</div>;
  }

  return (
    <div className={styles.container}>
      {treeOpen ? (
        <div className={styles.tree}>
          <FileTree
            files={diffs}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
            onClose={() => setTreeOpen(false)}
          />
        </div>
      ) : (
        <div
          className={styles.treeRail}
          onClick={() => setTreeOpen(true)}
          title="Show file tree"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setTreeOpen(true); }}
        >
          <span className={styles.treeRailLabel}>Files ({diffs.length})</span>
        </div>
      )}
      <div className={styles.diffArea} ref={diffAreaRef}>
        {selectedFile && fileMap.has(selectedFile) ? (
          <DiffViewer file={fileMap.get(selectedFile)!} discussions={discussions} projectId={projectId} iid={iid} diffRefs={diffRefs} onReply={handleReply} onResolve={handleResolve} onNewComment={handleNewComment} />
        ) : (
          <DiffAllFiles files={diffs} discussions={discussions} projectId={projectId} iid={iid} diffRefs={diffRefs} onReply={handleReply} onResolve={handleResolve} onNewComment={handleNewComment} />
        )}
      </div>
    </div>
  );
}

function DiffAllFiles({ files, discussions, projectId, iid, diffRefs, onReply, onResolve, onNewComment }: {
  files: FileWithStats[];
  discussions: GitLabDiscussion[];
  projectId: number;
  iid: number;
  diffRefs: DiffRefs | null;
  onReply: (discussionId: string, body: string) => Promise<void>;
  onResolve: (discussionId: string, resolved: boolean) => Promise<void>;
  onNewComment: (body: string, position?: GitLabDiffPosition) => Promise<void>;
}) {
  return (
    <div className={styles.allFiles}>
      {files.map((f) => (
        <DiffViewer key={f.new_path || f.old_path} file={f} discussions={discussions} projectId={projectId} iid={iid} diffRefs={diffRefs} onReply={onReply} onResolve={onResolve} onNewComment={onNewComment} />
      ))}
    </div>
  );
}
