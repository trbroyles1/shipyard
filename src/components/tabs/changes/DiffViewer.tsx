"use client";

import { useMemo, useState, useCallback, useEffect, useRef, type ReactNode, type KeyboardEvent } from "react";
import { parseDiff, Diff, Hunk, getChangeKey, findChangeByNewLineNumber, computeNewLineNumber } from "react-diff-view";
import type { ChangeData } from "react-diff-view";
import type { GitLabDiscussion, GitLabDiffPosition, DiffRefs, EnrichedDiffFile } from "@/lib/types/gitlab";
import { mrApiPath } from "@/lib/api-path";
import { DiscussionThread } from "@/components/shared/DiscussionThread";
import { useGutterLineSelect, buildPosition } from "@/hooks/use-gutter-line-select";
import { apiFetch } from "@/lib/client-errors";
import { ChevronRightIcon, DocumentIcon, CommentIcon } from "@/components/shared/icons";
import styles from "./DiffViewer.module.css";
import "react-diff-view/style/index.css";

interface Props {
  file: EnrichedDiffFile;
  discussions: GitLabDiscussion[];
  projectId: number;
  iid: number;
  diffRefs?: DiffRefs | null;
  onReply?: (discussionId: string, body: string) => Promise<void>;
  onResolve?: (discussionId: string, resolved: boolean) => Promise<void>;
  onNewComment?: (body: string, position?: GitLabDiffPosition) => Promise<void>;
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

/* ─── Inline comment form (co-located) ─── */

function InlineCommentForm({
  lineCount,
  onSubmit,
  onCancel,
}: {
  lineCount: number;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(text.trim());
      setText("");
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [onCancel, handleSubmit],
  );

  return (
    <div className={styles.inlineCommentForm}>
      {lineCount > 1 && (
        <span className={styles.commentFormLabel}>Comment on {lineCount} lines</span>
      )}
      <div className={styles.commentFormBox}>
        <textarea
          ref={ref}
          className={styles.commentFormInput}
          placeholder="Write a comment... (Ctrl+Enter to send)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={submitting}
        />
        <div className={styles.commentFormActions}>
          <button className={styles.commentFormCancel} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={styles.commentFormSubmit}
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
          >
            {submitting ? "Sending..." : "Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── DiffViewer ─── */

export function DiffViewer({ file: initialFile, discussions, projectId, iid, diffRefs, onReply, onResolve, onNewComment }: Props) {
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

  const allHunks = useMemo(
    () => parsedFiles.flatMap((pf) => pf.hunks),
    [parsedFiles],
  );

  // Gutter line selection
  const canComment = !!diffRefs && !!onNewComment;
  const { selection, commentFormOpen, gutterEvents, cancelSelection, finishDragOutside } =
    useGutterLineSelect(allHunks);

  // Global mouseup to finish drag outside gutter
  useEffect(() => {
    if (!canComment) return;
    window.addEventListener("mouseup", finishDragOutside);
    return () => window.removeEventListener("mouseup", finishDragOutside);
  }, [canComment, finishDragOutside]);

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
  const threadWidgets = useMemo(() => {
    if (fileDiscussions.length === 0 || parsedFiles.length === 0) return {};

    const allChanges: ChangeData[] = allHunks.flatMap((h) => h.changes);

    function findAnchorChange(targetLine: number): ChangeData | null {
      const exact = findChangeByNewLineNumber(allHunks, targetLine);
      if (exact) return exact;

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

    const result: Record<string, ReactNode[]> = {};
    Object.entries(widgetMap).forEach(([key, threads]) => {
      result[key] = threads;
    });
    return result;
  }, [fileDiscussions, parsedFiles, allHunks, onReply, onResolve]);

  // Handle inline comment submission
  const handleInlineSubmit = useCallback(
    async (body: string) => {
      if (!diffRefs || !onNewComment || !selection) return;
      const position = buildPosition(selection.changes, diffRefs, {
        old_path: initialFile.old_path,
        new_path: initialFile.new_path,
      });
      await onNewComment(body, position);
      cancelSelection();
    },
    [diffRefs, onNewComment, selection, initialFile.old_path, initialFile.new_path, cancelSelection],
  );

  // Merge thread widgets + inline comment form
  const mergedWidgets = useMemo(() => {
    const result: Record<string, ReactNode> = {};

    // Copy thread widgets
    Object.entries(threadWidgets).forEach(([key, threads]) => {
      result[key] = (
        <div className={styles.inlineThreads}>
          {threads}
        </div>
      );
    });

    // Add inline comment form if selection is active
    if (canComment && commentFormOpen && selection && selection.changes.length > 0) {
      const lastChange = selection.changes[selection.changes.length - 1];
      const formKey = getChangeKey(lastChange);
      const existingThreads = threadWidgets[formKey];
      result[formKey] = (
        <>
          {existingThreads && (
            <div className={styles.inlineThreads}>{existingThreads}</div>
          )}
          <InlineCommentForm
            lineCount={selection.changes.length}
            onSubmit={handleInlineSubmit}
            onCancel={cancelSelection}
          />
        </>
      );
    }

    return result;
  }, [threadWidgets, canComment, commentFormOpen, selection, handleInlineSubmit, cancelSelection]);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const base = `${mrApiPath(projectId, iid)}/changes/file`;
      const res = await apiFetch(`${base}?path=${encodeURIComponent(path)}`);
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

  const renderGutter = useMemo(() => {
    if (!canComment) return undefined;
    return ({ renderDefault, inHoverState }: { renderDefault: () => ReactNode; inHoverState: boolean }) => (
      <>
        {renderDefault()}
        {inHoverState && <span className={styles.addCommentIcon}>+</span>}
      </>
    );
  }, [canComment]);

  const noDiff = !diffText && !isTruncated;
  const hasWidgets = Object.keys(mergedWidgets).length > 0;
  const selectedKeys = selection?.keys;

  return (
    <div className={styles.file}>
      <div
        className={styles.fileHeader}
        onClick={() => setCollapsed(!collapsed)}
      >
        <ChevronRightIcon
          size={12}
          className={`${styles.chevron} ${collapsed ? "" : styles.chevronOpen}`}
        />
        <DocumentIcon size={12} />
        <span className={styles.filePath}>{path}</span>
        {initialFile.renamed_file && initialFile.old_path !== initialFile.new_path && (
          <span className={styles.rename}>{initialFile.old_path} &rarr;</span>
        )}
        {fileDiscussions.length > 0 && (
          <span className={styles.commentBadge} title={`${fileDiscussions.length} discussion${fileDiscussions.length > 1 ? "s" : ""}`}>
            <CommentIcon size={11} />
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
                widgets={hasWidgets ? mergedWidgets : undefined}
                selectedChanges={selectedKeys}
                gutterEvents={canComment ? gutterEvents : undefined}
                renderGutter={renderGutter}
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
