"use client";

import { AppStateProvider } from "@/components/providers/AppStateProvider";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainContent } from "@/components/layout/MainContent";
import { useMRList } from "@/hooks/use-mr-list";
import styles from "./Dashboard.module.css";

function DashboardInner() {
  const { mrs, isLoading, error } = useMRList();

  return (
    <div className={styles.shell}>
      <TopBar />
      <div className={styles.body}>
        <Sidebar mrs={mrs} isLoading={isLoading} />
        <MainContent />
      </div>
      {error && (
        <div className={styles.errorBar}>
          Failed to load merge requests: {error}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  return (
    <AppStateProvider>
      <DashboardInner />
    </AppStateProvider>
  );
}
