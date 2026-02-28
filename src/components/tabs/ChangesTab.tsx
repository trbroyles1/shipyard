"use client";

import { useState, useMemo } from "react";
import type { GitLabDiffFile } from "@/lib/types/gitlab";
import { enrichWithStats, type FileWithStats } from "./changes/diff-stats";
import { FileTree } from "./changes/FileTree";
import { DiffViewer } from "./changes/DiffViewer";
import styles from "./ChangesTab.module.css";

interface Props {
  diffs: GitLabDiffFile[];
}

export function ChangesTab({ diffs }: Props) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);

  const filesWithStats = useMemo(() => enrichWithStats(diffs), [diffs]);

  const fileMap = useMemo(() => {
    const map = new Map<string, FileWithStats>();
    for (const d of filesWithStats) {
      map.set(d.new_path || d.old_path, d);
    }
    return map;
  }, [filesWithStats]);

  if (diffs.length === 0) {
    return <div className={styles.empty}>No changes found.</div>;
  }

  return (
    <div className={styles.container}>
      {treeOpen && (
        <div className={styles.tree}>
          <FileTree
            files={filesWithStats}
            selectedFile={selectedFile}
            onSelect={setSelectedFile}
            onClose={() => setTreeOpen(false)}
          />
        </div>
      )}
      <div className={styles.diffArea}>
        {!treeOpen && (
          <button className={styles.showTree} onClick={() => setTreeOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </button>
        )}
        {selectedFile && fileMap.has(selectedFile) ? (
          <DiffViewer file={fileMap.get(selectedFile)!} />
        ) : (
          <DiffAllFiles files={filesWithStats} />
        )}
      </div>
    </div>
  );
}

function DiffAllFiles({ files }: { files: FileWithStats[] }) {
  return (
    <div className={styles.allFiles}>
      {files.map((f) => (
        <DiffViewer key={f.new_path || f.old_path} file={f} />
      ))}
    </div>
  );
}
