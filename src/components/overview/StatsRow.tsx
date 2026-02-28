import { StatusDot } from "@/components/shared/StatusDot";
import styles from "./StatsRow.module.css";

interface Props {
  pipelineStatus: string | null;
  approvalsGiven: number;
  approvalsRequired: number;
  changesCount: number;
  authorUsername: string;
  authorUrl: string;
}

function pipelineLabel(status: string): string {
  const labels: Record<string, string> = {
    success: "Passed",
    running: "Running",
    failed: "Failed",
    pending: "Pending",
    canceled: "Canceled",
  };
  return labels[status] || "Unknown";
}

export function StatsRow({ pipelineStatus, approvalsGiven, approvalsRequired, changesCount, authorUsername, authorUrl }: Props) {
  return (
    <div className={styles.stats}>
      {pipelineStatus && (
        <div className={styles.stat}>
          <StatusDot status={pipelineStatus} />
          Pipeline {pipelineLabel(pipelineStatus)}
        </div>
      )}
      <div className={styles.stat}>
        Approvals: {approvalsGiven}/{approvalsRequired}
        {approvalsGiven >= approvalsRequired && approvalsRequired > 0 ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--grn)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        )}
      </div>
      <div className={styles.stat}>{changesCount} files changed</div>
      <div className={styles.stat}>
        Opened by{" "}
        <a href={authorUrl} target="_blank" rel="noreferrer" className={styles.authorLink}>
          @{authorUsername}
        </a>
      </div>
    </div>
  );
}
