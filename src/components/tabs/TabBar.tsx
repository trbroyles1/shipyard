"use client";

import { useUIPanel, type TabId } from "@/components/providers/UIPanelProvider";
import styles from "./TabBar.module.css";

interface TabDef {
  id: TabId;
  label: string;
  count?: number;
}

interface Props {
  changesCount: number;
  commitsCount: number;
  discussionsCount: number;
  pipelinesCount: number;
  notesCount: number;
}

export function TabBar({ changesCount, commitsCount, discussionsCount, pipelinesCount, notesCount }: Props) {
  const { activeTab, setActiveTab } = useUIPanel();

  const tabs: TabDef[] = [
    { id: "changes", label: "Changes", count: changesCount },
    { id: "commits", label: "Commits", count: commitsCount },
    { id: "discussions", label: "Discussions", count: discussionsCount },
    { id: "pipeline", label: "Pipeline", count: pipelinesCount },
    { id: "history", label: "History", count: notesCount },
  ];

  return (
    <div className={styles.tabBar}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className={styles.badge}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
