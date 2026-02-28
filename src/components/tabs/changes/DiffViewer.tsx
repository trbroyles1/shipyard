"use client";

import { useMemo, useState } from "react";
import { parseDiff, Diff, Hunk } from "react-diff-view";
import type { FileWithStats } from "./diff-stats";
import styles from "./DiffViewer.module.css";
import "react-diff-view/style/index.css";

interface Props {
  file: FileWithStats;
}

export function DiffViewer({ file }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const path = file.new_path || file.old_path;

  const parsedFiles = useMemo(() => {
    if (!file.diff) return [];
    const unifiedDiff = `--- a/${file.old_path}\n+++ b/${file.new_path}\n${file.diff}`;
    try {
      return parseDiff(unifiedDiff);
    } catch {
      return [];
    }
  }, [file]);

  const noDiff = parsedFiles.length === 0 && !file.diff;

  return (
    <div className={styles.file}>
      <div
        className={styles.fileHeader}
        onClick={() => setCollapsed(!collapsed)}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`${styles.chevron} ${collapsed ? "" : styles.chevronOpen}`}
        >
          <polyline points="9 6 15 12 9 18"/>
        </svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
        <span className={styles.filePath}>{path}</span>
        {file.renamed_file && file.old_path !== file.new_path && (
          <span className={styles.rename}>{file.old_path} &rarr;</span>
        )}
        <span className={styles.stats}>
          <span className={styles.additions}>+{file.additions}</span>
          <span className={styles.deletions}>-{file.deletions}</span>
        </span>
      </div>
      {!collapsed && (
        noDiff ? (
          <div className={styles.noContent}>File content not available (binary or too large)</div>
        ) : (
          <div className={styles.diffContent}>
            {parsedFiles.map((pf) => (
              <Diff key={pf.oldRevision + pf.newRevision} viewType="unified" diffType={pf.type} hunks={pf.hunks}>
                {(hunks) => hunks.map((hunk) => (
                  <Hunk key={hunk.content} hunk={hunk} />
                ))}
              </Diff>
            ))}
          </div>
        )
      )}
    </div>
  );
}
