/**
 * Object-store-backed StorageIngestStore for the FIRST-PARTY hosted byte path (Plan 44 WP-2D).
 *
 * Self-host file mode keeps FileStorageIngestStore (a per-tenant FileSeederPieceStore) exactly
 * as before. First-party hosted mode instead lands each resumable-ingest block as an object on
 * the MeerkatObjectStore contract, so the operator's bytes live behind the real object store
 * (S3 in production, wrapped in HostedObjectStoreAdapter for the metadata boundary) rather than
 * a local disk volume. The ingest wire protocol and its honesty posture are unchanged: blocks
 * are opaque, hash-addressed, per-block verified, cap-enforced BEFORE a write, and resumable.
 *
 * KEY MAPPING. One tenant store owns one key prefix (`{prefix}/{contentId}/{index}`); the caller
 * supplies a tenant-unique prefix so two tenants can never collide even though they share one
 * bucket. contentId and index are already validated by the ingest handler (SAFE_CONTENT_ID +
 * bounded integer), and the object store re-validates the assembled key at its boundary.
 *
 * WRITE = put + content re-verify. putBlock hands the bytes to the object store's single-shot
 * put with the block's own sha256 (the same digest the ingest already checked). The store
 * re-verifies the bytes against that checksum server-side/by-read-back and lands them
 * `quarantined`; a mismatch yields a `rejected` object that observe/read treat as absent, so a
 * corrupted block never becomes retrievable. Blocks stay `quarantined` in the ingest store: the
 * resumable store only needs bytes to be present and readable, and promotion to `durable` is a
 * separate metadata-plane decision, not part of resumable upload.
 *
 * CAP ACCOUNTING (O(1) per check after one bounded sweep; durable across restart). usedBytes does
 * ONE prefix-scoped, cursor-paged sweep of this tenant's live (non-rejected) objects on its first
 * call (S3 maps the prefix onto a native ListObjectsV2 Prefix, so the sweep is O(tenant objects),
 * NOT O(bucket)), caches the result as an in-process counter, and thereafter increments it on each
 * successful putBlock. The cap check that runs before EVERY block therefore costs O(1) after the
 * initial sweep, not a full-bucket LIST per block. The honest durable source is still the object
 * store's own inventory: a restart/new worker just re-runs the one sweep, so usage never resets to
 * a wrong value and a resumed upload sees prior blocks as already stored. See the class doc for the
 * single-writer assumption the counter relies on (the ingest write lock + sole-writer hosted
 * service). The ingest handler calls usedBytes under its per-tenant write lock and enforces the cap
 * BEFORE putBlock, so the read-then-write stays consistent for a single tenant.
 *
 * WP-2C COUPLING (future). When the reference-accounting ledger (object-reference-ledger.ts) lands,
 * a block put here should also register a reference edge so reconciliation/deletion can account for
 * these bytes; this adapter deliberately does NOT couple to it yet (that work is in flight) and
 * relies on the object store's own inventory for usage. Left as a marker for WP-2C to pick up.
 *
 * UNAVAILABILITY. Object-store faults surface as ObjectStoreUnavailableError (the store's
 * contract), which the ingest handler's try/catch turns into a 500 with an error id, never a
 * silent success or a fabricated empty cap. Absence (a missing block) is a clean null, distinct
 * from a fault, exactly as the contract requires.
 */

import { createHash } from 'node:crypto';
import type { MeerkatObjectStore } from './object-store';
import {
  HostedStorageBlockDeleteError,
  type HostedStorageBlockStore,
  type StorageBlockDeleteResult,
} from './storage-ingest';

/** sha256 hex of opaque bytes; the same content-address the ingest handler verifies. */
function blockChecksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export interface ObjectStoreStorageIngestStoreOptions {
  store: MeerkatObjectStore;
  /** Hard storage cap in bytes for this tenant. */
  capBytes: number;
  /**
   * Tenant-unique key prefix (no trailing slash) so two tenants sharing one bucket never
   * collide. Must be a valid object-key segment; the assembled key is re-validated by the store.
   */
  keyPrefix: string;
  /** Inventory page size for the cap scan. Bounded to the store's own inventory limit. */
  inventoryPageSize?: number;
}

const DEFAULT_INVENTORY_PAGE_SIZE = 1_000;
const SAFE_CONTENT_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Exposes one tenant's object-store keyspace to the resumable ingest as a StorageIngestStore.
 *
 * USAGE ACCOUNTING is O(1) per cap check after a single O(tenant objects) sweep. The first
 * usedBytes() call does ONE prefix-scoped, cursor-paged sweep (listInventory({ prefix })) that S3
 * maps onto a native Prefix, so the scan is bounded by this tenant's object count, never the whole
 * bucket. The result is cached as an in-process counter, incremented on each successful
 * (status 'stored') putBlock, and decremented after confirmed deletes. A restart re-runs the sweep
 * from durable inventory, so usage never resets to a wrong value.
 *
 * SINGLE-WRITER ASSUMPTION: the in-process counter is exact only because the ingest handler
 * serializes per-tenant writes under its write lock AND the hosted service is the SOLE writer for
 * its tenants' prefixes. If a second uncoordinated writer wrote to the same tenant prefix, the
 * counter would drift; that is out of scope for the hosted single-writer deployment and would be
 * reconciled by a fresh sweep on the next instance. Rejected objects never count (they store no
 * retrievable bytes), matching the file store.
 */
export class ObjectStoreStorageIngestStore implements HostedStorageBlockStore {
  private readonly store: MeerkatObjectStore;
  private readonly maximumBytes: number;
  private readonly prefix: string;
  private readonly pageSize: number;
  /** Cached live-byte counter; null until the first sweep has run. */
  private cachedUsedBytes: number | null = null;
  private usedBytesLoad: Promise<number> | null = null;
  private lockTail: Promise<void> = Promise.resolve();

  constructor(options: ObjectStoreStorageIngestStoreOptions) {
    this.store = options.store;
    this.maximumBytes = options.capBytes;
    this.prefix = options.keyPrefix.replace(/\/+$/u, '');
    this.pageSize = Math.max(1, Math.min(options.inventoryPageSize ?? DEFAULT_INVENTORY_PAGE_SIZE, 1_000));
  }

  private blockKey(contentId: string, index: number): string {
    return `${this.prefix}/${contentId}/${index}`;
  }

  /** One prefix-scoped, cursor-paged sweep of this tenant's live (non-rejected) bytes. */
  private async sweepUsedBytes(): Promise<number> {
    let total = 0;
    let cursor: { key: string } | undefined;
    for (;;) {
      const page = await this.store.listInventory({
        prefix: `${this.prefix}/`,
        ...(cursor ? { after: cursor } : {}),
        limit: this.pageSize,
      });
      for (const entry of page.entries) {
        if (entry.state === 'rejected') continue;
        total += entry.sizeBytes;
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return total;
  }

  async usedBytes(): Promise<number> {
    // First call sweeps the tenant prefix once (O(tenant objects)); later calls are O(1).
    if (this.cachedUsedBytes === null) {
      this.usedBytesLoad ??= this.sweepUsedBytes().then((total) => {
        this.cachedUsedBytes ??= total;
        return this.cachedUsedBytes;
      });
      return this.usedBytesLoad;
    }
    return this.cachedUsedBytes;
  }

  capBytes(): number {
    return this.maximumBytes;
  }

  async hasBlock(contentId: string, index: number): Promise<boolean> {
    const observed = await this.store.observe(this.blockKey(contentId, index));
    return observed !== null && observed.state !== 'rejected';
  }

  async getBlock(contentId: string, index: number): Promise<Uint8Array | null> {
    const result = await this.store.read(this.blockKey(contentId, index));
    return result?.object.state === 'rejected' ? null : result?.bytes ?? null;
  }

  async putBlock(contentId: string, index: number, bytes: Uint8Array): Promise<void> {
    const result = await this.store.put({
      key: this.blockKey(contentId, index),
      checksumSha256: blockChecksum(bytes),
      bytes,
    });
    if (result.status !== 'stored') {
      // The ingest handler already verified the block's hash, so a non-stored result here means
      // the object store observed a content mismatch on read-back: fail loudly (fail-closed
      // per-block verify) rather than report a phantom success. A storage fault throws
      // ObjectStoreUnavailableError upstream. The counter is NOT advanced on a non-stored put.
      throw new Error(`object-store ingest put did not store block ${contentId}#${index}: ${result.status}`);
    }
    // Advance the in-process counter only on a genuine store. usedBytes() must have run at least
    // once (the ingest enforces the cap before putBlock), so the cache is populated; guard anyway.
    if (this.cachedUsedBytes !== null) {
      this.cachedUsedBytes += result.object.sizeBytes;
    }
  }

  async storedBitfield(contentId: string, total: number): Promise<boolean[]> {
    const stored: boolean[] = [];
    for (let index = 0; index < total; index += 1) {
      stored.push(await this.hasBlock(contentId, index));
    }
    return stored;
  }

  private async deletePrefix(prefix: string): Promise<StorageBlockDeleteResult> {
    await this.usedBytes();
    let deletedBlocks = 0;
    let deletedBytes = 0;
    for (;;) {
      const page = await this.store.listInventory({ prefix, limit: this.pageSize });
      if (page.entries.length === 0) break;
      for (const entry of page.entries) {
        try {
          const receipt = await this.store.deleteObject(entry.key);
          if (!receipt.deleted) throw new Error('object store did not confirm deletion');
        } catch (error) {
          throw new HostedStorageBlockDeleteError(entry.key, error);
        }
        deletedBlocks += 1;
        if (entry.state !== 'rejected') {
          deletedBytes += entry.sizeBytes;
          this.cachedUsedBytes = Math.max(0, (this.cachedUsedBytes ?? 0) - entry.sizeBytes);
        }
      }
    }
    return { deletedBlocks, deletedBytes };
  }

  deleteContent(contentId: string): Promise<StorageBlockDeleteResult> {
    if (!SAFE_CONTENT_ID.test(contentId)) {
      return Promise.reject(new Error('Invalid hosted storage content id'));
    }
    return this.withWriteLock(() => this.deletePrefix(`${this.prefix}/${contentId}/`));
  }

  deleteAll(): Promise<StorageBlockDeleteResult> {
    return this.withWriteLock(() => this.deletePrefix(`${this.prefix}/`));
  }

  withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.lockTail.then(operation, operation);
    this.lockTail = run.then(() => undefined, () => undefined);
    return run;
  }
}
