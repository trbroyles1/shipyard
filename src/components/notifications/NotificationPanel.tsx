"use client";

import { useEffect, useRef } from "react";
import type { Notification } from "@/hooks/use-notifications";
import styles from "./NotificationPanel.module.css";

interface Props {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: () => void;
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  const minutes = Math.floor(d / 60000);
  const hours = Math.floor(d / 3600000);
  if (minutes < 1) return "just now";
  if (hours < 1) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationPanel({ notifications, onClose, onMarkRead }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Mark read on open
  useEffect(() => {
    onMarkRead();
  }, [onMarkRead]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className={styles.panel}>
      <div className={styles.header}>Notifications</div>
      {notifications.length === 0 ? (
        <div className={styles.empty}>No notifications yet.</div>
      ) : (
        <div className={styles.list}>
          {notifications.map((n) => (
            <div key={n.id} className={styles.item}>
              <div className={styles.title}>{n.title}</div>
              <div className={styles.message}>{n.message}</div>
              <div className={styles.time}>{timeAgo(n.timestamp)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
