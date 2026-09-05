// ExpoNodeStore: the real on-device seeding substrate for Meerkat.
//
// Sealed ciphertext blocks are written to the private storage directory as flat
// files keyed by their sealedId (a sha512 hex, so it is a safe filename; we
// still sanitize to [a-f0-9] defensively). The manifest index lives in the
// mk_pinned SQLite table. We track each block's byte length in the manifest
// row (total_bytes) so stats() is O(rows) instead of stat()-ing every file.
//
// This is a local store. Serving these blocks to a REMOTE peer is the
// transport layer's job (mesh sync plan 14, M0) and is not implemented here.
//
// Robustness: filesystem reads never throw out of the public methods; a
// missing block reads back as null, a missing directory is created on write.

import * as FileSystem from 'expo-file-system/legacy';
import { getPrivateStorageRoot } from './private-storage';
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
import type { LibraryPinStore, StoredPin } from './library-storage-core';

function storageDirectory(): string {
  return `${getPrivateStorageRoot()}meerkat/blocks/`;
}

function blockPath(sealedId: string): string {
  // sealedId is sha512 hex; keep only hex chars as a filename guard.
  const safe = sealedId.replace(/[^a-f0-9]/gi, '');
  return `${storageDirectory()}${safe}`;
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

export class ExpoNodeStore implements NodeStore, LibraryPinStore {
  private dirReady = false;

  constructor(private readonly db: DatabaseAdapter) {}

  private async ensureDir(): Promise<void> {
    if (this.dirReady) return;
    try {
      const info = await FileSystem.getInfoAsync(storageDirectory());
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(storageDirectory(), { intermediates: true });
      }
      this.dirReady = true;
    } catch (err) {
      console.warn('[ExpoNodeStore] ensureDir failed', err);
    }
  }

  async putBlock(block: SealedBlock): Promise<void> {
    await this.ensureDir();
    // Fail LOUD (audit P0): a swallowed write error here let pinShare record
    // a "pinned" manifest whose blocks never landed, so the Node tab claimed
    // content was seeded that could never be reopened. Verify the bytes are
    // really on disk before reporting success; callers surface the failure.
    await FileSystem.writeAsStringAsync(blockPath(block.sealedId), block.payload);
    const info = await FileSystem.getInfoAsync(blockPath(block.sealedId));
    if (!info.exists) {
      throw new Error(`Block write failed: ${block.sealedId.slice(0, 12)} did not land on disk`);
    }
  }

  async getBlock(sealedId: string): Promise<string | null> {
    try {
      const info = await FileSystem.getInfoAsync(blockPath(sealedId));
      if (!info.exists) return null;
      return await FileSystem.readAsStringAsync(blockPath(sealedId));
    } catch {
      return null;
    }
  }

  async hasBlock(sealedId: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(blockPath(sealedId));
      return info.exists;
    } catch {
      return false;
    }
  }

  async deleteBlock(sealedId: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(blockPath(sealedId), { idempotent: true });
    } catch (err) {
      console.warn('[ExpoNodeStore] deleteBlock failed', err);
    }
  }

  async putManifest(
    record: PinnedManifest,
    context: string = DEFAULT_PIN_CONTEXT,
    pinClass: PinClass = record.pinClass ?? DEFAULT_PIN_CLASS,
  ): Promise<void> {
    // Sum the byte length of each stored block payload so stats() can read
    // totals straight from the row. Block payloads are already on disk by the
    // time pinShare calls putManifest. (getBlock is async, so read the totals
    // BEFORE opening the sync DB transaction.)
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

  /**
   * Wipe every block file and clear the manifest index. Used by the
   * "Clear local storage" action in Settings.
   */
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
    try {
      await FileSystem.deleteAsync(storageDirectory(), { idempotent: true });
    } catch (err) {
      console.warn('[ExpoNodeStore] clearAll dir delete failed', err);
    }
    this.dirReady = false;
  }
}
