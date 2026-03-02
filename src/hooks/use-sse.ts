"use client";

import { useEffect, useRef, useState } from "react";
import type { SSEEventType } from "@/lib/types/events";

const INITIAL_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

interface UseSSEOptions {
  onEvent: (type: SSEEventType, data: unknown) => void;
}

interface UseSSEResult {
  isDisplaced: boolean;
}

export function useSSE({ onEvent }: UseSSEOptions): UseSSEResult {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const tabIdRef = useRef(crypto.randomUUID());
  const displacedRef = useRef(false);
  const [isDisplaced, setIsDisplaced] = useState(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let delay = INITIAL_DELAY_MS;

    function connect() {
      es = new EventSource(`/api/sse?tabId=${tabIdRef.current}`);

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
        "session-displaced",
      ];

      for (const type of eventTypes) {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);

            if (type === "session-displaced") {
              displacedRef.current = true;
              setIsDisplaced(true);
              es?.close();
              onEventRef.current(type, data);
              return;
            }

            onEventRef.current(type, data);
            delay = INITIAL_DELAY_MS;
          } catch {
            // ignore parse errors
          }
        });
      }

      es.onerror = () => {
        if (displacedRef.current) return;
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

  return { isDisplaced };
}
