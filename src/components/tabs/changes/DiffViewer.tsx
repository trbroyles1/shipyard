"use client";

import { useMemo, useState, useCallback } from "react";
import { parseDiff, Diff, Hunk } from "react-diff-view";
import type { FileWithStats } from "./diff-stats";
import styles from "./DiffViewer.module.css";
import "react-diff-view/style/index.css";

interface Props {
  file: FileWithStats;
  projectId: number;
  iid: number;
}

export function DiffViewer({ file: initialFile, projectId, iid }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [loadedDiff, setLoadedDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const path = initialFile.new_path || initialFile.old_path;
  const diffText = loadedDiff ?? initialFile.diff;
  const isTruncated = initialFile.truncated && loadedDiff === null;

  const parsedFiles = useMemo(() => {
    if (!diffText) return [];
    const unifiedDiff = `--- a/${initialFile.old_path}\n+++ b/${initialFile.new_path}\n${diffText}`;
    try {
      return parseDiff(unifiedDiff);
    } catch {
      return [];
    }
  }, [diffText, initialFile.old_path, initialFile.new_path]);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const base = `/api/gitlab/merge-requests/${projectId}/${iid}/changes/file`;
      const res = await fetch(`${base}?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setLoadedDiff(data.diff || "");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load diff");
    } finally {
      setLoading(false);
    }
  }, [projectId, iid, path]);

  const noDiff = !diffText && !isTruncated;

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
        {initialFile.renamed_file && initialFile.old_path !== initialFile.new_path && (
          <span className={styles.rename}>{initialFile.old_path} &rarr;</span>
        )}
        <span className={styles.stats}>
          <span className={styles.additions}>+{initialFile.additions}</span>
          <span className={styles.deletions}>-{initialFile.deletions}</span>
        </span>
      </div>
      {!collapsed && (
        initialFile.binary ? (
          <div className={styles.noContent}>Binary file — no text diff available.</div>
        ) : isTruncated ? (
          <div className={styles.largeDiff}>
            <span className={styles.largeDiffText}>
              Large diff ({initialFile.additions + initialFile.deletions} changed lines). Load it?
            </span>
            <button
              className={styles.loadBtn}
              onClick={handleLoad}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load diff"}
            </button>
            {loadError && <span className={styles.loadError}>{loadError}</span>}
          </div>
        ) : noDiff ? (
          <div className={styles.noContent}>Empty diff.</div>
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
