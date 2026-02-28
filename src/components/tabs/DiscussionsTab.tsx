"use client";

import type { GitLabDiscussion, GitLabNote } from "@/lib/types/gitlab";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { Avatar } from "@/components/shared/Avatar";
import styles from "./DiscussionsTab.module.css";

interface Props {
  discussions: GitLabDiscussion[];
}

export function DiscussionsTab({ discussions }: Props) {
  // Filter out system-only discussions (just system notes)
  const humanDiscussions = discussions.filter(
    (d) => d.notes.some((n) => !n.system)
  );

  if (humanDiscussions.length === 0) {
    return <div className={styles.empty}>No discussions yet.</div>;
  }

  return (
    <div className={styles.list}>
      {humanDiscussions.map((d) => (
        <DiscussionThread key={d.id} discussion={d} />
      ))}
    </div>
  );
}

function DiscussionThread({ discussion }: { discussion: GitLabDiscussion }) {
  const notes = discussion.notes.filter((n) => !n.system);
  const firstNote = notes[0];
  if (!firstNote) return null;

  const isResolved = firstNote.resolvable && firstNote.resolved;
  const hasPosition = !!firstNote.position;

  return (
    <div className={`${styles.thread} ${isResolved ? styles.resolved : ""}`}>
      {hasPosition && firstNote.position && (
        <div className={styles.filePath}>
          {firstNote.position.new_path}
          {firstNote.position.new_line != null && `:${firstNote.position.new_line}`}
        </div>
      )}
      {isResolved && (
        <div className={styles.resolvedBadge}>Resolved</div>
      )}
      {notes.map((note) => (
        <NoteItem key={note.id} note={note} />
      ))}
    </div>
  );
}

function NoteItem({ note }: { note: GitLabNote }) {
  return (
    <div className={styles.note}>
      <div className={styles.noteHeader}>
        <Avatar avatarUrl={note.author.avatar_url} name={note.author.name} size={22} />
        <span className={styles.authorName}>{note.author.name}</span>
        <span className={styles.noteTime}>
          <RelativeTime date={note.created_at} />
        </span>
      </div>
      <div className={styles.noteBody}>{note.body}</div>
    </div>
  );
}
