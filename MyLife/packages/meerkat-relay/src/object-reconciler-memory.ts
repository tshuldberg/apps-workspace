/**
 * In-memory OrphanFirstSeenStore and ReconcileCursorStore for tests and ephemeral nodes.
 *
 * These hold the two bits of reconciliation bookkeeping the reconciler needs beyond the
 * object store and reference ledger: when an unreferenced object was first seen (so the
 * grace window is measured from a durable first sighting, not from the current run), and
 * the resumable inventory cursor per scan id. The PostgreSQL equivalents persist the same
 * shape in ops.object_reference_keys.unreferenced_at and ops.object_reconciliation_runs.
 */

import type { ObjectInventoryCursor } from './object-store';
import type { OrphanFirstSeenStore } from './object-reconciler';
import type { ReconcileCursorStore } from './object-reconciler-leased';

export class InMemoryOrphanFirstSeenStore implements OrphanFirstSeenStore {
  private readonly firstSeenMs = new Map<string, number>();

  async firstSeen(objectKey: string, nowMs: number): Promise<number> {
    const existing = this.firstSeenMs.get(objectKey);
    if (existing !== undefined) return existing;
    this.firstSeenMs.set(objectKey, nowMs);
    return nowMs;
  }

  async clear(objectKey: string): Promise<void> {
    this.firstSeenMs.delete(objectKey);
  }
}

export class InMemoryReconcileCursorStore implements ReconcileCursorStore {
  private readonly cursors = new Map<string, ObjectInventoryCursor | null>();

  async loadCursor(scanId: string): Promise<ObjectInventoryCursor | null> {
    return this.cursors.get(scanId) ?? null;
  }

  async saveCursor(scanId: string, cursor: ObjectInventoryCursor | null): Promise<void> {
    this.cursors.set(scanId, cursor);
  }
}
