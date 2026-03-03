"use client";

import { useFilterSort, type FilterMode } from "@/components/providers/FilterSortProvider";
import styles from "./FilterTabs.module.css";

const TABS: { value: FilterMode; label: string }[] = [
  { value: "mine", label: "Mine" },
  { value: "to-review", label: "To Review" },
  { value: "all", label: "All Open" },
];

export function FilterTabs() {
  const { filter, setFilter } = useFilterSort();

  return (
    <div className={styles.tabs}>
      {TABS.map((tab) => (
        <button
          key={tab.value}
          className={`${styles.tab} ${filter === tab.value ? styles.active : ""}`}
          onClick={() => setFilter(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
