"use client";

import { linkifyJiraTickets } from "@/lib/jira-utils";
import styles from "./JiraText.module.css";

interface Props {
  text: string;
  jiraBaseUrl?: string;
  className?: string;
}

export function JiraText({ text, jiraBaseUrl, className }: Props) {
  const parts = linkifyJiraTickets(text, jiraBaseUrl, styles.jiraLink);
  return <span className={className}>{parts}</span>;
}
