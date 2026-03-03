"use client";

import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode } from "react";
import type { GitLabMergeRequest, GitLabApprovals } from "@/lib/types/gitlab";

export interface DetailPatch {
  mr: GitLabMergeRequest;
  approvals: GitLabApprovals;
}

interface DetailPatchState {
  detailPatchVersion: number;
  pushDetailPatch: (patch: DetailPatch) => void;
  consumeAllDetailPatches: () => DetailPatch[];
}

const DetailPatchContext = createContext<DetailPatchState | null>(null);

export function DetailPatchProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo<DetailPatchState>(() => ({
    detailPatchVersion,
    pushDetailPatch,
    consumeAllDetailPatches,
  }), [detailPatchVersion, pushDetailPatch, consumeAllDetailPatches]);

  return (
    <DetailPatchContext.Provider value={value}>
      {children}
    </DetailPatchContext.Provider>
  );
}

export function useDetailPatch(): DetailPatchState {
  const ctx = useContext(DetailPatchContext);
  if (!ctx) throw new Error("useDetailPatch must be used within DetailPatchProvider");
  return ctx;
}
