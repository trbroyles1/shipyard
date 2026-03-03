"use client";

import { useMRSelection } from "@/components/providers/MRSelectionProvider";
import { usePreferencesContext } from "@/components/providers/PreferencesProvider";
import { StatusDot } from "@/components/shared/StatusDot";
import { CheckIcon } from "@/components/shared/icons";
import { RelativeTime, hoursOld } from "@/components/shared/RelativeTime";
import { GitLabLink } from "@/components/shared/GitLabLink";
import { JiraText } from "@/components/shared/JiraText";
import type { MRSummary } from "@/lib/types/mr";
import { MERGE_STATUS_MERGEABLE } from "@/lib/constants";
import styles from "./MRCard.module.css";

interface MRCardProps {
  mr: MRSummary;
}

const CRITICAL_BG = "var(--red-d)";
const WARNING_BG = "var(--org-d)";

function cardBackground(createdAt: string, warningHours: number, criticalHours: number): string {
  const hours = hoursOld(createdAt);
  if (hours > criticalHours) return CRITICAL_BG;
  if (hours > warningHours) return WARNING_BG;
  return "transparent";
}

export function MRCard({ mr }: MRCardProps) {
  const { selectedMR, selectMR } = useMRSelection();
  const { preferences } = usePreferencesContext();
  const isSelected = selectedMR?.id === mr.id;
  const isMergeable = mr.detailedMergeStatus === MERGE_STATUS_MERGEABLE && !mr.draft;

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ""}`}
      style={{ background: isSelected ? undefined : cardBackground(mr.createdAt, preferences.warningHours, preferences.criticalHours) }}
      onClick={() => selectMR(mr)}
    >
      <div className={styles.title}>
        <span className={styles.repo}>{mr.repo}</span>: <JiraText text={mr.title} jiraBaseUrl={preferences.jiraBaseUrl} />
      </div>
      {mr.draft && <div className={styles.draft}>Draft</div>}
      {isMergeable && (
        <div className={styles.ready}>
          <CheckIcon size={12} />
          Ready to merge
        </div>
      )}
      <div className={styles.meta}>
        <GitLabLink href={mr.author.webUrl}>
          @{mr.author.username}
        </GitLabLink>
        <RelativeTime date={mr.createdAt} />
        {mr.pipeline && (
          <StatusDot status={mr.pipeline.status} />
        )}
        <span className={styles.approvals}>
          <span
            className={styles.approvalDot}
            style={{
              background: mr.approvalsGiven >= mr.approvalsRequired && mr.approvalsRequired > 0
                ? "var(--grn)"
                : "var(--red)",
            }}
          />
          {mr.approvalsGiven}/{mr.approvalsRequired}
        </span>
      </div>
    </div>
  );
}
