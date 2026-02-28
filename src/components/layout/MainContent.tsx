"use client";

import { useAppState } from "@/components/providers/AppStateProvider";
import { EmptyState } from "@/components/shared/EmptyState";
import styles from "./MainContent.module.css";

export function MainContent() {
  const { selectedMR } = useAppState();

  if (!selectedMR) {
    return (
      <main className={styles.main}>
        <EmptyState />
      </main>
    );
  }

  // Phase 2 will add MR detail view here
  return (
    <main className={styles.main}>
      <div className={styles.placeholder}>
        <span className={styles.placeholderText}>
          Selected: !{selectedMR.iid} {selectedMR.title}
        </span>
        <span className={styles.placeholderHint}>
          Detail view coming in Phase 2
        </span>
      </div>
    </main>
  );
}
