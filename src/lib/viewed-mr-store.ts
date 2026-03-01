/**
 * Module-level singleton tracking which MR each user is currently viewing.
 * Written by API route handlers, read by the SSE poller.
 */

interface ViewedMR {
  projectId: number;
  iid: number;
}

const viewed = new Map<number, ViewedMR>();

export function setViewedMR(userId: number, projectId: number, iid: number): void {
  viewed.set(userId, { projectId, iid });
}

export function getViewedMR(userId: number): ViewedMR | undefined {
  return viewed.get(userId);
}

export function clearViewedMR(userId: number): void {
  viewed.delete(userId);
}
