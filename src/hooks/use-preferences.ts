"use client";

import { useState, useCallback, useEffect } from "react";
import { DEFAULT_PREFERENCES, isTheme, type UserPreferences } from "@/lib/types/preferences";
import { PREFS_COOKIE_NAME, COOKIE_MAX_AGE_1Y } from "@/lib/constants";

function readCookie(): UserPreferences {
  if (typeof document === "undefined") return DEFAULT_PREFERENCES;
  const match = document.cookie.match(new RegExp(`${PREFS_COOKIE_NAME}=([^;]+)`));
  if (!match) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as Partial<UserPreferences>;
    const merged = { ...DEFAULT_PREFERENCES, ...parsed };
    if (!isTheme(merged.theme)) {
      merged.theme = DEFAULT_PREFERENCES.theme;
    }
    return merged;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writeCookie(prefs: UserPreferences): void {
  const value = encodeURIComponent(JSON.stringify(prefs));
  document.cookie = `${PREFS_COOKIE_NAME}=${value};path=/;max-age=${COOKIE_MAX_AGE_1Y};SameSite=Lax`;
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
