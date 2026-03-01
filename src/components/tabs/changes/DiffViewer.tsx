"use client";

import { useMemo, useState, useCallback, type ReactNode } from "react";
import { parseDiff, Diff, Hunk, getChangeKey, findChangeByNewLineNumber, computeNewLineNumber } from "react-diff-view";
import type { HunkData, ChangeData } from "react-diff-view";
import type { GitLabDiscussion } from "@/lib/types/gitlab";
import type { FileWithStats } from "./diff-stats";
import { DiscussionThread } from "@/components/shared/DiscussionThread";
import styles from "./DiffViewer.module.css";
import "react-diff-view/style/index.css";

interface Props {
  file: FileWithStats;
  discussions: GitLabDiscussion[];
  projectId: number;
  iid: number;
  onReply?: (discussionId: string, body: string) => Promise<void>;
  onResolve?: (discussionId: string, resolved: boolean) => Promise<void>;
}

/** Get the anchor line for a discussion (where the widget renders). */
function getAnchorLine(discussion: GitLabDiscussion): number | null {
  const pos = discussion.notes[0]?.position;
  if (!pos) return null;

  // Multi-line: anchor at end of range
  if (pos.line_range?.end.new_line != null) {
    return pos.line_range.end.new_line;
  }
  // Single-line
  return pos.new_line ?? pos.old_line;
}

export function DiffViewer({ file: initialFile, discussions, projectId, iid, onReply, onResolve }: Props) {
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

  // Filter discussions for this file
  const fileDiscussions = useMemo(() => {
    const filePaths = new Set([initialFile.new_path, initialFile.old_path].filter(Boolean));
    return discussions.filter((d) => {
      const pos = d.notes[0]?.position;
      if (!pos) return false;
      return filePaths.has(pos.new_path) || filePaths.has(pos.old_path);
    });
  }, [discussions, initialFile.new_path, initialFile.old_path]);

  // Build widgets map: changeKey → ReactNode
  const widgets = useMemo(() => {
    if (fileDiscussions.length === 0 || parsedFiles.length === 0) return {};

    const allHunks: HunkData[] = parsedFiles.flatMap((pf) => pf.hunks);
    const allChanges: ChangeData[] = allHunks.flatMap((h) => h.changes);

    // Find the best change to anchor a widget to for a given new-side line number.
    // First tries exact match, then falls back to the closest preceding change in the hunk.
    function findAnchorChange(targetLine: number): ChangeData | null {
      // Exact match
      const exact = findChangeByNewLineNumber(allHunks, targetLine);
      if (exact) return exact;

      // Fallback: find the closest change whose new line number ≤ targetLine
      let best: ChangeData | null = null;
      let bestLine = -1;
      allChanges.forEach((c) => {
        const nl = computeNewLineNumber(c);
        if (nl > 0 && nl <= targetLine && nl > bestLine) {
          bestLine = nl;
          best = c;
        }
      });
      return best;
    }

    const widgetMap: Record<string, ReactNode[]> = {};

    fileDiscussions.forEach((d) => {
      const notes = d.notes.filter((n) => !n.system);
      if (notes.length === 0) return;

      const anchorLine = getAnchorLine(d);
      if (anchorLine == null) return;

      const change = findAnchorChange(anchorLine);
      if (!change) return;

      const key = getChangeKey(change);
      if (!widgetMap[key]) widgetMap[key] = [];
      widgetMap[key].push(
        <DiscussionThread key={d.id} discussion={d} compact defaultExpanded onReply={onReply} onResolve={onResolve} />
      );
    });

    // Merge arrays into single ReactNode per key
    const result: Record<string, ReactNode> = {};
    Object.entries(widgetMap).forEach(([key, threads]) => {
      result[key] = (
        <div className={styles.inlineThreads}>
          {threads}
        </div>
      );
    });
    return result;
  }, [fileDiscussions, parsedFiles, onReply, onResolve]);

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
  const hasWidgets = Object.keys(widgets).length > 0;

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
        {fileDiscussions.length > 0 && (
          <span className={styles.commentBadge} title={`${fileDiscussions.length} discussion${fileDiscussions.length > 1 ? "s" : ""}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {fileDiscussions.length}
          </span>
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
              <Diff
                key={pf.oldRevision + pf.newRevision}
                viewType="unified"
                diffType={pf.type}
                hunks={pf.hunks}
                widgets={hasWidgets ? widgets : undefined}
              >
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
