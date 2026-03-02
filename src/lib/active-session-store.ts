/**
 * Singleton tracking which tab is the active session per user.
 * Used to displace old tabs when a new one connects, ensuring
 * only one SSE stream is active per user at a time.
 *
 * Attached to globalThis so the Map survives HMR module re-evaluation
 * in development. Without this, HMR creates duplicate Map instances
 * and the store loses track of active sessions.
 */

import { createLogger } from "./logger";

const log = createLogger("active-session-store");

interface ActiveSession {
  tabId: string;
  displace: () => void;
}

const globalKey = "__shipyard_active_sessions" as const;

declare global {
  // eslint-disable-next-line no-var
  var __shipyard_active_sessions: Map<number, ActiveSession> | undefined;
}

function getStore(): Map<number, ActiveSession> {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = new Map<number, ActiveSession>();
  }
  return globalThis[globalKey];
}

/**
 * Registers a tab as the active session for a user.
 * If the user already has a different tab registered, the store is
 * updated first, then the old tab's displace callback is invoked.
 * Returns true if an existing session was displaced, false otherwise.
 */
export function registerSession(
  userId: number,
  tabId: string,
  displace: () => void,
): boolean {
  const store = getStore();
  const existing = store.get(userId);

  if (existing && existing.tabId !== tabId) {
    log.info(
      `Displacing session for user ${userId}: tab ${existing.tabId} -> ${tabId}`,
    );
    store.set(userId, { tabId, displace });
    existing.displace();
    return true;
  }

  // Same tabId (reconnect) or no existing session — just store/overwrite
  store.set(userId, { tabId, displace });
  return false;
}

/**
 * Unregisters a session, but only if the stored tabId matches.
 * Prevents a race where an old tab's cancel() fires after a new tab
 * has already registered.
 */
export function unregisterSession(userId: number, tabId: string): void {
  const store = getStore();
  const existing = store.get(userId);
  if (existing && existing.tabId === tabId) {
    log.debug(`unregisterSession(user=${userId}, tab=${tabId})`);
    store.delete(userId);
  }
}

/** Returns the current active tabId for a user, or undefined. */
export function getActiveTabId(userId: number): string | undefined {
  return getStore().get(userId)?.tabId;
}
