"use client";

import type { GitLabDiscussion } from "@/lib/types/gitlab";
import { useAppState } from "@/components/providers/AppStateProvider";
import { DiscussionThread } from "@/components/shared/DiscussionThread";
import styles from "./DiscussionsTab.module.css";

interface Props {
  discussions: GitLabDiscussion[];
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

export function DiscussionsTab({ discussions }: Props) {
  const { setActiveTab, setScrollToFile } = useAppState();

  // Filter out system-only discussions (just system notes)
  const humanDiscussions = discussions.filter(
    (d) => d.notes.some((n) => !n.system)
  );

  if (humanDiscussions.length === 0) {
    return <div className={styles.empty}>No discussions yet.</div>;
  }

  return (
    <div className={styles.list}>
      {humanDiscussions.map((d) => {
        const link = buildFileLink(d);
        return (
          <DiscussionThread
            key={d.id}
            discussion={d}
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
      })}
    </div>
  );
}
