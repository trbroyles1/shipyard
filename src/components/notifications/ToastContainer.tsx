"use client";

import type { Toast } from "@/hooks/use-toasts";
import styles from "./ToastContainer.module.css";

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const TYPE_COLORS: Record<Toast["type"], string> = {
  info: "var(--acc)",
  success: "var(--grn)",
  warning: "var(--org)",
};

export function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={styles.toast}
          style={{ borderLeftColor: TYPE_COLORS[toast.type] }}
        >
          <div className={styles.content}>
            <div className={styles.title}>{toast.title}</div>
            <div className={styles.message}>{toast.message}</div>
          </div>
          <button
            className={styles.close}
            onClick={() => onDismiss(toast.id)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
