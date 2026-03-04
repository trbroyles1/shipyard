// @vitest-environment jsdom
import "@/test/setup-dom";
import { MockEventSource } from "@/test/setup-dom";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSSE } from "../use-sse";

const FIXED_UUID = "test-tab-id-0000-0000-000000000001";

describe("useSSE", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(crypto, "randomUUID").mockReturnValue(FIXED_UUID as `${string}-${string}-${string}-${string}-${string}`);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const ALL_EVENT_TYPES = [
    "mr-list",
    "mr-new",
    "mr-update",
    "mr-removed",
    "mr-ready-to-merge",
    "mr-detail-update",
    "status",
    "error",
    "warning",
    "session-displaced",
  ] as const;

  it("creates EventSource with correct URL including tabId", () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE({ onEvent }));

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe(`/api/sse?tabId=${FIXED_UUID}`);
  });

  it("registers listeners for all 10 SSE event types", () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE({ onEvent }));

    const es = MockEventSource.instances[0];
    for (const type of ALL_EVENT_TYPES) {
      // Each type should have at least one listener registered via addEventListener
      // We verify by emitting and checking the callback fires
      es._emit(type, { test: true });
    }
    // session-displaced calls onEvent too, so all 10 types should produce calls
    expect(onEvent).toHaveBeenCalledTimes(10);
  });

  it("delivers parsed event data to onEvent callback", () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE({ onEvent }));

    const es = MockEventSource.instances[0];
    const payload = { state: "ready" };
    act(() => {
      es._emit("status", payload);
    });

    expect(onEvent).toHaveBeenCalledWith("status", payload);
  });

  it("silently ignores events with invalid JSON", () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE({ onEvent }));

    const es = MockEventSource.instances[0];
    // Manually trigger a listener with bad JSON
    const badEvent = { data: "not-valid-json{", type: "status", lastEventId: "" } as MessageEvent;
    const listeners = (es as unknown as { listeners: Map<string, ((e: MessageEvent) => void)[]> })
      // Access private listeners via the _emit pattern - instead emit raw
    ;
    void listeners;
    // Use the internal approach: call addEventListener's callback directly
    // We can't use _emit because it JSON.stringifies. Instead, manually invoke.
    // The MockEventSource stores listeners in a private Map. We'll access it.
    const listenerMap = (es as unknown as { listeners: Map<string, ((e: MessageEvent) => void)[]> }).listeners;
    const statusListeners = listenerMap.get("status") ?? [];
    expect(statusListeners.length).toBeGreaterThan(0);

    // Call with bad JSON — should not throw and should not call onEvent
    statusListeners[0](badEvent);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("sets isDisplaced to true on session-displaced event", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useSSE({ onEvent }));

    expect(result.current.isDisplaced).toBe(false);

    const es = MockEventSource.instances[0];
    act(() => {
      es._emit("session-displaced", { code: "session_displaced", message: "displaced" });
    });

    expect(result.current.isDisplaced).toBe(true);
    expect(es.close).toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledWith("session-displaced", {
      code: "session_displaced",
      message: "displaced",
    });
  });

  it("reconnects after onerror with initial 1s delay", () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE({ onEvent }));

    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];

    act(() => {
      es._triggerError();
    });

    expect(es.close).toHaveBeenCalled();
    // No new instance yet — timer hasn't fired
    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("applies exponential backoff on consecutive errors", () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE({ onEvent }));

    // First error → 1s delay
    const es1 = MockEventSource.instances[0];
    act(() => {
      es1._triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    // Second error → 2s delay
    const es2 = MockEventSource.instances[1];
    act(() => {
      es2._triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(MockEventSource.instances).toHaveLength(2); // not yet
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(MockEventSource.instances).toHaveLength(3);

    // Third error → 4s delay
    const es3 = MockEventSource.instances[2];
    act(() => {
      es3._triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(MockEventSource.instances).toHaveLength(3);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(MockEventSource.instances).toHaveLength(4);
  });

  it("resets backoff delay after a successful event", () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE({ onEvent }));

    // First error → triggers 1s backoff, bumps delay to 2s
    const es1 = MockEventSource.instances[0];
    act(() => {
      es1._triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    // Successful event on new connection resets delay
    const es2 = MockEventSource.instances[1];
    act(() => {
      es2._emit("status", { state: "ready" });
    });

    // Now error again — should be 1s delay (not 2s)
    act(() => {
      es2._triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(MockEventSource.instances).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(MockEventSource.instances).toHaveLength(3);
  });

  it("does not reconnect after displacement", () => {
    const onEvent = vi.fn();
    renderHook(() => useSSE({ onEvent }));

    const es = MockEventSource.instances[0];
    act(() => {
      es._emit("session-displaced", { code: "session_displaced", message: "displaced" });
    });

    // Trigger onerror after displacement
    act(() => {
      es._triggerError();
    });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // Should not create a new EventSource
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("closes EventSource on unmount", () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useSSE({ onEvent }));

    const es = MockEventSource.instances[0];
    unmount();

    expect(es.close).toHaveBeenCalled();
  });
});
