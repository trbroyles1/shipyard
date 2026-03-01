"use client";

import { JiraText } from "@/components/shared/JiraText";
import styles from "./DescriptionBody.module.css";

interface Props {
  text: string;
  jiraBaseUrl?: string;
}

export function DescriptionBody({ text, jiraBaseUrl }: Props) {
  return (
    <div className={styles.body}>
      <JiraText text={text} jiraBaseUrl={jiraBaseUrl} />
    </div>
  );
}
