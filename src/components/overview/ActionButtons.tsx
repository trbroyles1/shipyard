import styles from "./ActionButtons.module.css";

interface Props {
  mergeable: boolean;
  mergeStatus: string;
  webUrl: string;
}

export function ActionButtons({ mergeable, webUrl }: Props) {
  return (
    <div className={styles.actions}>
      <button className={`${styles.btn} ${styles.approve}`} disabled title="Phase 4">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Approve
      </button>
      <button className={`${styles.btn} ${styles.requestChanges}`} disabled title="Phase 4">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        Request Changes
      </button>
      <button className={`${styles.btn} ${styles.merge}`} disabled title={mergeable ? "Phase 4" : "Not mergeable"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
        {mergeable ? "Merge" : "Not Mergeable"}
      </button>
      <a
        href={webUrl}
        target="_blank"
        rel="noreferrer"
        className={`${styles.btn} ${styles.external}`}
      >
        Open in GitLab
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>
  );
}
