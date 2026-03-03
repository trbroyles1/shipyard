"use client";

import { useUIPanel } from "@/components/providers/UIPanelProvider";
import { MRList } from "@/components/sidebar/MRList";
import { FilterTabs } from "@/components/sidebar/FilterTabs";
import { SortControl } from "@/components/sidebar/SortControl";
import { ChevronRightIcon } from "@/components/shared/icons";
import type { MRSummary } from "@/lib/types/mr";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  mrs: MRSummary[];
  isLoading: boolean;
}

export function Sidebar({ mrs, isLoading }: SidebarProps) {
  const { sidebarOpen, setSidebarOpen } = useUIPanel();

  return (
    <>
      <button
        className={`${styles.toggle} ${sidebarOpen ? styles.toggleOpen : ""}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
      >
        {sidebarOpen ? (
          <ChevronRightIcon size={12} style={{ transform: "rotate(180deg)" }} />
        ) : (
          <ChevronRightIcon size={12} />
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
