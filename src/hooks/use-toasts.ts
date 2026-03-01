"use client";

import { useState, useCallback, useRef } from "react";

export interface Toast {
  id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning";
}

let nextId = 1;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

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
      const id = nextId++;
      setToasts((prev) => [...prev, { id, title, message, type }]);
      const timer = setTimeout(() => dismiss(id), 4000);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  return { toasts, addToast, dismiss };
}
