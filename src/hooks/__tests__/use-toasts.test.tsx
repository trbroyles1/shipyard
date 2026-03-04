// @vitest-environment jsdom
import "@/test/setup-dom";

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useToasts } from "../use-toasts";

describe("useToasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("addToast creates a toast with auto-incremented id", () => {
    const { result } = renderHook(() => useToasts());

    let id: number;
    act(() => {
      id = result.current.addToast("Title", "Message", "info");
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toEqual({
      id: id!,
      title: "Title",
      message: "Message",
      type: "info",
    });
  });

  it("dismiss removes a toast and clears its timer", () => {
    const { result } = renderHook(() => useToasts());

    let id: number;
    act(() => {
      id = result.current.addToast("Title", "Message", "info");
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.dismiss(id!);
    });

    expect(result.current.toasts).toHaveLength(0);

    // Advancing time should not cause errors (timer was cleared)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("auto-dismisses info toast after 4000ms", () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.addToast("Info", "msg", "info");
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3999);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("auto-dismisses success toast after 4000ms", () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.addToast("OK", "msg", "success");
    });

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("auto-dismisses warning toast after 6000ms", () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.addToast("Warn", "msg", "warning");
    });

    act(() => {
      vi.advanceTimersByTime(5999);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("auto-dismisses error toast after 10000ms", () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.addToast("Err", "msg", "error");
    });

    act(() => {
      vi.advanceTimersByTime(9999);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("accumulates multiple toasts and dismisses individually", () => {
    const { result } = renderHook(() => useToasts());

    let id1: number;
    let id2: number;
    let id3: number;

    act(() => {
      id1 = result.current.addToast("A", "a", "info");
      id2 = result.current.addToast("B", "b", "warning");
      id3 = result.current.addToast("C", "c", "error");
    });

    expect(result.current.toasts).toHaveLength(3);

    act(() => {
      result.current.dismiss(id2!);
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts.map((t) => t.id)).toEqual([id1!, id3!]);
  });
});
