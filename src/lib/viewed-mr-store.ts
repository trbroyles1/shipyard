/**
 * Singleton tracking which MR each user is currently viewing.
 * Written by API route handlers, read by the SSE poller.
 *
 * Attached to globalThis so the Map survives HMR module re-evaluation
 * in development. Without this, HMR creates duplicate Map instances
 * and the poller loses track of viewed MRs.
 */

import { createLogger } from "./logger";

const log = createLogger("viewed-mr-store");

interface ViewedMR {
  projectId: number;
  iid: number;
}

const globalKey = "__shipyard_viewed_mrs" as const;

declare global {
   
  var __shipyard_viewed_mrs: Map<number, ViewedMR> | undefined;
}

function getStore(): Map<number, ViewedMR> {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = new Map<number, ViewedMR>();
  }
  return globalThis[globalKey];
}

export function setViewedMR(userId: number, projectId: number, iid: number): void {
  const store = getStore();
  const prev = store.get(userId);
  if (!prev || prev.projectId !== projectId || prev.iid !== iid) {
    log.debug(`setViewedMR(user=${userId}, project=${projectId}, iid=${iid})`);
  }
  store.set(userId, { projectId, iid });
}

export function getViewedMR(userId: number): ViewedMR | undefined {
  return getStore().get(userId);
}

export function clearViewedMR(userId: number): void {
  const store = getStore();
  if (store.has(userId)) {
    log.debug(`clearViewedMR(user=${userId})`);
  }
  store.delete(userId);
}
