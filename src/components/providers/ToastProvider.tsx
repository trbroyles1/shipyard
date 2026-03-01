"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useToasts, type Toast } from "@/hooks/use-toasts";

interface ToastContextValue {
  toasts: Toast[];
  addToast: (title: string, message: string, type?: Toast["type"]) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const value = useToasts();
  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastContext must be used within ToastProvider");
  return ctx;
}
