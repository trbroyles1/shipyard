// @vitest-environment jsdom
import "@/test/setup-dom";

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNotifications } from "../use-notifications";

describe("useNotifications", () => {
  beforeEach(() => {
    document.cookie = "notificationsReadAt=;max-age=0";
    vi.restoreAllMocks();
  });

  it("returns empty notifications and zero unread count initially", () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("addNotification creates a notification with auto-id and timestamp", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);

    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification("Title", "Body");
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0]).toEqual({
      id: 1,
      title: "Title",
      message: "Body",
      timestamp: 1000,
    });
  });

  it("increments unreadCount when notification is added after readAt", () => {
    document.cookie = "notificationsReadAt=0;path=/";
    vi.spyOn(Date, "now").mockReturnValue(500);

    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification("A", "msg");
    });

    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.addNotification("B", "msg2");
    });

    expect(result.current.unreadCount).toBe(2);
  });

  it("markAllRead sets cookie and resets unreadCount to 0", () => {
    document.cookie = "notificationsReadAt=0;path=/";
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(100);

    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.addNotification("X", "msg");
    });

    expect(result.current.unreadCount).toBe(1);

    nowSpy.mockReturnValue(200);

    act(() => {
      result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(document.cookie).toContain("notificationsReadAt=200");
  });

  it("caps notifications at 50 (newest first)", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);

    const { result } = renderHook(() => useNotifications());

    act(() => {
      for (let i = 0; i < 51; i++) {
        result.current.addNotification(`N${i}`, `msg${i}`);
      }
    });

    expect(result.current.notifications).toHaveLength(50);
    // The newest (last added) should be first
    expect(result.current.notifications[0].title).toBe("N50");
    // The oldest kept should be N1 (N0 was pushed out)
    expect(result.current.notifications[49].title).toBe("N1");
  });

  it("reads readAt from existing cookie on initialization", () => {
    document.cookie = "notificationsReadAt=99999;path=/";
    vi.spyOn(Date, "now").mockReturnValue(50000);

    const { result } = renderHook(() => useNotifications());

    // Add a notification with timestamp 50000, which is less than readAt 99999
    act(() => {
      result.current.addNotification("Old", "msg");
    });

    expect(result.current.unreadCount).toBe(0);
  });
});
