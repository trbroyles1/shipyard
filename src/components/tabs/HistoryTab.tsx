"use client";

import type { GitLabNote } from "@/lib/types/gitlab";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { Avatar } from "@/components/shared/Avatar";
import styles from "./HistoryTab.module.css";

interface Props {
  notes: GitLabNote[];
}

export function HistoryTab({ notes }: Props) {
  if (notes.length === 0) {
    return <div className={styles.empty}>No activity yet.</div>;
  }

  return (
    <div className={styles.timeline}>
      {notes.map((note) => (
        <div
          key={note.id}
          className={`${styles.entry} ${note.system ? styles.system : styles.comment}`}
        >
          <div className={styles.entryHeader}>
            <Avatar avatarUrl={note.author.avatar_url} name={note.author.name} size={20} />
            <span className={styles.authorName}>{note.author.name}</span>
            <span className={styles.time}>
              <RelativeTime date={note.created_at} />
            </span>
          </div>
          <div className={styles.body}>{note.body}</div>
        </div>
      ))}
    </div>
  );
}
