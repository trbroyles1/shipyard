"use client";

import styles from "./DescriptionBody.module.css";

interface Props {
  text: string;
}

const JIRA_PATTERN = /\b([A-Z]{2,10}-\d{1,6})\b/g;

export function DescriptionBody({ text }: Props) {
  const parts: (string | JSX.Element)[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  // Reset lastIndex since we reuse the regex
  JIRA_PATTERN.lastIndex = 0;
  while ((match = JIRA_PATTERN.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const ticket = match[1];
    parts.push(
      <span key={match.index} className={styles.jiraLink}>
        {ticket}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return <div className={styles.body}>{parts}</div>;
}
