"use client";

import { useState, useEffect, useCallback } from "react";
import type { MRSummary } from "@/lib/types/mr";

export function useMRList() {
  const [mrs, setMrs] = useState<MRSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMRs = useCallback(async () => {
    try {
      const response = await fetch("/api/gitlab/merge-requests");
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const data: MRSummary[] = await response.json();
      setMrs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch MRs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMRs();
  }, [fetchMRs]);

  return { mrs, isLoading, error, refetch: fetchMRs };
}
