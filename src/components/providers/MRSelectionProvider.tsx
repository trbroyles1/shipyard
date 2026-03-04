"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { MRSummary } from "@/lib/types/mr";

interface MRSelectionState {
  selectedMR: MRSummary | null;
  selectMR: (mr: MRSummary | null) => void;
  updateSelectedMR: (mr: MRSummary) => void;
  detailVersion: number;
}

const MRSelectionContext = createContext<MRSelectionState | null>(null);

export function MRSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedMR, setSelectedMR] = useState<MRSummary | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);

  const selectMR = useCallback((mr: MRSummary | null) => {
    setSelectedMR(mr);
  }, []);

  const updateSelectedMR = useCallback((mr: MRSummary) => {
    setSelectedMR((prev) => {
      if (prev?.id !== mr.id) return prev;
      setDetailVersion((v) => v + 1);
      return mr;
    });
  }, []);

  const value = useMemo<MRSelectionState>(() => ({
    selectedMR,
    selectMR,
    updateSelectedMR,
    detailVersion,
  }), [selectedMR, selectMR, updateSelectedMR, detailVersion]);

  return (
    <MRSelectionContext.Provider value={value}>
      {children}
    </MRSelectionContext.Provider>
  );
}

export function useMRSelection(): MRSelectionState {
  const ctx = useContext(MRSelectionContext);
  if (!ctx) throw new Error("useMRSelection must be used within MRSelectionProvider");
  return ctx;
}
