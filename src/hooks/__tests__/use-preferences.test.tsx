// @vitest-environment jsdom
import "@/test/setup-dom";

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { usePreferences } from "../use-preferences";
import { DEFAULT_PREFERENCES } from "@/lib/types/preferences";
import { PREFS_COOKIE_NAME } from "@/lib/constants";

function setPreferenceCookie(prefs: Record<string, unknown>) {
  document.cookie = `${PREFS_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(prefs))};path=/`;
}

function clearPreferenceCookie() {
  document.cookie = `${PREFS_COOKIE_NAME}=;max-age=0`;
}

describe("usePreferences", () => {
  beforeEach(() => {
    clearPreferenceCookie();
    delete document.documentElement.dataset.theme;
  });

  it("returns DEFAULT_PREFERENCES when no cookie is set", () => {
    const { result } = renderHook(() => usePreferences());

    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it("updatePreferences merges partial updates and writes cookie", () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.updatePreferences({ theme: "brinjal" });
    });

    expect(result.current.preferences.theme).toBe("brinjal");
    // Other fields remain defaults
    expect(result.current.preferences.warningHours).toBe(DEFAULT_PREFERENCES.warningHours);
    // Cookie should contain the updated value
    expect(document.cookie).toContain(PREFS_COOKIE_NAME);
  });

  it("syncs data-theme attribute on document element after theme update", () => {
    const { result } = renderHook(() => usePreferences());

    act(() => {
      result.current.updatePreferences({ theme: "brinjal" });
    });

    expect(document.documentElement.dataset.theme).toBe("brinjal");
  });

  it("reads preferences from existing cookie on initialization", () => {
    setPreferenceCookie({ theme: "drydock", warningHours: 5 });

    const { result } = renderHook(() => usePreferences());

    expect(result.current.preferences.theme).toBe("drydock");
    expect(result.current.preferences.warningHours).toBe(5);
    // Non-overridden fields keep defaults
    expect(result.current.preferences.criticalHours).toBe(DEFAULT_PREFERENCES.criticalHours);
  });

  it("falls back to default theme when cookie contains invalid theme", () => {
    setPreferenceCookie({ theme: "nonexistent-theme" });

    const { result } = renderHook(() => usePreferences());

    expect(result.current.preferences.theme).toBe(DEFAULT_PREFERENCES.theme);
  });

  it("falls back to DEFAULT_PREFERENCES on malformed JSON in cookie", () => {
    document.cookie = `${PREFS_COOKIE_NAME}=${encodeURIComponent("{bad json}")};path=/`;

    const { result } = renderHook(() => usePreferences());

    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });
});
