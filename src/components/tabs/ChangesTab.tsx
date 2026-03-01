"use client";

import { useState, useMemo } from "react";
import type { EnrichedDiffFile } from "@/lib/types/gitlab";
import type { FileWithStats } from "./changes/diff-stats";
import { FileTree } from "./changes/FileTree";
import { DiffViewer } from "./changes/DiffViewer";
import styles from "./ChangesTab.module.css";

interface Props {
  diffs: EnrichedDiffFile[];
  projectId: number;
  iid: number;
}

export function ChangesTab({ diffs, projectId, iid }: Props) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);

  const fileMap = useMemo(() => {
    const map = new Map<string, FileWithStats>();
    for (const d of diffs) {
      map.set(d.new_path || d.old_path, d);
    }
    return map;
  }, [diffs]);

  if (diffs.length === 0) {
    return <div className={styles.empty}>No changes found.</div>;
  }

  return (
    <div className={styles.container}>
      {treeOpen && (
        <div className={styles.tree}>
          <FileTree
            files={diffs}
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
          <DiffViewer file={fileMap.get(selectedFile)!} projectId={projectId} iid={iid} />
        ) : (
          <DiffAllFiles files={diffs} projectId={projectId} iid={iid} />
        )}
      </div>
    </div>
  );
}

function DiffAllFiles({ files, projectId, iid }: { files: FileWithStats[]; projectId: number; iid: number }) {
  return (
    <div className={styles.allFiles}>
      {files.map((f) => (
        <DiffViewer key={f.new_path || f.old_path} file={f} projectId={projectId} iid={iid} />
      ))}
    </div>
  );
}
