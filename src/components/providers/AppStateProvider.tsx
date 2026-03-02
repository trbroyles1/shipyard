"use client";

import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode } from "react";
import type { MRSummary } from "@/lib/types/mr";
import type { GitLabMergeRequest, GitLabApprovals } from "@/lib/types/gitlab";

export type FilterMode = "mine" | "to-review" | "all";
export type SortField = "age" | "repo";
export type SortDirection = "asc" | "desc";
export type TabId = "changes" | "commits" | "discussions" | "pipeline" | "history";

export interface DetailPatch {
  mr: GitLabMergeRequest;
  approvals: GitLabApprovals;
}

interface AppState {
  selectedMR: MRSummary | null;
  selectMR: (mr: MRSummary | null) => void;
  updateSelectedMR: (mr: MRSummary) => void;
  pushDetailPatch: (patch: DetailPatch) => void;
  consumeAllDetailPatches: () => DetailPatch[];
  detailPatchVersion: number;
  detailVersion: number;
  filter: FilterMode;
  setFilter: (filter: FilterMode) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  toggleSort: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  scrollToFile: string | null;
  setScrollToFile: (path: string | null) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [selectedMR, setSelectedMR] = useState<MRSummary | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({ field: "age", direction: "asc" });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("changes");
  const [scrollToFile, setScrollToFile] = useState<string | null>(null);

  const selectMR = useCallback((mr: MRSummary | null) => {
    setSelectedMR(mr);
  }, []);

  const updateSelectedMR = useCallback((mr: MRSummary) => {
    setSelectedMR((prev) => {
      if (!prev || prev.id !== mr.id) return prev;
      setDetailVersion((v) => v + 1);
      return mr;
    });
  }, []);

  // Patch queue: SSE detail updates push here, useMRDetail consumes them
  const detailPatchQueueRef = useRef<DetailPatch[]>([]);
  const [detailPatchVersion, setDetailPatchVersion] = useState(0);

  const pushDetailPatch = useCallback((patch: DetailPatch) => {
    detailPatchQueueRef.current.push(patch);
    setDetailPatchVersion((v) => v + 1);
  }, []);

  const consumeAllDetailPatches = useCallback(() => {
    const patches = detailPatchQueueRef.current;
    detailPatchQueueRef.current = [];
    return patches;
  }, []);

  const toggleSort = useCallback(() => {
    setSort((prev) => {
      if (prev.field === "age" && prev.direction === "asc") return { field: "age", direction: "desc" };
      if (prev.field === "age" && prev.direction === "desc") return { field: "repo", direction: "asc" };
      if (prev.field === "repo" && prev.direction === "asc") return { field: "repo", direction: "desc" };
      return { field: "age", direction: "asc" };
    });
  }, []);

  const value = useMemo<AppState>(() => ({
    selectedMR,
    selectMR,
    updateSelectedMR,
    pushDetailPatch,
    consumeAllDetailPatches,
    detailPatchVersion,
    detailVersion,
    filter,
    setFilter,
    sortField: sort.field,
    sortDirection: sort.direction,
    toggleSort,
    sidebarOpen,
    setSidebarOpen,
    activeTab,
    setActiveTab,
    scrollToFile,
    setScrollToFile,
  }), [
    selectedMR,
    selectMR,
    updateSelectedMR,
    pushDetailPatch,
    consumeAllDetailPatches,
    detailPatchVersion,
    detailVersion,
    filter,
    sort.field,
    sort.direction,
    toggleSort,
    sidebarOpen,
    activeTab,
    scrollToFile,
  ]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
