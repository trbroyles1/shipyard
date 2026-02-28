import styles from "./LabelPills.module.css";

interface Props {
  labels: string[];
  draft: boolean;
  conflicts: boolean;
}

export function LabelPills({ labels, draft, conflicts }: Props) {
  return (
    <div className={styles.badges}>
      {labels.map((l) => (
        <span key={l} className={styles.pill}>{l}</span>
      ))}
      {draft && <span className={`${styles.pill} ${styles.draft}`}>Draft</span>}
      {conflicts && <span className={`${styles.pill} ${styles.conflicts}`}>Conflicts</span>}
    </div>
  );
}
