import { StatusDot } from "@/components/shared/StatusDot";
import { CheckIcon, XIcon } from "@/components/shared/icons";
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
          <CheckIcon stroke="var(--grn)" />
        ) : (
          <XIcon stroke="var(--red)" />
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
