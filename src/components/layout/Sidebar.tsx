"use client";

import { useAppState } from "@/components/providers/AppStateProvider";
import { MRList } from "@/components/sidebar/MRList";
import { FilterTabs } from "@/components/sidebar/FilterTabs";
import { SortControl } from "@/components/sidebar/SortControl";
import type { MRSummary } from "@/lib/types/mr";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  mrs: MRSummary[];
  isLoading: boolean;
}

export function Sidebar({ mrs, isLoading }: SidebarProps) {
  const { sidebarOpen, setSidebarOpen } = useAppState();

  return (
    <>
      <button
        className={`${styles.toggle} ${sidebarOpen ? styles.toggleOpen : ""}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {sidebarOpen ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        )}
      </button>
      <aside className={`${styles.sidebar} ${!sidebarOpen ? styles.collapsed : ""}`}>
        <div className={styles.header}>
          <FilterTabs />
          <SortControl count={mrs.length} />
        </div>
        <MRList mrs={mrs} isLoading={isLoading} />
      </aside>
    </>
  );
}
