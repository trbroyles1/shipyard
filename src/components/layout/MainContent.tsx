"use client";

import { useAppState } from "@/components/providers/AppStateProvider";
import { useMRDetail } from "@/hooks/use-mr-detail";
import { EmptyState } from "@/components/shared/EmptyState";
import { MROverview } from "@/components/overview/MROverview";
import { TabBar } from "@/components/tabs/TabBar";
import { TabContent } from "@/components/tabs/TabContent";
import styles from "./MainContent.module.css";

export function MainContent() {
  const { selectedMR } = useAppState();
  const { data, isLoading, error } = useMRDetail(selectedMR);

  if (!selectedMR) {
    return (
      <main className={styles.main}>
        <EmptyState />
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className={styles.main}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading merge request details...</span>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className={styles.main}>
        <div className={styles.error}>
          <span className={styles.errorIcon}>!</span>
          <span>{error || "Failed to load merge request"}</span>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <MROverview summary={selectedMR} detail={data} />
      <TabBar
        changesCount={data.diffs.length}
        commitsCount={data.commits.length}
        discussionsCount={data.discussions.filter((d) => d.notes.some((n) => !n.system)).length}
        pipelinesCount={data.pipelines.length}
        notesCount={data.notes.length}
      />
      <TabContent data={data} />
    </main>
  );
}
