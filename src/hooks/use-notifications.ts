"use client";

import { useState, useCallback, useRef } from "react";
import { COOKIE_MAX_AGE_1Y } from "@/lib/constants";

export interface Notification {
  id: number;
  title: string;
  message: string;
  timestamp: number;
}

const MAX_NOTIFICATIONS = 50;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readAt, setReadAt] = useState<number>(() => {
    if (typeof document === "undefined") return Date.now();
    const match = document.cookie.match(/notificationsReadAt=(\d+)/);
    return match ? Number.parseInt(match[1], 10) : 0;
  });
  const idRef = useRef(0);

  const unreadCount = notifications.filter((n) => n.timestamp > readAt).length;

  const addNotification = useCallback((title: string, message: string) => {
    idRef.current += 1;
    const id = idRef.current;
    const timestamp = Date.now();
    setNotifications((prev) => {
      const next = [{ id, title, message, timestamp }, ...prev];
      return next.slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const markAllRead = useCallback(() => {
    const now = Date.now();
    setReadAt(now);
    document.cookie = `notificationsReadAt=${now};path=/;max-age=${COOKIE_MAX_AGE_1Y};SameSite=Lax`;
  }, []);

  return { notifications, unreadCount, addNotification, markAllRead };
}
