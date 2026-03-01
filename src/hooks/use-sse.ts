"use client";

import { useEffect, useRef } from "react";
import type { SSEEventType } from "@/lib/types/events";

interface UseSSEOptions {
  onEvent: (type: SSEEventType, data: unknown) => void;
}

export function useSSE({ onEvent }: UseSSEOptions) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      es = new EventSource("/api/sse");

      const eventTypes: SSEEventType[] = [
        "mr-list",
        "mr-new",
        "mr-update",
        "mr-removed",
        "mr-ready-to-merge",
        "status",
      ];

      for (const type of eventTypes) {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            onEventRef.current(type, data);
          } catch {
            // ignore parse errors
          }
        });
      }

      es.onerror = () => {
        es?.close();
        // Reconnect after 5 seconds
        reconnectTimer = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);
}
