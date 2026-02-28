"use client";

import type { GitLabCommit } from "@/lib/types/gitlab";
import { RelativeTime } from "@/components/shared/RelativeTime";
import styles from "./CommitsTab.module.css";

interface Props {
  commits: GitLabCommit[];
}

export function CommitsTab({ commits }: Props) {
  if (commits.length === 0) {
    return <div className={styles.empty}>No commits.</div>;
  }

  return (
    <div className={styles.list}>
      {commits.map((commit) => (
        <div key={commit.id} className={styles.commit}>
          <div className={styles.header}>
            <a
              href={commit.web_url}
              target="_blank"
              rel="noreferrer"
              className={styles.sha}
            >
              {commit.short_id}
            </a>
            <span className={styles.date}>
              <RelativeTime date={commit.committed_date} />
            </span>
          </div>
          <div className={styles.title}>{commit.title}</div>
          <div className={styles.author}>{commit.author_name}</div>
        </div>
      ))}
    </div>
  );
}
