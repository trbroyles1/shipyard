"use client";

import { useFilterSort } from "@/components/providers/FilterSortProvider";
import styles from "./SortControl.module.css";

interface SortControlProps {
  count: number;
}

export function SortControl({ count }: SortControlProps) {
  const { sortField, sortDirection, toggleSort } = useFilterSort();

  const label = sortField === "age" ? "Age" : "Repo";

  return (
    <div className={styles.row}>
      <span className={styles.count}>
        {count} merge request{count !== 1 ? "s" : ""}
      </span>
      <button
        className={`${styles.button} ${sortDirection === "asc" ? styles.asc : ""}`}
        onClick={toggleSort}
        title={`Sort by ${label} (${sortDirection})`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <polyline points="19 12 12 19 5 12"/>
        </svg>
        {label}
      </button>
    </div>
  );
}
