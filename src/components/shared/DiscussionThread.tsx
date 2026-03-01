"use client";

import { useState } from "react";
import type { GitLabDiscussion } from "@/lib/types/gitlab";
import { Avatar } from "./Avatar";
import { RelativeTime } from "./RelativeTime";
import styles from "./DiscussionThread.module.css";

interface Props {
  discussion: GitLabDiscussion;
  defaultExpanded?: boolean;
  compact?: boolean;
  fileLink?: { label: string; title?: string; onClick: () => void };
}

export function DiscussionThread({ discussion, defaultExpanded = false, compact = false, fileLink }: Props) {
  const notes = discussion.notes.filter((n) => !n.system);
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (notes.length === 0) return null;

  const firstNote = notes[0];
  const replyCount = notes.length - 1;
  const isResolved = firstNote.resolvable && firstNote.resolved;

  const rootClass = [
    styles.thread,
    compact ? styles.compact : "",
    isResolved ? styles.resolved : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      {/* Header bar — always visible */}
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
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
                <div className={styles.noteBody}>{note.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
