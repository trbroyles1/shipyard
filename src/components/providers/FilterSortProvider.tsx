"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

export type FilterMode = "mine" | "to-review" | "all";
export type SortField = "age" | "repo";
export type SortDirection = "asc" | "desc";

interface FilterSortState {
  filter: FilterMode;
  setFilter: (filter: FilterMode) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  toggleSort: () => void;
}

const FilterSortContext = createContext<FilterSortState | null>(null);

export function FilterSortProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({ field: "age", direction: "asc" });

  const toggleSort = useCallback(() => {
    setSort((prev) => {
      if (prev.field === "age" && prev.direction === "asc") return { field: "age", direction: "desc" };
      if (prev.field === "age" && prev.direction === "desc") return { field: "repo", direction: "asc" };
      if (prev.field === "repo" && prev.direction === "asc") return { field: "repo", direction: "desc" };
      return { field: "age", direction: "asc" };
    });
  }, []);

  const value = useMemo<FilterSortState>(() => ({
    filter,
    setFilter,
    sortField: sort.field,
    sortDirection: sort.direction,
    toggleSort,
  }), [filter, sort.field, sort.direction, toggleSort]);

  return (
    <FilterSortContext.Provider value={value}>
      {children}
    </FilterSortContext.Provider>
  );
}

export function useFilterSort(): FilterSortState {
  const ctx = useContext(FilterSortContext);
  if (!ctx) throw new Error("useFilterSort must be used within FilterSortProvider");
  return ctx;
}
