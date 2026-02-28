import styles from "./EmptyState.module.css";

export function EmptyState() {
  return (
    <div className={styles.container}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
        <circle cx="18" cy="18" r="3"/>
        <circle cx="6" cy="6" r="3"/>
        <path d="M6 21V9a9 9 0 0 0 9 9"/>
      </svg>
      <span className={styles.text}>Select a merge request to get started</span>
    </div>
  );
}
