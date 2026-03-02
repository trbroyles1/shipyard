"use client";

import { useState, useCallback, useRef } from "react";

export interface Toast {
  id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

const TOAST_DURATIONS: Record<Toast["type"], number> = {
  info: 4_000,
  success: 4_000,
  warning: 6_000,
  error: 10_000,
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (title: string, message: string, type: Toast["type"] = "info") => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((prev) => [...prev, { id, title, message, type }]);
      const timer = setTimeout(() => dismiss(id), TOAST_DURATIONS[type]);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  return { toasts, addToast, dismiss };
}
