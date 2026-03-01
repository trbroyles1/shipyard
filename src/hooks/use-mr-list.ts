"use client";

import { useState, useCallback, useRef } from "react";
import type { MRSummary } from "@/lib/types/mr";
import type { SSEEventType } from "@/lib/types/events";
import { useSSE } from "./use-sse";

export type MREvent =
  | { type: "mr-new"; data: MRSummary }
  | { type: "mr-update"; data: MRSummary }
  | { type: "mr-removed"; data: { id: number } }
  | { type: "mr-ready-to-merge"; data: MRSummary };

interface UseMRListResult {
  mrs: MRSummary[];
  isLoading: boolean;
  error: string | null;
}

export function useMRList(onMREvent?: (event: MREvent) => void) {
  const [mrs, setMrs] = useState<MRSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onMREventRef = useRef(onMREvent);
  onMREventRef.current = onMREvent;

  const handleSSE = useCallback((type: SSEEventType, data: unknown) => {
    switch (type) {
      case "status": {
        const status = data as { state: string };
        if (status.state === "ready") {
          setIsLoading(false);
          setError(null);
        }
        break;
      }
      case "mr-list": {
        const list = data as MRSummary[];
        setMrs(list);
        setIsLoading(false);
        break;
      }
      case "mr-new": {
        const mr = data as MRSummary;
        setMrs((prev) => [...prev, mr]);
        onMREventRef.current?.({ type: "mr-new", data: mr });
        break;
      }
      case "mr-update": {
        const mr = data as MRSummary;
        setMrs((prev) => prev.map((m) => (m.id === mr.id ? mr : m)));
        onMREventRef.current?.({ type: "mr-update", data: mr });
        break;
      }
      case "mr-removed": {
        const { id } = data as { id: number };
        setMrs((prev) => prev.filter((m) => m.id !== id));
        onMREventRef.current?.({ type: "mr-removed", data: { id } });
        break;
      }
      case "mr-ready-to-merge": {
        const mr = data as MRSummary;
        onMREventRef.current?.({ type: "mr-ready-to-merge", data: mr });
        break;
      }
    }
  }, []);

  useSSE({ onEvent: handleSSE });

  return { mrs, isLoading, error } as UseMRListResult;
}
