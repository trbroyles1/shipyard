"use client";

import { useState, useCallback, useRef, type KeyboardEvent } from "react";
import type { GitLabDiscussion } from "@/lib/types/gitlab";
import { usePreferencesContext } from "@/components/providers/PreferencesProvider";
import { ChevronRightIcon } from "./icons";
import { Avatar } from "./Avatar";
import { RelativeTime } from "./RelativeTime";
import { MarkdownBody } from "./MarkdownBody";
import styles from "./DiscussionThread.module.css";

interface Props {
  discussion: GitLabDiscussion;
  defaultExpanded?: boolean;
  compact?: boolean;
  fileLink?: { label: string; title?: string; onClick: () => void };
  onReply?: (discussionId: string, body: string) => Promise<void>;
  onResolve?: (discussionId: string, resolved: boolean) => Promise<void>;
}

export function DiscussionThread({ discussion, defaultExpanded = false, compact = false, fileLink, onReply, onResolve }: Props) {
  const { preferences } = usePreferencesContext();
  const notes = discussion.notes.filter((n) => !n.system);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [resolving, setResolving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const firstNote = notes[0];
  const replyCount = notes.length - 1;
  const isResolved = !!firstNote?.resolvable && !!firstNote.resolved;

  const rootClass = [
    styles.thread,
    compact ? styles.compact : "",
    isResolved ? styles.resolved : "",
  ].filter(Boolean).join(" ");

  const handleReply = useCallback(async () => {
    if (!onReply || !replyText.trim()) return;
    setReplying(true);
    try {
      await onReply(discussion.id, replyText.trim());
      setReplyText("");
    } finally {
      setReplying(false);
    }
  }, [onReply, replyText, discussion.id]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleReply();
    }
  }, [handleReply]);

  const handleResolve = useCallback(async () => {
    if (!onResolve) return;
    setResolving(true);
    try {
      await onResolve(discussion.id, !isResolved);
    } finally {
      setResolving(false);
    }
  }, [onResolve, discussion.id, isResolved]);

  if (!firstNote) return null;

  return (
    <div className={rootClass}>
      {/* Header bar — always visible */}
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <ChevronRightIcon
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
        />
        <Avatar avatarUrl={firstNote.author.avatar_url} name={firstNote.author.name} size={compact ? 18 : 20} />
        <span className={styles.authorName}>{firstNote.author.name}</span>
        {fileLink && (
          <button
            className={styles.fileLink}
            onClick={(e) => { e.stopPropagation(); fileLink.onClick(); }}
            title={fileLink.title}
          >
            {fileLink.label}
          </button>
        )}
        {!expanded && (
          <span className={styles.preview}>{firstNote.body}</span>
        )}
        <span className={styles.meta}>
          {isResolved && <span className={styles.resolvedBadge}>Resolved</span>}
          {onResolve && firstNote.resolvable && expanded && (
            <button
              className={`${styles.resolveBtn} ${isResolved ? styles.resolveBtnActive : ""}`}
              onClick={(e) => { e.stopPropagation(); handleResolve(); }}
              disabled={resolving}
            >
              {resolving ? "..." : isResolved ? "Unresolve" : "Resolve"}
            </button>
          )}
          {replyCount > 0 && (
            <span className={styles.replyCount}>
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </span>
          )}
          <span className={styles.time}>
            <RelativeTime date={firstNote.created_at} />
          </span>
        </span>
      </div>

      {/* Expanded: all notes */}
      {expanded && (
        <div className={styles.notes}>
          {notes.map((note, i) => (
            <div key={note.id} className={styles.note}>
              {i < notes.length - 1 && <div className={styles.connector} />}
              <div className={styles.noteAvatar}>
                <Avatar avatarUrl={note.author.avatar_url} name={note.author.name} size={compact ? 18 : 22} />
              </div>
              <div className={styles.noteContent}>
                <div className={styles.noteHeader}>
                  <span className={styles.noteAuthor}>{note.author.name}</span>
                  <span className={styles.noteTime}>
                    <RelativeTime date={note.created_at} />
                  </span>
                </div>
                <div className={styles.noteBody}>
                  <MarkdownBody content={note.body} jiraBaseUrl={preferences.jiraBaseUrl} compact={compact} />
                </div>
              </div>
            </div>
          ))}
          {onReply && (
            <div className={styles.replyBox}>
              <textarea
                ref={textareaRef}
                className={styles.replyInput}
                placeholder="Reply... (Ctrl+Enter to send)"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={replying}
              />
              <button
                className={styles.replyBtn}
                onClick={handleReply}
                disabled={replying || !replyText.trim()}
              >
                {replying ? "Sending..." : "Reply"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
