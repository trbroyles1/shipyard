"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePreferences } from "@/hooks/use-preferences";
import type { UserPreferences } from "@/lib/types/preferences";

interface PreferencesContextValue {
  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const value = usePreferences();
  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferencesContext(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferencesContext must be used within PreferencesProvider");
  return ctx;
}
