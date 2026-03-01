"use client";

import { useState, useCallback } from "react";

export interface Notification {
  id: number;
  title: string;
  message: string;
  timestamp: number;
}

const MAX_NOTIFICATIONS = 50;
let nextId = 1;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readAt, setReadAt] = useState<number>(() => {
    if (typeof document === "undefined") return Date.now();
    const match = document.cookie.match(/notificationsReadAt=(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  });

  const unreadCount = notifications.filter((n) => n.timestamp > readAt).length;

  const addNotification = useCallback((title: string, message: string) => {
    const id = nextId++;
    const timestamp = Date.now();
    setNotifications((prev) => {
      const next = [{ id, title, message, timestamp }, ...prev];
      return next.slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const markAllRead = useCallback(() => {
    const now = Date.now();
    setReadAt(now);
    document.cookie = `notificationsReadAt=${now};path=/;max-age=${60 * 60 * 24 * 365}`;
  }, []);

  return { notifications, unreadCount, addNotification, markAllRead };
}
