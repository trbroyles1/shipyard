"use client";

import { useAppState } from "@/components/providers/AppStateProvider";
import { StatusDot } from "@/components/shared/StatusDot";
import { RelativeTime, hoursOld } from "@/components/shared/RelativeTime";
import { GitLabLink } from "@/components/shared/GitLabLink";
import type { MRSummary } from "@/lib/types/mr";
import styles from "./MRCard.module.css";

interface MRCardProps {
  mr: MRSummary;
}

const WARNING_HOURS = 10;
const CRITICAL_HOURS = 20;

function cardBackground(createdAt: string): string {
  const hours = hoursOld(createdAt);
  if (hours > CRITICAL_HOURS) return "rgba(220, 38, 38, 0.12)";
  if (hours > WARNING_HOURS) return "rgba(234, 179, 8, 0.10)";
  return "transparent";
}

export function MRCard({ mr }: MRCardProps) {
  const { selectedMR, selectMR } = useAppState();
  const isSelected = selectedMR?.id === mr.id;
  const isMergeable = mr.detailedMergeStatus === "mergeable" && !mr.draft;

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ""}`}
      style={{ background: isSelected ? undefined : cardBackground(mr.createdAt) }}
      onClick={() => selectMR(mr)}
    >
      <div className={styles.title}>
        <span className={styles.repo}>{mr.repo}</span>: {mr.title}
      </div>
      {mr.draft && <div className={styles.draft}>Draft</div>}
      {isMergeable && (
        <div className={styles.ready}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
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
