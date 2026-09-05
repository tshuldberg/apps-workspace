/**
 * Archive byte path behind the MeerkatObjectStore contract (Plan 44 WP-2E).
 *
 * The archive lifecycle store (archive-lifecycle.ts) owns the METADATA state machine:
 * created -> uploading -> quarantined -> scanning -> approved -> pinned -> announced, with a
 * per-object quarantineKey and, after approval, a durableKey + storageChecksum. This module is the
 * BYTE path that composes that metadata authority onto the object store, so archive bytes live
 * behind the one contract (S3 in first-party, file in self-host) instead of an ad-hoc byte store.
 *
 * The mapping, one operation at a time:
 *  - INTAKE: quarantine bytes land via objectStore.put (single-shot) or the multipart methods, in
 *    the contract's `quarantined` state, content-verified against the object hash. The lifecycle's
 *    recordQuarantineObject records the same quarantineKey. Nothing quarantined is ever servable.
 *  - APPROVE -> DURABLE: the contract's promote(quarantineKey -> durableKey, expectedChecksum) IS
 *    the archive quarantine-to-durable move. It re-verifies the whole-object checksum before the
 *    durable key becomes observable, then archive markObjectDurable records the durableKey +
 *    storageChecksum. A promote whose bytes do not match leaves the durable key unwritten.
 *  - SERVE: a durable object is read via objectStore.read(durableKey) and its content hash is
 *    verified against the expected storageChecksum BEFORE any byte is handed out, exactly like the
 *    seeder's verifyCatalogPiece-before-serve guarantee. A corrupted read, a non-durable object, or
 *    a checksum mismatch yields null (refusal) - nothing unverified or quarantined is servable.
 *
 * REFERENCE AUTHORITY (WP-2E decision, option b): the SINGLE source of truth for object liveness is
 * WP-2C's ObjectReferenceLedger, which the reconciler already consults via isReferenced. Each
 * durable archive object writes ONE reference edge (referrer `archive:{jobId}#{objectIndex}`) into
 * the ledger and removes it on delete/takedown. The archive lifecycle store's own shared-object
 * refcount (markObjectDeleted returning `shared`) is now a lifecycle-state PROJECTION, NOT an
 * independent liveness authority - nobody may treat the two as separate sources of truth; the
 * ledger decides what is live, the lifecycle records what stage a job is in. Dropping to zero
 * references routes the durable key through WP-2C's deletion queue via the reconciler; this module
 * never deletes durable bytes inline. A ReferencedExpectationResolver over the archive objects
 * supplies the reconciler its drift checksum/size. Self-host file mode uses the identical
 * composition over the file object store.
 *
 * WRITE ORDERING (load-bearing, see promoteObject): on PROMOTE the edge is written EDGE-FIRST -
 * before the bytes land on the durable key - so a crash can only ever leave a referenced-but-absent
 * key (a loud referenced_missing finding, never deleted), never a durable-but-unreferenced orphan
 * that the reconciler would silently delete. On DELETE/TAKEDOWN the ordering reverses: remove the
 * edge FIRST, then let the object drop to zero references so WP-2C's deletion queue (the ONLY byte
 * remover) enqueues it. This module never removes durable bytes itself.
 */

import { createHash } from 'node:crypto';
import {
  type MeerkatObjectStore,
  type ObjectMultipartPart,
} from './object-store';
import type { ArchiveObjectStore } from './archive-lifecycle';
import type { ObjectReferenceLedger } from './object-reference-ledger';
import type { ReferencedExpectation } from './object-reconciler';

/** sha256 hex of opaque bytes; the archive content-address function. */
function archiveChecksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * The stable, collision-free referrer identity for one archive object in the single ledger
 * authority. `#` separates the jobId (a hex jobId or UUID, never containing `#`) from the numeric
 * objectIndex, so `archive:{jobId}#{objectIndex}` maps 1:1 to (job, object) with no ambiguity.
 */
export function archiveObjectReferrer(jobId: string, objectIndex: number): string {
  return `archive:${jobId}#${objectIndex}`;
}

export interface ArchiveQuarantineIntakeInput {
  jobId: string;
  expectedJobVersion: number;
  objectIndex: number;
  quarantineKey: string;
  /** The whole-object sha256 the bytes must match to land quarantined. */
  objectHash: string;
  bytes: Uint8Array;
  nowMs: number;
}

export type ArchiveQuarantineIntakeResult =
  | { status: 'quarantined'; quarantineKey: string }
  | { status: 'checksum_mismatch' }
  | { status: 'rejected_by_lifecycle' };

export interface ArchivePromoteInput {
  jobId: string;
  workerId: string;
  fencingToken: number;
  objectIndex: number;
  quarantineKey: string;
  durableKey: string;
  /** The whole-object checksum the quarantined bytes must reproduce to become durable. */
  expectedChecksumSha256: string;
  nowMs: number;
}

export type ArchivePromoteResult =
  | { status: 'durable'; durableKey: string; storageChecksum: string }
  | { status: 'checksum_mismatch' }
  | { status: 'source_missing' }
  | { status: 'rejected_by_lifecycle' };

export interface ArchiveServeInput {
  durableKey: string;
  /** The storageChecksum recorded at promote; the served bytes must match it. */
  expectedChecksumSha256: string;
}

/**
 * Composes the archive lifecycle metadata store with the object store byte boundary and the
 * WP-2C reference ledger (the single liveness authority). Construct one per deployment; the
 * object store is S3 in first-party and the file store in self-host.
 */
export class ArchiveObjectByteService {
  constructor(
    private readonly objectStore: MeerkatObjectStore,
    private readonly archiveStore: ArchiveObjectStore,
    private readonly referenceLedger: ObjectReferenceLedger,
  ) {}

  /**
   * Land quarantine bytes on the object store (content-verified, quarantined state) and record the
   * quarantine object in the lifecycle. A checksum mismatch never becomes observable bytes, and a
   * lifecycle rejection (bad job version/state) leaves no durable metadata.
   */
  async intakeQuarantineObject(input: ArchiveQuarantineIntakeInput): Promise<ArchiveQuarantineIntakeResult> {
    const bytes = Uint8Array.from(input.bytes);
    const put = await this.objectStore.put({
      key: input.quarantineKey,
      checksumSha256: input.objectHash,
      bytes,
    });
    if (put.status !== 'stored') {
      return { status: 'checksum_mismatch' };
    }
    const recorded = await this.archiveStore.recordQuarantineObject({
      jobId: input.jobId,
      expectedJobVersion: input.expectedJobVersion,
      objectIndex: input.objectIndex,
      objectHash: input.objectHash,
      objectBytes: bytes.length,
      quarantineKey: input.quarantineKey,
      nowMs: input.nowMs,
    });
    if (!recorded) {
      // The lifecycle refused (wrong version/state/over-cap): drop the quarantined bytes we just
      // landed so no orphan is left referencing a job that never accepted it.
      await this.objectStore.deleteObject(input.quarantineKey);
      return { status: 'rejected_by_lifecycle' };
    }
    return { status: 'quarantined', quarantineKey: input.quarantineKey };
  }

  /**
   * Promote quarantined bytes to a durable key via the contract's checksum-verified promote, then
   * record the durable transition in the lifecycle. Only after a genuine promote does the durable
   * object become servable.
   *
   * WRITE ORDERING IS EDGE-FIRST AND LOAD-BEARING. The reference edge on the durable key is written
   * BEFORE the object store promotes bytes onto that key. Rationale: if promote landed first and the
   * edge write then failed (or the process crashed between them), the durable object would be an
   * UNREFERENCED orphan, and after the grace window the reconciler would ENQUEUE ITS DELETION -
   * silent loss of legitimately promoted archive bytes. Edge-first inverts the failure: a crash
   * between the edge write and promote leaves a reference pointing at a not-yet-durable key, which
   * the reconciler surfaces as a loud referenced_missing finding and NEVER deletes. The edge is
   * idempotent (re-adding the same referrer is a no-op), so a retry after such a crash is safe.
   */
  async promoteObject(input: ArchivePromoteInput): Promise<ArchivePromoteResult> {
    const referrer = archiveObjectReferrer(input.jobId, input.objectIndex);
    // EDGE FIRST: register the durable key as referenced before any bytes land on it. A crash here
    // leaves a referenced-but-absent key (loud referenced_missing), never a deletable orphan.
    await this.referenceLedger.addReference({ objectKey: input.durableKey, referrer });

    const promoted = await this.objectStore.promote({
      quarantineKey: input.quarantineKey,
      durableKey: input.durableKey,
      expectedChecksumSha256: input.expectedChecksumSha256,
    });
    // If promote returns a terminal FAILURE (no durable object will ever exist at this key), roll
    // back the edge we optimistically wrote: a reference must never outlive the possibility of its
    // object. This is a synchronous failure (not a crash), so the removal runs here; a crash instead
    // leaves the edge as a loud referenced_missing finding, which is the designed residue.
    if (promoted.status === 'checksum_mismatch') {
      await this.referenceLedger.removeReference({ objectKey: input.durableKey, referrer });
      return { status: 'checksum_mismatch' };
    }
    if (promoted.status === 'source_missing' || promoted.status === 'source_not_quarantined') {
      await this.referenceLedger.removeReference({ objectKey: input.durableKey, referrer });
      return { status: 'source_missing' };
    }
    const storageChecksum = promoted.object.checksumSha256;
    const durable = await this.archiveStore.markObjectDurable({
      jobId: input.jobId,
      workerId: input.workerId,
      fencingToken: input.fencingToken,
      objectIndex: input.objectIndex,
      durableKey: input.durableKey,
      storageChecksum,
      nowMs: input.nowMs,
    });
    if (!durable) {
      // The lifecycle refused the durable transition (lease/version/state). The durable bytes and
      // the edge both exist; do NOT delete inline and do NOT drop the edge (dropping it would
      // recreate the deletable-orphan risk). The object stays referenced (never wrongly deleted)
      // and the lifecycle transition can be retried under a correct lease.
      return { status: 'rejected_by_lifecycle' };
    }
    return { status: 'durable', durableKey: input.durableKey, storageChecksum };
  }

  /**
   * Read a durable archive object and verify its content hash BEFORE returning bytes. Returns null
   * (refusal) when the object is absent, not durable, or fails the checksum - a corrupted or
   * unverified object is never served, mirroring the seeder's verifyCatalogPiece-before-serve rule.
   */
  async serveDurableObject(input: ArchiveServeInput): Promise<Uint8Array | null> {
    const read = await this.objectStore.read(input.durableKey);
    if (!read || read.object.state !== 'durable') return null;
    if (read.object.checksumSha256 !== input.expectedChecksumSha256) return null;
    // Re-verify the actual bytes, not just the recorded observation: a corrupted read never serves.
    if (archiveChecksum(read.bytes) !== input.expectedChecksumSha256) return null;
    return read.bytes;
  }

  /**
   * Release a durable archive object's reference edge (on delete/takedown). Dropping the last
   * reference makes the key deletion-eligible; the WP-2C reconciler + deletion queue perform the
   * actual byte removal. This never deletes durable bytes inline.
   */
  async releaseObjectReference(jobId: string, objectIndex: number, durableKey: string): Promise<void> {
    await this.referenceLedger.removeReference({
      objectKey: durableKey,
      referrer: archiveObjectReferrer(jobId, objectIndex),
    });
  }
}

/**
 * A ReferencedExpectationResolver over the archive objects: given a durable object key, return the
 * storageChecksum + objectBytes the archive lifecycle recorded, so the reconciler can drift-check a
 * referenced archive key. Returns null for a key the archive cannot vouch for (presence-only check).
 */
export function createArchiveExpectationResolver(
  listDurableObjects: () => Promise<Array<{ durableKey: string; storageChecksum: string; objectBytes: number }>>,
): (objectKey: string) => Promise<ReferencedExpectation | null> {
  return async (objectKey: string): Promise<ReferencedExpectation | null> => {
    const objects = await listDurableObjects();
    const match = objects.find((object) => object.durableKey === objectKey);
    if (!match) return null;
    return { checksumSha256: match.storageChecksum, sizeBytes: match.objectBytes };
  };
}

/** Assemble multipart parts helper for archive intake of large objects (test + caller convenience). */
export function toArchiveMultipartParts(
  segments: readonly Uint8Array[],
): { parts: ObjectMultipartPart[]; wholeChecksum: string; sizeBytes: number } {
  const hash = createHash('sha256');
  const parts: ObjectMultipartPart[] = [];
  let sizeBytes = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const bytes = segments[index]!;
    hash.update(bytes);
    sizeBytes += bytes.length;
    parts.push({ partNumber: index + 1, checksumSha256: archiveChecksum(bytes), sizeBytes: bytes.length });
  }
  return { parts, wholeChecksum: hash.digest('hex'), sizeBytes };
}
