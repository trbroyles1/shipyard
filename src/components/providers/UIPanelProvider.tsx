"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

export type TabId = "changes" | "commits" | "discussions" | "pipeline" | "history";

interface UIPanelState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  scrollToFile: string | null;
  setScrollToFile: (path: string | null) => void;
}

const UIPanelContext = createContext<UIPanelState | null>(null);

export function UIPanelProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("changes");
  const [scrollToFile, setScrollToFile] = useState<string | null>(null);

  const value = useMemo<UIPanelState>(() => ({
    sidebarOpen,
    setSidebarOpen,
    activeTab,
    setActiveTab,
    scrollToFile,
    setScrollToFile,
  }), [sidebarOpen, activeTab, scrollToFile]);

  return (
    <UIPanelContext.Provider value={value}>
      {children}
    </UIPanelContext.Provider>
  );
}

export function useUIPanel(): UIPanelState {
  const ctx = useContext(UIPanelContext);
  if (!ctx) throw new Error("useUIPanel must be used within UIPanelProvider");
  return ctx;
}
