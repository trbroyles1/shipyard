"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { EnrichedDiffFile, GitLabDiscussion, GitLabDiffPosition, DiffRefs } from "@/lib/types/gitlab";
import { useUIPanel } from "@/components/providers/UIPanelProvider";
import { useToastContext } from "@/components/providers/ToastProvider";
import { useDiscussionActions } from "@/hooks/use-discussion-actions";
import { FileTree } from "./changes/FileTree";
import { DiffViewer } from "./changes/DiffViewer";
import styles from "./ChangesTab.module.css";

interface Props {
  diffs: EnrichedDiffFile[];
  discussions: GitLabDiscussion[];
  projectId: number;
  iid: number;
  diffRefs: DiffRefs | null;
  onRefetch: () => Promise<void>;
}

export function ChangesTab({ diffs, discussions, projectId, iid, diffRefs, onRefetch }: Props) {
  const { scrollToFile, setScrollToFile } = useUIPanel();
  const { addToast } = useToastContext();

  const { handleReply, handleResolve, handleNewComment } = useDiscussionActions({
    projectId, iid, onRefetch, addToast,
  });

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const diffAreaRef = useRef<HTMLDivElement>(null);

  const fileMap = useMemo(() => {
    const map = new Map<string, EnrichedDiffFile>();
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
        <button
          type="button"
          className={styles.treeRail}
          onClick={() => setTreeOpen(true)}
          title="Show file tree"
        >
          <span className={styles.treeRailLabel}>Files ({diffs.length})</span>
        </button>
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
  files: EnrichedDiffFile[];
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
