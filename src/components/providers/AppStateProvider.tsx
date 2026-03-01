"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
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
  consumeDetailPatch: () => DetailPatch | null;
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
  const [sortField, setSortField] = useState<SortField>("age");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("changes");
  const [scrollToFile, setScrollToFile] = useState<string | null>(null);

  const selectMR = useCallback((mr: MRSummary | null) => {
    setSelectedMR(mr);
  }, []);

  const updateSelectedMR = useCallback((mr: MRSummary) => {
    setSelectedMR((prev) => {
      if (!prev || prev.id !== mr.id) return prev;
      if (prev.updatedAt === mr.updatedAt) return prev;
      setDetailVersion((v) => v + 1);
      return mr;
    });
  }, []);

  // Lightweight patch channel: SSE detail updates set this, useMRDetail consumes it
  const detailPatchRef = useRef<DetailPatch | null>(null);
  const [detailPatchVersion, setDetailPatchVersion] = useState(0);

  const pushDetailPatch = useCallback((patch: DetailPatch) => {
    detailPatchRef.current = patch;
    setDetailPatchVersion((v) => v + 1);
  }, []);

  const consumeDetailPatch = useCallback(() => {
    const patch = detailPatchRef.current;
    detailPatchRef.current = null;
    return patch;
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
        updateSelectedMR,
        pushDetailPatch,
        consumeDetailPatch,
        detailPatchVersion,
        detailVersion,
        filter,
        setFilter,
        sortField,
        sortDirection,
        toggleSort,
        sidebarOpen,
        setSidebarOpen,
        activeTab,
        setActiveTab,
        scrollToFile,
        setScrollToFile,
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
