/**
 * Manages per-module Automerge documents for CRDT-based sync.
 *
 * Each module gets its own Automerge document keyed by module ID.
 * The document structure mirrors SQLite tables, with rows keyed by
 * their primary key value.
 */

import * as Automerge from '@automerge/automerge';

/** Shape of the Automerge document for a single module. */
export interface ModuleDocument {
  tables: { [tableName: string]: { [rowId: string]: Record<string, unknown> } };
  metadata: { lastModifiedAt: string; changeCount: number };
}

/** Change to apply to a module document. */
export interface DocumentChange {
  table: string;
  rowId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown> | null;
}

/**
 * Manages Automerge documents for per-module CRDT state.
 *
 * Documents are lazily created on first access and can be
 * persisted/restored via save/load.
 */
export class DocumentManager {
  private docs: Map<string, Automerge.Doc<ModuleDocument>>;
  private syncStates: Map<string, Automerge.SyncState>;

  constructor() {
    this.docs = new Map();
    this.syncStates = new Map();
  }

  /** Get or create the Automerge document for a module. */
  getDocument(moduleId: string): Automerge.Doc<ModuleDocument> {
    let doc = this.docs.get(moduleId);
    if (!doc) {
      doc = Automerge.init<ModuleDocument>();
      doc = Automerge.change(doc, (d) => {
        d.tables = {};
        d.metadata = { lastModifiedAt: new Date().toISOString(), changeCount: 0 };
      });
      this.docs.set(moduleId, doc);
    }
    return doc;
  }

  /** Apply a change record to the module's Automerge document. */
  applyChange(moduleId: string, change: DocumentChange): void {
    const doc = this.getDocument(moduleId);
    const updated = Automerge.change(doc, (d) => {
      const { table, rowId, operation, data } = change;

      // Ensure the table map exists
      if (!d.tables[table]) {
        d.tables[table] = {};
      }

      switch (operation) {
        case 'INSERT':
        case 'UPDATE':
          if (data) {
            d.tables[table]![rowId] = { ...data };
          }
          break;
        case 'DELETE':
          delete d.tables[table]![rowId];
          break;
      }

      d.metadata.lastModifiedAt = new Date().toISOString();
      d.metadata.changeCount += 1;
    });
    this.docs.set(moduleId, updated);
  }

  /** Get the binary state for a module document (for persistence). */
  getSyncState(moduleId: string): Uint8Array {
    const doc = this.getDocument(moduleId);
    return Automerge.save(doc);
  }

  /** Generate a sync message to send to a peer. */
  generateSyncMessage(moduleId: string, peerSyncState: Uint8Array | null): Uint8Array | null {
    const doc = this.getDocument(moduleId);

    const syncStateKey = moduleId;
    let syncState = this.syncStates.get(syncStateKey);
    if (!syncState) {
      syncState = Automerge.initSyncState();
    }

    // If the peer has shared their sync state, decode it
    if (peerSyncState) {
      syncState = Automerge.decodeSyncState(peerSyncState);
    }

    const [newSyncState, message] = Automerge.generateSyncMessage(doc, syncState);
    this.syncStates.set(syncStateKey, newSyncState);

    return message;
  }

  /** Apply a received sync message from a peer. Returns new changes to apply to SQLite. */
  receiveSyncMessage(
    moduleId: string,
    message: Uint8Array,
  ): { table: string; rowId: string; operation: string; data: Record<string, unknown> | null }[] {
    const doc = this.getDocument(moduleId);

    const syncStateKey = moduleId;
    let syncState = this.syncStates.get(syncStateKey);
    if (!syncState) {
      syncState = Automerge.initSyncState();
    }

    // Snapshot the old doc tables for diffing
    const oldTables: Record<string, Record<string, Record<string, unknown>>> = {};
    const docData = doc as unknown as ModuleDocument;
    if (docData.tables) {
      for (const [tbl, rows] of Object.entries(docData.tables)) {
        oldTables[tbl] = {};
        for (const [rid, rdata] of Object.entries(rows as Record<string, Record<string, unknown>>)) {
          oldTables[tbl]![rid] = { ...rdata };
        }
      }
    }

    const [newDoc, newSyncState] = Automerge.receiveSyncMessage(doc, syncState, message);
    this.docs.set(moduleId, newDoc);
    this.syncStates.set(syncStateKey, newSyncState);

    // Diff old vs new to find changes
    const changes: { table: string; rowId: string; operation: string; data: Record<string, unknown> | null }[] = [];
    const newData = newDoc as unknown as ModuleDocument;

    if (newData.tables) {
      for (const [tbl, rows] of Object.entries(newData.tables)) {
        const typedRows = rows as Record<string, Record<string, unknown>>;
        const oldRows = oldTables[tbl] ?? {};

        // Check for inserts and updates
        for (const [rid, rdata] of Object.entries(typedRows)) {
          if (!oldRows[rid]) {
            changes.push({ table: tbl, rowId: rid, operation: 'INSERT', data: { ...rdata } });
          } else {
            // Check if data changed
            const oldJson = JSON.stringify(oldRows[rid]);
            const newJson = JSON.stringify(rdata);
            if (oldJson !== newJson) {
              changes.push({ table: tbl, rowId: rid, operation: 'UPDATE', data: { ...rdata } });
            }
          }
        }

        // Check for deletes
        for (const rid of Object.keys(oldRows)) {
          if (!typedRows[rid]) {
            changes.push({ table: tbl, rowId: rid, operation: 'DELETE', data: null });
          }
        }
      }
    }

    // Check for tables that were entirely removed
    for (const tbl of Object.keys(oldTables)) {
      if (!newData.tables || !newData.tables[tbl]) {
        for (const rid of Object.keys(oldTables[tbl]!)) {
          changes.push({ table: tbl, rowId: rid, operation: 'DELETE', data: null });
        }
      }
    }

    return changes;
  }

  /** Save document to binary for persistence. */
  save(moduleId: string): Uint8Array {
    const doc = this.getDocument(moduleId);
    return Automerge.save(doc);
  }

  /** Load document from binary. */
  load(moduleId: string, binary: Uint8Array): void {
    const doc = Automerge.load<ModuleDocument>(binary);
    this.docs.set(moduleId, doc);
  }

  /** Get all module IDs with active documents. */
  getActiveModules(): string[] {
    return Array.from(this.docs.keys());
  }
}
