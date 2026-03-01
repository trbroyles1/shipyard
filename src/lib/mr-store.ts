import type { MRSummary } from "./types/mr";

/**
 * Per-user in-memory MR store. Each SSE connection gets its own store
 * since we rely on the user's access token for polling.
 */
export class MRStore {
  private items = new Map<number, MRSummary>();
  private _isHydrated = false;

  get isHydrated(): boolean {
    return this._isHydrated;
  }

  markHydrated(): void {
    this._isHydrated = true;
  }

  getAll(): MRSummary[] {
    return Array.from(this.items.values());
  }

  get(id: number): MRSummary | undefined {
    return this.items.get(id);
  }

  upsert(mr: MRSummary): void {
    this.items.set(mr.id, mr);
  }

  remove(id: number): boolean {
    return this.items.delete(id);
  }

  has(id: number): boolean {
    return this.items.has(id);
  }
}
