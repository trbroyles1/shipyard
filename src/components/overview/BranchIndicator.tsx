import styles from "./BranchIndicator.module.css";

interface Props {
  source: string;
  target: string;
}

export function BranchIndicator({ source, target }: Props) {
  return (
    <div className={styles.branches}>
      <span className={styles.branch}>{source}</span>
      <span className={styles.arrow}>&rarr;</span>
      <span className={styles.branch}>{target}</span>
    </div>
  );
}
