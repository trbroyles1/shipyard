"use client";

import { useEffect, useRef } from "react";
import type { Notification } from "@/hooks/use-notifications";
import { timeAgo } from "@/components/shared/RelativeTime";
import styles from "./NotificationPanel.module.css";

interface Props {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: () => void;
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
