"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import type { GitLabDiscussion } from "@/lib/types/gitlab";
import { useUIPanel } from "@/components/providers/UIPanelProvider";
import { useToastContext } from "@/components/providers/ToastProvider";
import { useDiscussionActions } from "@/hooks/use-discussion-actions";
import { DiscussionThread } from "@/components/shared/DiscussionThread";
import styles from "./DiscussionsTab.module.css";

interface Props {
  discussions: GitLabDiscussion[];
  projectId: number;
  iid: number;
  onRefetch: () => Promise<void>;
}

/** Extract basename from a full file path. */
function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.substring(i + 1) : path;
}

/** Build a file#line label for a diff-positioned discussion. */
function buildFileLink(discussion: GitLabDiscussion): { label: string; title: string; filePath: string } | null {
  const pos = discussion.notes[0]?.position;
  if (!pos) return null;

  const filePath = pos.new_path || pos.old_path;
  const fileName = basename(filePath);

  const range = pos.line_range;
  if (range) {
    const startLine = range.start.new_line ?? range.start.old_line;
    const endLine = range.end.new_line ?? range.end.old_line;
    if (startLine != null && endLine != null && startLine !== endLine) {
      return {
        label: `${fileName}#L${startLine}-L${endLine}`,
        title: `${filePath}#L${startLine}-L${endLine}`,
        filePath,
      };
    }
  }

  const line = pos.new_line ?? pos.old_line;
  if (line != null) {
    return {
      label: `${fileName}#L${line}`,
      title: `${filePath}#L${line}`,
      filePath,
    };
  }

  return { label: fileName, title: filePath, filePath };
}

export function DiscussionsTab({ discussions, projectId, iid, onRefetch }: Props) {
  const { setActiveTab, setScrollToFile } = useUIPanel();
  const { addToast } = useToastContext();
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);

  const { handleReply, handleResolve, handleNewComment } = useDiscussionActions({
    projectId, iid, onRefetch, addToast,
  });

  const handleSubmitComment = useCallback(async () => {
    if (!commentText.trim()) return;
    setCommenting(true);
    try {
      await handleNewComment(commentText.trim());
      setCommentText("");
      setCommentOpen(false);
    } catch {
      // Toast already shown by useDiscussionActions
    } finally {
      setCommenting(false);
    }
  }, [commentText, handleNewComment]);

  const handleCommentKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmitComment();
    }
  }, [handleSubmitComment]);

  // Filter out system-only discussions (just system notes)
  const humanDiscussions = discussions.filter(
    (d) => d.notes.some((n) => !n.system)
  );

  return (
    <div className={styles.list}>
      {/* New comment input */}
      <div className={styles.newComment}>
        {commentOpen ? (
          <div className={styles.commentBox}>
            <textarea
              className={styles.commentInput}
              placeholder="Write a comment... (Ctrl+Enter to send)"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={handleCommentKeyDown}
              rows={3}
              disabled={commenting}
              autoFocus
            />
            <div className={styles.commentActions}>
              <button className={styles.commentCancel} onClick={() => { setCommentOpen(false); setCommentText(""); }}>
                Cancel
              </button>
              <button
                className={styles.commentSubmit}
                onClick={handleSubmitComment}
                disabled={commenting || !commentText.trim()}
              >
                {commenting ? "Sending..." : "Comment"}
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.commentPlaceholder} onClick={() => setCommentOpen(true)}>
            Add a comment...
          </button>
        )}
      </div>

      {humanDiscussions.length === 0 ? (
        <div className={styles.empty}>No discussions yet.</div>
      ) : (
        humanDiscussions.map((d) => {
          const link = buildFileLink(d);
          return (
            <DiscussionThread
              key={d.id}
              discussion={d}
              onReply={handleReply}
              onResolve={handleResolve}
              fileLink={link ? {
                label: link.label,
                title: link.title,
                onClick: () => {
                  setScrollToFile(link.filePath);
                  setActiveTab("changes");
                },
              } : undefined}
            />
          );
        })
      )}
    </div>
  );
}
