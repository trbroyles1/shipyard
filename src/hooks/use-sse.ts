"use client";

import { useEffect, useRef } from "react";
import type { SSEEventType } from "@/lib/types/events";

const INITIAL_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

interface UseSSEOptions {
  onEvent: (type: SSEEventType, data: unknown) => void;
}

export function useSSE({ onEvent }: UseSSEOptions) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = INITIAL_DELAY_MS;

    function connect() {
      es = new EventSource("/api/sse");

      const eventTypes: SSEEventType[] = [
        "mr-list",
        "mr-new",
        "mr-update",
        "mr-removed",
        "mr-ready-to-merge",
        "mr-detail-update",
        "status",
        "error",
        "warning",
      ];

      for (const type of eventTypes) {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            onEventRef.current(type, data);
            delay = INITIAL_DELAY_MS;
          } catch {
            // ignore parse errors
          }
        });
      }

      es.onerror = () => {
        es?.close();
        reconnectTimer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, MAX_DELAY_MS);
      };
    }

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);
}
