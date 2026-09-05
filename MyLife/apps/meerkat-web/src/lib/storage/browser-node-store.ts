// BrowserNodeStore: the on-device seeding substrate for the web node, a
// byte-for-byte port of apps/meerkat/app/(root)/data/expo-node-store.ts.
//
// The NodeStore interface from @mylife/sync is already ASYNC (Promise-returning),
// so unlike the DatabaseAdapter/SecretStore this needs no sync-over-cache trick.
// Sealed ciphertext blocks live in a pluggable block backend (OPFS when the
// browser exposes it, IndexedDB otherwise and in Node/tests); the manifest index
// lives in mk_pinned via the injected DatabaseAdapter, exactly as on device.

import {
  DEFAULT_PIN_CONTEXT,
  DEFAULT_PIN_CLASS,
  type NodeStore,
  type SealedBlock,
  type PinnedManifest,
  type PinClass,
  type NodeStoreStats,
} from '@mylife/sync';
import type { DatabaseAdapter } from '@mylife/db';
import type { LibraryPinStore, StoredPin } from '../library-storage-core';
import { STORE_BLOCKS, idbGet, idbPut, idbDelete, idbHas, idbClear } from './idb';

/** Block storage backend. Two impls: OPFS (preferred) and IndexedDB (fallback). */
export interface BlockBackend {
  put(id: string, payload: string): Promise<void>;
  get(id: string): Promise<string | null>;
  has(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

// sealedId is sha512 hex; keep only hex chars as a filename/key guard, mirroring
// ExpoNodeStore.blockPath.
function safeId(sealedId: string): string {
  return sealedId.replace(/[^a-f0-9]/gi, '');
}

const OPFS_BLOCKS_DIR = 'meerkat-blocks';

/** True when the browser exposes the Origin Private File System. */
export function isOpfsAvailable(): boolean {
  return (
    typeof navigator !== 'undefined'
    && typeof navigator.storage?.getDirectory === 'function'
  );
}

class OpfsBlockBackend implements BlockBackend {
  private async dir(): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(OPFS_BLOCKS_DIR, { create: true });
  }

  async put(id: string, payload: string): Promise<void> {
    const dir = await this.dir();
    const handle = await dir.getFileHandle(safeId(id), { create: true });
    const writable = await handle.createWritable();
    await writable.write(payload);
    await writable.close();
    // Fail LOUD (audit P0 parity with ExpoNodeStore): verify the bytes landed
    // before reporting success, so pinShare can never record a manifest whose
    // blocks never persisted.
    const verify = await dir.getFileHandle(safeId(id), { create: false }).catch(() => null);
    if (!verify) {
      throw new Error(`Block write failed: ${id.slice(0, 12)} did not land in OPFS`);
    }
  }

  async get(id: string): Promise<string | null> {
    try {
      const dir = await this.dir();
      const handle = await dir.getFileHandle(safeId(id), { create: false });
      const file = await handle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  async has(id: string): Promise<boolean> {
    try {
      const dir = await this.dir();
      await dir.getFileHandle(safeId(id), { create: false });
      return true;
    } catch {
      return false;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const dir = await this.dir();
      await dir.removeEntry(safeId(id));
    } catch {
      // idempotent: a missing file is already deleted
    }
  }

  async clear(): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(OPFS_BLOCKS_DIR, { recursive: true });
    } catch {
      // idempotent
    }
  }
}

class IdbBlockBackend implements BlockBackend {
  async put(id: string, payload: string): Promise<void> {
    await idbPut(STORE_BLOCKS, safeId(id), payload);
    const verify = await idbHas(STORE_BLOCKS, safeId(id));
    if (!verify) {
      throw new Error(`Block write failed: ${id.slice(0, 12)} did not land in IndexedDB`);
    }
  }

  async get(id: string): Promise<string | null> {
    const value = await idbGet<string>(STORE_BLOCKS, safeId(id));
    return value ?? null;
  }

  async has(id: string): Promise<boolean> {
    return idbHas(STORE_BLOCKS, safeId(id));
  }

  async delete(id: string): Promise<void> {
    await idbDelete(STORE_BLOCKS, safeId(id));
  }

  async clear(): Promise<void> {
    await idbClear(STORE_BLOCKS);
  }
}

/** Pick OPFS when present, IndexedDB otherwise (and always in Node/tests). */
export function createBlockBackend(): BlockBackend {
  return isOpfsAvailable() ? new OpfsBlockBackend() : new IdbBlockBackend();
}

interface PinnedRow {
  content_id: string;
  pin_context: string;
  pin_class: string;
  name: string;
  size: number;
  scope: string;
  author_public_key: string;
  manifest_signature: string;
  sealed_chunk_ids: string;
  manifest_json: string;
  total_bytes: number;
  pinned_at: string;
}

function rowToManifest(row: PinnedRow): PinnedManifest {
  return {
    contentId: row.content_id,
    name: row.name,
    size: row.size,
    scope: row.scope,
    authorPublicKey: row.author_public_key,
    manifestSignature: row.manifest_signature,
    sealedChunkIds: JSON.parse(row.sealed_chunk_ids) as string[],
    manifestJson: row.manifest_json,
    pinnedAt: row.pinned_at,
    pinClass: row.pin_class as PinClass,
  };
}

export class BrowserNodeStore implements NodeStore, LibraryPinStore {
  constructor(
    private readonly db: DatabaseAdapter,
    private readonly blocks: BlockBackend,
  ) {}

  async putBlock(block: SealedBlock): Promise<void> {
    await this.blocks.put(block.sealedId, block.payload);
  }

  async getBlock(sealedId: string): Promise<string | null> {
    return this.blocks.get(sealedId);
  }

  async hasBlock(sealedId: string): Promise<boolean> {
    return this.blocks.has(sealedId);
  }

  async deleteBlock(sealedId: string): Promise<void> {
    await this.blocks.delete(sealedId);
  }

  async putManifest(
    record: PinnedManifest,
    context: string = DEFAULT_PIN_CONTEXT,
    pinClass: PinClass = record.pinClass ?? DEFAULT_PIN_CLASS,
  ): Promise<void> {
    // Sum stored block byte lengths so stats() reads totals straight from the
    // row (parity with ExpoNodeStore). Blocks are already persisted by pinShare.
    // (getBlock is async, so read the totals BEFORE opening the DB transaction.)
    let totalBytes = 0;
    for (const id of record.sealedChunkIds) {
      const payload = await this.getBlock(id);
      if (payload) totalBytes += payload.length;
    }
    this.db.transaction(() => {
      this.db.execute(
        `INSERT OR REPLACE INTO mk_pinned
           (content_id, pin_context, pin_class, name, size, scope, author_public_key,
            manifest_signature, sealed_chunk_ids, manifest_json, total_bytes, pinned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.contentId,
          context,
          pinClass,
          record.name,
          record.size,
          record.scope,
          record.authorPublicKey,
          record.manifestSignature,
          JSON.stringify(record.sealedChunkIds),
          record.manifestJson,
          totalBytes,
          record.pinnedAt,
        ],
      );
      // Refresh this pin's sealed-block refcount rows (Plan 38 D.4). Idempotent
      // on re-pin: drop this (content, context) pin's rows, then re-insert.
      this.db.execute(
        `DELETE FROM mk_pinned_blocks WHERE content_id = ? AND pin_context = ?`,
        [record.contentId, context],
      );
      for (const sealedId of record.sealedChunkIds) {
        this.db.execute(
          `INSERT OR IGNORE INTO mk_pinned_blocks (sealed_id, content_id, pin_context)
           VALUES (?, ?, ?)`,
          [sealedId, record.contentId, context],
        );
      }
    });
  }

  async getManifest(
    contentId: string,
    context: string = DEFAULT_PIN_CONTEXT,
  ): Promise<PinnedManifest | null> {
    const rows = this.db.query<PinnedRow>(
      `SELECT * FROM mk_pinned WHERE content_id = ? AND pin_context = ?`,
      [contentId, context],
    );
    const row = rows[0];
    return row ? rowToManifest(row) : null;
  }

  async listManifests(context?: string): Promise<PinnedManifest[]> {
    const rows = context === undefined
      ? this.db.query<PinnedRow>(`SELECT * FROM mk_pinned ORDER BY pinned_at DESC`)
      : this.db.query<PinnedRow>(
          `SELECT * FROM mk_pinned WHERE pin_context = ? ORDER BY pinned_at DESC`,
          [context],
        );
    return rows.map(rowToManifest);
  }

  async deleteManifest(
    contentId: string,
    context: string = DEFAULT_PIN_CONTEXT,
  ): Promise<void> {
    this.db.transaction(() => {
      this.db.execute(
        `DELETE FROM mk_pinned WHERE content_id = ? AND pin_context = ?`,
        [contentId, context],
      );
      this.db.execute(
        `DELETE FROM mk_pinned_blocks WHERE content_id = ? AND pin_context = ?`,
        [contentId, context],
      );
    });
  }

  async blockRefCount(sealedId: string): Promise<number> {
    const rows = this.db.query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM mk_pinned_blocks WHERE sealed_id = ?`,
      [sealedId],
    );
    return rows[0]?.c ?? 0;
  }

  async stats(): Promise<NodeStoreStats> {
    // manifestCount = pin rows (one per (content, context) pin). totalBytes and
    // blockCount are PHYSICAL: a content pinned under two contexts counts its
    // bytes once (MAX per content_id), and a block referenced by two contexts is
    // one physical block (DISTINCT sealed_id in the refcount table).
    const mrows = this.db.query<{ manifest_count: number }>(
      `SELECT COUNT(*) AS manifest_count FROM mk_pinned`,
    );
    const brows = this.db.query<{ total_bytes: number | null }>(
      `SELECT COALESCE(SUM(bytes), 0) AS total_bytes
         FROM (SELECT MAX(total_bytes) AS bytes FROM mk_pinned GROUP BY content_id)`,
    );
    const crows = this.db.query<{ block_count: number }>(
      `SELECT COUNT(DISTINCT sealed_id) AS block_count FROM mk_pinned_blocks`,
    );

    return {
      blockCount: crows[0]?.block_count ?? 0,
      manifestCount: mrows[0]?.manifest_count ?? 0,
      totalBytes: brows[0]?.total_bytes ?? 0,
    };
  }

  // --- Plan 38 C.7: pin-class taxonomy + budget/LRU support (LibraryPinStore) ---

  async setPinClass(contentId: string, context: string, pinClass: PinClass): Promise<void> {
    this.db.execute(
      `UPDATE mk_pinned SET pin_class = ? WHERE content_id = ? AND pin_context = ?`,
      [pinClass, contentId, context],
    );
  }

  async touchPin(contentId: string, context: string, now: string): Promise<void> {
    this.db.execute(
      `UPDATE mk_pinned SET last_used = ? WHERE content_id = ? AND pin_context = ?`,
      [now, contentId, context],
    );
  }

  async listStoredPins(): Promise<StoredPin[]> {
    const rows = this.db.query<{ content_id: string; pin_context: string; pin_class: string; total_bytes: number; last_used: string }>(
      `SELECT content_id, pin_context, pin_class, total_bytes, COALESCE(last_used, pinned_at) AS last_used FROM mk_pinned`,
    );
    return rows.map((r) => ({
      contentId: r.content_id,
      context: r.pin_context,
      pinClass: r.pin_class as PinClass,
      bytes: r.total_bytes ?? 0,
      lastUsed: r.last_used,
    }));
  }

  async contextStoredBytes(context: string): Promise<number> {
    const rows = this.db.query<{ total_bytes: number | null }>(
      `SELECT COALESCE(SUM(bytes), 0) AS total_bytes FROM (SELECT MAX(total_bytes) AS bytes FROM mk_pinned WHERE pin_context = ? GROUP BY content_id)`,
      [context],
    );
    return rows[0]?.total_bytes ?? 0;
  }

  async classBreakdown(): Promise<Record<PinClass, { count: number; bytes: number }>> {
    const rows = this.db.query<{ pin_class: string; count: number; bytes: number }>(
      `SELECT pin_class, COUNT(*) AS count, COALESCE(SUM(total_bytes), 0) AS bytes FROM mk_pinned GROUP BY pin_class`,
    );
    const base: Record<PinClass, { count: number; bytes: number }> = {
      authored: { count: 0, bytes: 0 },
      explicit: { count: 0, bytes: 0 },
      policy: { count: 0, bytes: 0 },
      fetch_cache: { count: 0, bytes: 0 },
    };
    for (const r of rows) {
      const slot = base[r.pin_class as PinClass];
      if (slot) { slot.count = r.count; slot.bytes = r.bytes; }
    }
    return base;
  }

  /** Wipe every block and clear the manifest index. Parity with ExpoNodeStore. */
  async clearAll(): Promise<void> {
    const manifests = await this.listManifests();
    for (const m of manifests) {
      for (const id of m.sealedChunkIds) {
        await this.deleteBlock(id);
      }
    }
    this.db.transaction(() => {
      this.db.execute(`DELETE FROM mk_pinned`);
      this.db.execute(`DELETE FROM mk_pinned_blocks`);
    });
    await this.blocks.clear();
  }
}
