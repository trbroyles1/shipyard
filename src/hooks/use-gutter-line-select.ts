import { useState, useRef, useCallback, useMemo } from "react";
import { getChangeKey } from "react-diff-view";
import type { HunkData, ChangeData, ChangeEventArgs, EventMap } from "react-diff-view";
import type { GitLabDiffPosition } from "@/lib/types/gitlab";

export interface GutterSelection {
  changes: ChangeData[];
  keys: string[];
}

interface DiffRefs {
  base_sha: string;
  head_sha: string;
  start_sha: string;
}

function lineType(c: ChangeData): "new" | "old" {
  return c.type === "delete" ? "old" : "new";
}

function newLine(c: ChangeData): number | null {
  if (c.type === "delete") return null;
  if (c.type === "normal") return (c as ChangeData & { newLineNumber: number }).newLineNumber;
  return (c as ChangeData & { lineNumber: number }).lineNumber;
}

function oldLine(c: ChangeData): number | null {
  if (c.type === "insert") return null;
  if (c.type === "normal") return (c as ChangeData & { oldLineNumber: number }).oldLineNumber;
  return (c as ChangeData & { lineNumber: number }).lineNumber;
}

/** Build a GitLabDiffPosition from selected changes. */
export function buildPosition(
  changes: ChangeData[],
  diffRefs: DiffRefs,
  file: { old_path: string; new_path: string },
): GitLabDiffPosition {
  const first = changes[0];
  const last = changes[changes.length - 1];

  const base: GitLabDiffPosition = {
    position_type: "text",
    base_sha: diffRefs.base_sha,
    head_sha: diffRefs.head_sha,
    start_sha: diffRefs.start_sha,
    old_path: file.old_path,
    new_path: file.new_path,
    old_line: oldLine(last),
    new_line: newLine(last),
  };

  if (changes.length > 1) {
    base.line_range = {
      start: {
        type: lineType(first),
        old_line: oldLine(first),
        new_line: newLine(first),
      },
      end: {
        type: lineType(last),
        old_line: oldLine(last),
        new_line: newLine(last),
      },
    };
  }

  return base;
}

export function useGutterLineSelect(hunks: HunkData[]) {
  const [selection, setSelection] = useState<GutterSelection | null>(null);
  const [commentFormOpen, setCommentFormOpen] = useState(false);
  const dragging = useRef(false);
  const anchorIndex = useRef<number>(-1);

  const allChanges = useMemo(
    () => hunks.flatMap((h) => h.changes),
    [hunks],
  );

  const changeIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    allChanges.forEach((c, i) => map.set(getChangeKey(c), i));
    return map;
  }, [allChanges]);

  const buildSelection = useCallback(
    (from: number, to: number): GutterSelection => {
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      const slice = allChanges.slice(lo, hi + 1);
      return { changes: slice, keys: slice.map(getChangeKey) };
    },
    [allChanges],
  );

  const gutterEvents: EventMap = useMemo(
    () => ({
      onClick(args: ChangeEventArgs) {
        if (!args.change) return;
        const idx = changeIndexMap.get(getChangeKey(args.change));
        if (idx == null) return;
        anchorIndex.current = idx;
        dragging.current = false;
        const sel = buildSelection(idx, idx);
        setSelection(sel);
        setCommentFormOpen(true);
      },
      onMouseDown(args: ChangeEventArgs) {
        if (!args.change) return;
        const idx = changeIndexMap.get(getChangeKey(args.change));
        if (idx == null) return;
        anchorIndex.current = idx;
        dragging.current = true;
        setSelection(buildSelection(idx, idx));
        setCommentFormOpen(false);
      },
      onMouseEnter(args: ChangeEventArgs) {
        if (!dragging.current || !args.change) return;
        const idx = changeIndexMap.get(getChangeKey(args.change));
        if (idx == null) return;
        setSelection(buildSelection(anchorIndex.current, idx));
      },
      onMouseUp() {
        if (dragging.current) {
          dragging.current = false;
          setCommentFormOpen(true);
        }
      },
    }),
    [changeIndexMap, buildSelection],
  );

  const cancelSelection = useCallback(() => {
    setSelection(null);
    setCommentFormOpen(false);
    dragging.current = false;
    anchorIndex.current = -1;
  }, []);

  const finishDragOutside = useCallback(() => {
    if (dragging.current) {
      dragging.current = false;
      if (selection && selection.changes.length > 0) {
        setCommentFormOpen(true);
      }
    }
  }, [selection]);

  return { selection, commentFormOpen, gutterEvents, cancelSelection, finishDragOutside };
}
