/**
 * Conflict visibility for the sync UI layer.
 *
 * When the CRDT or LWW merge automatically resolves a conflict,
 * this reporter stores the resolution details and notifies
 * subscribers so the UI can surface them if desired.
 */

/** A single sync conflict that was automatically resolved. */
export interface SyncConflict {
  id: string;
  moduleId: string;
  table: string;
  rowId: string;
  localValue: Record<string, unknown>;
  remoteValue: Record<string, unknown>;
  resolvedValue: Record<string, unknown>;
  resolvedAt: string;
  resolution: 'local_wins' | 'remote_wins' | 'crdt_merge';
}

/** Generate a simple ULID-like ID from timestamp + random suffix. */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Stores automatically resolved conflicts and notifies listeners.
 * This is an in-memory store intended for UI display; conflicts
 * are not persisted to SQLite.
 */
export class ConflictReporter {
  private conflicts: SyncConflict[];
  private listeners: Set<(conflict: SyncConflict) => void>;

  constructor() {
    this.conflicts = [];
    this.listeners = new Set();
  }

  /** Report a conflict that was automatically resolved. */
  report(conflict: Omit<SyncConflict, 'id' | 'resolvedAt'>): void {
    const full: SyncConflict = {
      ...conflict,
      id: generateId(),
      resolvedAt: new Date().toISOString(),
    };

    this.conflicts.push(full);

    for (const handler of this.listeners) {
      handler(full);
    }
  }

  /** Get recent conflicts, newest first. */
  getRecent(limit = 50): SyncConflict[] {
    const sorted = [...this.conflicts].reverse();
    return sorted.slice(0, limit);
  }

  /** Subscribe to new conflicts. Returns an unsubscribe function. */
  onConflict(handler: (conflict: SyncConflict) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  /** Clear conflict history. */
  clear(): void {
    this.conflicts = [];
  }
}
