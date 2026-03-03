/** Shared JIRA ticket detection and URL construction. */

import type { ReactNode } from "react";

export const JIRA_TICKET_RE = /\b([A-Z]{2,10}-\d{1,6})\b/g;

export const normalizeJiraBaseUrl = (url: string | undefined) =>
  url?.replace(/\/+$/, "");

export const jiraTicketUrl = (baseUrl: string, ticket: string) =>
  `${baseUrl}/browse/${ticket}`;

/**
 * Scan `text` for JIRA ticket IDs and return a mixed array of plain strings
 * and React anchor/span elements. When `baseUrl` is provided, tickets become
 * clickable links; otherwise they render as styled spans.
 */
export function linkifyJiraTickets(
  text: string,
  baseUrl: string | undefined,
  className: string,
): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const normalized = normalizeJiraBaseUrl(baseUrl);

  JIRA_TICKET_RE.lastIndex = 0;
  while ((match = JIRA_TICKET_RE.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const ticket = match[1];
    if (normalized) {
      parts.push(
        <a
          key={`jira-${match.index}`}
          className={className}
          href={jiraTicketUrl(normalized, ticket)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {ticket}
        </a>,
      );
    } else {
      parts.push(
        <span key={`jira-${match.index}`} className={className}>
          {ticket}
        </span>,
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts.length > 0 ? parts : [text];
}
