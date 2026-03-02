"use client";

import { JIRA_TICKET_RE, normalizeJiraBaseUrl, jiraTicketUrl } from "@/lib/jira-utils";
import styles from "./JiraText.module.css";

interface Props {
  text: string;
  jiraBaseUrl?: string;
  className?: string;
}

export function JiraText({ text, jiraBaseUrl, className }: Props) {
  const parts: (string | JSX.Element)[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const baseUrl = normalizeJiraBaseUrl(jiraBaseUrl);

  JIRA_TICKET_RE.lastIndex = 0;
  while ((match = JIRA_TICKET_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const ticket = match[1];
    if (baseUrl) {
      parts.push(
        <a
          key={match.index}
          className={styles.jiraLink}
          href={jiraTicketUrl(baseUrl, ticket)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
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
