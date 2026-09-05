/**
 * Plain-JSON, last-write-wins document manager (MK-004).
 *
 * The Automerge-backed DocumentManager imports a WASM web bundle that Hermes
 * cannot parse, so on the native path we use this instead. It implements the
 * same surface the sync session relies on (generateSyncMessage /
 * receiveSyncMessage / getSyncState / applyChange) but resolves conflicts with
 * a deterministic per-row last-write-wins rule keyed on `updated_at`, and moves
 * a full per-module snapshot on the wire rather than CRDT deltas.
 *
 * Deletes are not inferred from snapshot absence (a peer simply may not have a
 * row yet). Instead a delete leaves a TOMBSTONE carrying its deletion time, and
 * tombstones travel in the snapshot alongside live rows. The receiver resolves
 * delete-vs-update by last-write-wins on the same `updated_at`/deletion clock:
 * a tombstone newer than the local row deletes it (and propagates onward); a
 * live row newer than a local tombstone resurrects it. This closes the
 * non-propagating-delete + resurrection bug from the 2026-06-12 audit.
 *
 * Intentionally self-contained: it imports nothing from document-manager.ts so
 * that '@automerge/automerge' never reaches the native bundle.
 */

/** A deleted row: kept so the delete propagates and cannot be resurrected by a stale copy. */
interface Tombstone {
  deletedAt: string;
}

/** Shape of the JSON document for a single module (mirrors SQLite tables). */
export interface ModuleDocument {
  tables: { [tableName: string]: { [rowId: string]: Record<string, unknown> } };
  tombstones?: { [tableName: string]: { [rowId: string]: Tombstone } };
  metadata: { lastModifiedAt: string; changeCount: number };
}

/** Change to apply to a module document. */
export interface DocumentChange {
  table: string;
  rowId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown> | null;
}

interface SnapshotWire {
  tables: { [tableName: string]: { [rowId: string]: Record<string, unknown> } };
  tombstones?: { [tableName: string]: { [rowId: string]: Tombstone } };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeJson(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function decodeJson<T>(bytes: Uint8Array): T {
  return JSON.parse(decoder.decode(bytes)) as T;
}

/** updated_at as a comparable string ('' sorts before any ISO timestamp). */
function updatedAtOf(row: Record<string, unknown> | undefined): string {
  return row && typeof row.updated_at === 'string' ? row.updated_at : '';
}

export class LwwDocumentManager {
  private readonly docs = new Map<string, ModuleDocument>();

  /** Get or lazily create the JSON document for a module. */
  getDocument(moduleId: string): ModuleDocument {
    let doc = this.docs.get(moduleId);
    if (!doc) {
      doc = { tables: {}, tombstones: {}, metadata: { lastModifiedAt: new Date().toISOString(), changeCount: 0 } };
      this.docs.set(moduleId, doc);
    }
    if (!doc.tombstones) doc.tombstones = {}; // older persisted docs
    return doc;
  }

  /** Apply a local change record to the module's document. */
  applyChange(moduleId: string, change: DocumentChange): void {
    const doc = this.getDocument(moduleId);
    const { table, rowId, operation, data } = change;
    const tbl = (doc.tables[table] ??= {});
    const tombs = (doc.tombstones![table] ??= {});

    if (operation === 'DELETE') {
      delete tbl[rowId];
      // A delete is carried, not implied by absence: stamp it so it propagates
      // and outranks any stale copy on a peer. The row's own updated_at is the
      // deletion clock when present, else now().
      const deletedAt = (data && typeof data.updated_at === 'string' && data.updated_at)
        || new Date().toISOString();
      tombs[rowId] = { deletedAt };
    } else if (data) {
      tbl[rowId] = { ...data };
      // A local re-creation outranks any prior tombstone for the same row.
      delete tombs[rowId];
    }

    doc.metadata.lastModifiedAt = new Date().toISOString();
    doc.metadata.changeCount += 1;
  }

  /** Binary snapshot of a module document (for persistence). */
  getSyncState(moduleId: string): Uint8Array {
    return encodeJson(this.getDocument(moduleId));
  }

  /**
   * Produce the message to send a peer: a full snapshot of this module's rows.
   * peerSyncState is accepted for interface parity but unused (full snapshot).
   * Returns null when there is nothing to send.
   */
  generateSyncMessage(moduleId: string, _peerSyncState: Uint8Array | null): Uint8Array | null {
    const doc = this.getDocument(moduleId);
    const hasRows = Object.values(doc.tables).some((rows) => Object.keys(rows).length > 0);
    const hasTombstones = Object.values(doc.tombstones ?? {}).some((t) => Object.keys(t).length > 0);
    if (!hasRows && !hasTombstones) return null;
    return encodeJson({ tables: doc.tables, tombstones: doc.tombstones } satisfies SnapshotWire);
  }

  /**
   * Merge a peer snapshot via last-write-wins and return the resulting changes
   * to apply to SQLite. Live rows: taken when new locally or strictly newer by
   * updated_at. Tombstones: a delete newer than the local row deletes it; a
   * live row newer than a local tombstone resurrects it. The local doc is
   * mutated so the delete propagates to this device's next peer.
   */
  receiveSyncMessage(moduleId: string, message: Uint8Array): DocumentChange[] {
    return this.diff(moduleId, message, true);
  }

  /**
   * Compute the candidate changes a peer snapshot would produce WITHOUT
   * mutating the local document. The session runs inbound policy (MK-002) on
   * these candidates and only commits the AUTHORIZED ones back into the doc via
   * applyChange, so a rejected or laundered row never enters the document and
   * therefore never re-broadcasts to other peers (closes the 2026-06-12 audit
   * inbound-merge-before-policy finding).
   */
  diffSyncMessage(moduleId: string, message: Uint8Array): DocumentChange[] {
    return this.diff(moduleId, message, false);
  }

  private diff(moduleId: string, message: Uint8Array, mutate: boolean): DocumentChange[] {
    let incoming: SnapshotWire;
    try {
      incoming = decodeJson<SnapshotWire>(message);
    } catch {
      return [];
    }
    const doc = this.getDocument(moduleId);
    const changes: DocumentChange[] = [];

    // Incoming live rows. A row is suppressed when a local tombstone is at least
    // as new (the row was deleted after this version): no resurrection.
    for (const [table, rows] of Object.entries(incoming.tables ?? {})) {
      // Only the mutating path creates table entries; a pure diff never touches
      // the doc (so a rejected table never even appears as an empty key).
      const localTbl = mutate ? (doc.tables[table] ??= {}) : (doc.tables[table] ?? {});
      const localTombs = mutate ? (doc.tombstones![table] ??= {}) : (doc.tombstones![table] ?? {});
      for (const [rowId, incomingRow] of Object.entries(rows)) {
        const tomb = localTombs[rowId];
        if (tomb && tomb.deletedAt >= updatedAtOf(incomingRow)) {
          continue; // deleted at or after this version wins -> stay deleted
        }
        const local = localTbl[rowId];
        if (!local) {
          if (mutate) {
            if (tomb) delete localTombs[rowId]; // resurrected: clear stale tombstone
            localTbl[rowId] = { ...incomingRow };
          }
          changes.push({ table, rowId, operation: 'INSERT', data: { ...incomingRow } });
        } else if (updatedAtOf(incomingRow) > updatedAtOf(local)) {
          if (mutate) localTbl[rowId] = { ...incomingRow };
          changes.push({ table, rowId, operation: 'UPDATE', data: { ...incomingRow } });
        }
      }
    }

    // Incoming tombstones. A delete strictly newer than the local live row (or a
    // row this device never had) is applied + recorded so it propagates. The
    // deletion clock rides in `data.updated_at` so a later commit preserves it.
    for (const [table, tombs] of Object.entries(incoming.tombstones ?? {})) {
      const localTbl = mutate ? (doc.tables[table] ??= {}) : (doc.tables[table] ?? {});
      const localTombs = mutate ? (doc.tombstones![table] ??= {}) : (doc.tombstones![table] ?? {});
      for (const [rowId, tomb] of Object.entries(tombs)) {
        const existingTomb = localTombs[rowId];
        if (existingTomb && existingTomb.deletedAt >= tomb.deletedAt) continue;
        const local = localTbl[rowId];
        if (local && updatedAtOf(local) > tomb.deletedAt) {
          continue; // local row is newer than the delete -> keep it (no delete)
        }
        const hadRow = local !== undefined;
        if (mutate) {
          delete localTbl[rowId];
          localTombs[rowId] = { deletedAt: tomb.deletedAt };
        }
        if (hadRow) {
          changes.push({ table, rowId, operation: 'DELETE', data: { updated_at: tomb.deletedAt } });
        }
      }
    }

    return changes;
  }

  /** Save document to binary for persistence. */
  save(moduleId: string): Uint8Array {
    return this.getSyncState(moduleId);
  }

  /** Load a document from a binary snapshot. */
  load(moduleId: string, binary: Uint8Array): void {
    try {
      this.docs.set(moduleId, decodeJson<ModuleDocument>(binary));
    } catch {
      // Ignore a corrupt snapshot; the module keeps its current state.
    }
  }

  /** All module IDs with active documents. */
  getActiveModules(): string[] {
    return Array.from(this.docs.keys());
  }
}
