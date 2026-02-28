"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { MRSummary } from "@/lib/types/mr";

export type FilterMode = "mine" | "to-review" | "all";
export type SortField = "age" | "repo";
export type SortDirection = "asc" | "desc";

interface AppState {
  selectedMR: MRSummary | null;
  selectMR: (mr: MRSummary | null) => void;
  filter: FilterMode;
  setFilter: (filter: FilterMode) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  toggleSort: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [selectedMR, setSelectedMR] = useState<MRSummary | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sortField, setSortField] = useState<SortField>("age");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const selectMR = useCallback((mr: MRSummary | null) => {
    setSelectedMR(mr);
  }, []);

  const toggleSort = useCallback(() => {
    setSortField((prev) => {
      if (prev === "age") {
        // If switching from age asc -> age desc -> repo asc -> repo desc -> age asc
        if (sortDirection === "asc") {
          setSortDirection("desc");
          return "age";
        } else {
          setSortDirection("asc");
          return "repo";
        }
      } else {
        if (sortDirection === "asc") {
          setSortDirection("desc");
          return "repo";
        } else {
          setSortDirection("asc");
          return "age";
        }
      }
    });
  }, [sortDirection]);

  return (
    <AppStateContext.Provider
      value={{
        selectedMR,
        selectMR,
        filter,
        setFilter,
        sortField,
        sortDirection,
        toggleSort,
        sidebarOpen,
        setSidebarOpen,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
