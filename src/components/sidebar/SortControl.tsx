"use client";

import { useFilterSort } from "@/components/providers/FilterSortProvider";
import { CaretDownIcon } from "@/components/shared/icons";
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
        <CaretDownIcon size={14} />
        {label}
      </button>
    </div>
  );
}
