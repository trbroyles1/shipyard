"use client";

import styles from "./JiraText.module.css";

interface Props {
  text: string;
  jiraBaseUrl?: string;
  className?: string;
}

const JIRA_PATTERN = /\b([A-Z]{2,10}-\d{1,6})\b/g;

export function JiraText({ text, jiraBaseUrl, className }: Props) {
  const parts: (string | JSX.Element)[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const baseUrl = jiraBaseUrl?.replace(/\/+$/, "");

  JIRA_PATTERN.lastIndex = 0;
  while ((match = JIRA_PATTERN.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const ticket = match[1];
    if (baseUrl) {
      parts.push(
        <a
          key={match.index}
          className={styles.jiraLink}
          href={`${baseUrl}/browse/${ticket}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {ticket}
        </a>,
      );
    } else {
      parts.push(
        <span key={match.index} className={styles.jiraLink}>
          {ticket}
        </span>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return <span className={className}>{parts}</span>;
}
