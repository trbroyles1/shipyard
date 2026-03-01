"use client";

import { useState, useCallback, useEffect } from "react";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/types/preferences";

const COOKIE_NAME = "shipyard_prefs";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(): UserPreferences {
  if (typeof document === "undefined") return DEFAULT_PREFERENCES;
  const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writeCookie(prefs: UserPreferences): void {
  const value = encodeURIComponent(JSON.stringify(prefs));
  document.cookie = `${COOKIE_NAME}=${value};path=/;max-age=${MAX_AGE}`;
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(readCookie);

  // Sync data-theme attribute on <html> whenever theme changes
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  const updatePreferences = useCallback((partial: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...partial };
      writeCookie(next);
      return next;
    });
  }, []);

  return { preferences, updatePreferences };
}
