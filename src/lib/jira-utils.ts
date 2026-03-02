/** Shared JIRA ticket detection and URL construction. */

export const JIRA_TICKET_RE = /\b([A-Z]{2,10}-\d{1,6})\b/g;

export const normalizeJiraBaseUrl = (url: string | undefined) =>
  url?.replace(/\/+$/, "");

export const jiraTicketUrl = (baseUrl: string, ticket: string) =>
  `${baseUrl}/browse/${ticket}`;
