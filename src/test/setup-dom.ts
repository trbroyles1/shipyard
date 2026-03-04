/**
 * Side-effect setup module for jsdom-based tests.
 * Import at the top of each `.test.tsx` that uses `// @vitest-environment jsdom`.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom lacks <dialog> support — stub showModal and close
HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.showModal ?? vi.fn();
HTMLDialogElement.prototype.close = HTMLDialogElement.prototype.close ?? vi.fn();

// Stub crypto.randomUUID if absent (some jsdom versions lack it)
if (typeof crypto.randomUUID !== "function") {
  Object.defineProperty(crypto, "randomUUID", {
    value: vi.fn(() => "00000000-0000-0000-0000-000000000000"),
    writable: true,
  });
}

// ---------------------------------------------------------------------------
// MockEventSource — replaces globalThis.EventSource for SSE tests
// ---------------------------------------------------------------------------

type EventSourceListener = (event: MessageEvent) => void;

export class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  readyState = 0;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  close = vi.fn(() => {
    this.readyState = 2;
  });

  private listeners = new Map<string, EventSourceListener[]>();

  constructor(url: string) {
    this.url = url;
    this.readyState = 1; // OPEN
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: EventSourceListener) {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, cb: EventSourceListener) {
    const list = this.listeners.get(type);
    if (list) {
      this.listeners.set(type, list.filter((l) => l !== cb));
    }
  }

  /** Test helper: emit a named event to registered listeners. */
  _emit(type: string, data: unknown) {
    const event = { data: JSON.stringify(data), type, lastEventId: "" } as MessageEvent;
    const list = this.listeners.get(type) ?? [];
    for (const cb of list) cb(event);
  }

  /** Test helper: trigger the onerror handler. */
  _triggerError() {
    this.onerror?.(new Event("error"));
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

Object.defineProperty(globalThis, "EventSource", {
  value: MockEventSource,
  writable: true,
});

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
  MockEventSource.reset();
});
