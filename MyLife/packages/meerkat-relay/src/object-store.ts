/**
 * The single object-store byte boundary for Plan 44 (WP-2A foundation).
 *
 * Two byte paths already exist in this package and each defines its own slice of
 * "store opaque bytes, verify by hash, never let a partial object serve":
 *  - the hosted metadata store issues PUT upload targets, stat-observes an object's
 *    (checksum, sizeBytes, versionId) before a fenced commit, and requires a
 *    deletion receipt (confirmsDeletion) to release bytes (hosted-storage-metadata.ts);
 *  - the durable archive lifecycle lands bytes at a quarantineKey then promotes them
 *    to a durableKey under a whole-object storageChecksum (archive-lifecycle.ts).
 *
 * `MeerkatObjectStore` is the one contract both of those compose onto. It is a
 * superset of `HostedStorageObjectStore` (the hosted store's three methods are
 * re-exposed with identical shapes, plus a thin adapter in this file proves the
 * superset relationship), and it adds the operations the archive path and the
 * WP-2C reconciliation/deletion jobs need: multipart writes that map 1:1 onto S3
 * multipart, an atomic quarantine->durable promote with checksum verification, a
 * monotonic version token, a cursor-paged inventory, and explicit typed
 * unavailable/failed states so a storage fault can never masquerade as an absent
 * object. The memory and file adapters (object-store-memory.ts, object-store-file.ts)
 * implement it fully; the S3 adapter (WP-2B) and the byte migrations (WP-2D/E)
 * build on it without changing it.
 *
 * Content addressing is sha256 hex (64 lowercase hex chars) throughout, validated
 * at the boundary. Checksum verification is a store operation, not a caller
 * courtesy: a whole-object mismatch at finalize fails the object into a rejected
 * state and never a served one; a promote whose bytes do not match the expected
 * checksum leaves the durable key unwritten.
 */

export const OBJECT_STORE_SHA256_HEX = /^[a-f0-9]{64}$/u;
const OBJECT_STORE_KEY = /^[A-Za-z0-9_][A-Za-z0-9_.:@/-]{0,511}$/u;
const OBJECT_STORE_UPLOAD_ID = /^[A-Za-z0-9_-]{1,128}$/u;
const MAX_OBJECT_BYTES = Number.MAX_SAFE_INTEGER;
/** S3 multipart requires >=5 MiB non-final parts; the file adapter mirrors the same floor. */
export const OBJECT_STORE_MIN_PART_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_PARTS = 10_000;
const MAX_INVENTORY_LIMIT = 1_000;

/**
 * The durability state of a key. `quarantined` bytes are content-verified but held
 * out of the served set until promotion; `durable` bytes are the only ones a serve
 * path may hand out; `rejected` is the terminal state of a finalize whose whole-object
 * checksum did not match (its bytes are never observable as durable).
 */
export type ObjectState = 'quarantined' | 'durable' | 'rejected';

/**
 * The immutable observation of a stored object: enough for a fenced metadata commit
 * (checksum + sizeBytes + versionId, matching HostedObjectObservation) plus the
 * durability state and content-address key needed by reconciliation and serve paths.
 * A missing object is `null`; a storage fault throws ObjectStoreUnavailableError.
 * Absence and unavailability are never conflated.
 */
export interface ObjectObservation {
  key: string;
  checksumSha256: string;
  sizeBytes: number;
  /** Monotonic per-key generation token. S3 versionId maps onto it; the file adapter counts. */
  versionId: string;
  state: ObjectState;
}

/** An inventory row: an observation plus nothing a bounded reconciliation scan does not need. */
export interface ObjectInventoryEntry {
  key: string;
  checksumSha256: string;
  sizeBytes: number;
  versionId: string;
  state: ObjectState;
}

/** Opaque, ordered cursor over the inventory. Reconciliation pages with it; it never scans unbounded. */
export interface ObjectInventoryCursor {
  key: string;
}

export interface ObjectInventoryPage {
  entries: ObjectInventoryEntry[];
  nextCursor: ObjectInventoryCursor | null;
}

/**
 * A single-shot upload target: raw bytes with a precommitted whole-object checksum.
 * S3 renders this as a presigned PUT; the file/memory adapters accept the bytes
 * inline. `finalize` verifies the bytes against `checksumSha256` and lands them
 * quarantined, or rejects on mismatch.
 */
export interface ObjectUploadTarget {
  key: string;
  checksumSha256: string;
  sizeBytes: number;
}

/** A multipart upload handle: begin -> appendPart (per-part checksum) -> complete. */
export interface ObjectMultipartUpload {
  key: string;
  uploadId: string;
  checksumSha256: string;
  sizeBytes: number;
}

/** One multipart part. `partNumber` is 1-based and dense; each part carries its own checksum. */
export interface ObjectMultipartPart {
  partNumber: number;
  checksumSha256: string;
  sizeBytes: number;
}

/** The receipt of a landed part, echoed back so `complete` can assert the full part set. */
export interface ObjectMultipartPartReceipt {
  partNumber: number;
  checksumSha256: string;
  sizeBytes: number;
}

/**
 * A single-shot write. Bytes are content-verified against `checksumSha256` before
 * they land quarantined; a mismatch yields `{ status: 'checksum_mismatch' }` and
 * the key is left in (or moved to) a rejected, never-served state.
 */
export interface ObjectPutInput {
  key: string;
  checksumSha256: string;
  bytes: Uint8Array;
}

export type ObjectFinalizeResult =
  | { status: 'stored'; object: ObjectObservation }
  | { status: 'checksum_mismatch'; object: ObjectObservation }
  | { status: 'size_mismatch'; object: ObjectObservation };

export interface ObjectBeginMultipartInput {
  key: string;
  /** The whole-object checksum the assembled parts must reproduce at complete. */
  checksumSha256: string;
  sizeBytes: number;
}

export interface ObjectAppendPartInput {
  key: string;
  uploadId: string;
  partNumber: number;
  checksumSha256: string;
  bytes: Uint8Array;
}

export type ObjectAppendPartResult =
  | { status: 'appended'; part: ObjectMultipartPartReceipt }
  | { status: 'checksum_mismatch' }
  | { status: 'unknown_upload' }
  | { status: 'part_too_small' };

export interface ObjectCompleteMultipartInput {
  key: string;
  uploadId: string;
  /** Every part, 1-based dense, in order. `complete` asserts this matches what landed. */
  parts: readonly ObjectMultipartPart[];
}

export type ObjectCompleteMultipartResult =
  | { status: 'stored'; object: ObjectObservation }
  | { status: 'checksum_mismatch'; object: ObjectObservation }
  | { status: 'size_mismatch'; object: ObjectObservation }
  | { status: 'missing_parts' }
  | { status: 'unknown_upload' };

export interface ObjectPromoteInput {
  quarantineKey: string;
  durableKey: string;
  /** The whole-object checksum the quarantined bytes must match to become durable. */
  expectedChecksumSha256: string;
}

export type ObjectPromoteResult =
  | { status: 'promoted'; object: ObjectObservation }
  | { status: 'checksum_mismatch' }
  | { status: 'source_missing' }
  | { status: 'source_not_quarantined' };

/** A deletion receipt compatible with the hosted metadata flow's confirmsDeletion(). */
export interface ObjectDeletionReceipt {
  key: string;
  versionId: string;
  deleted: boolean;
}

/** Read result: bytes plus the observation they were read at, so a caller can verify before serving. */
export interface ObjectReadResult {
  object: ObjectObservation;
  bytes: Uint8Array;
}

/**
 * A storage fault distinct from an absent object. Adapters throw this (never return
 * null) when the backing store is unreachable or errors, mirroring the philosophy of
 * toPostgresStoreUnavailableError: a failure must never masquerade as missing data.
 */
export class ObjectStoreUnavailableError extends Error {
  readonly code = 'object_store_unavailable';
  readonly operation: string;

  constructor(operation: string, cause: unknown) {
    super(`Object store is unavailable during ${operation}`, { cause });
    this.name = 'ObjectStoreUnavailableError';
    this.operation = operation;
  }
}

/** Wraps a backing-store failure as an explicit unavailable error, passing through its own type. */
export function toObjectStoreUnavailableError(
  operation: string,
  error: unknown,
): ObjectStoreUnavailableError {
  if (error instanceof ObjectStoreUnavailableError) return error;
  return new ObjectStoreUnavailableError(operation, error);
}

/**
 * The one object-store contract. Every method verifies content addressing at the
 * boundary; every write lands bytes quarantined and content-verified before they
 * are observable; promotion is the only path to `durable`; a storage fault throws
 * ObjectStoreUnavailableError rather than returning an absent result.
 */
export interface MeerkatObjectStore {
  /** Single-shot: content-verify `bytes` against the checksum, then land them quarantined or reject. */
  put(input: ObjectPutInput): Promise<ObjectFinalizeResult>;
  /** Begin a multipart upload; `checksumSha256` is the whole-object target `complete` must reproduce. */
  beginMultipart(input: ObjectBeginMultipartInput): Promise<ObjectMultipartUpload>;
  /** Append one content-verified part (>= OBJECT_STORE_MIN_PART_BYTES unless final). */
  appendPart(input: ObjectAppendPartInput): Promise<ObjectAppendPartResult>;
  /** Assemble parts, verify the whole-object checksum, land quarantined or reject; idempotent on replay. */
  completeMultipart(input: ObjectCompleteMultipartInput): Promise<ObjectCompleteMultipartResult>;
  /** Atomically move quarantined bytes to a durable key iff they match the expected checksum. */
  promote(input: ObjectPromoteInput): Promise<ObjectPromoteResult>;
  /** Immutable metadata for a key, or null when absent. Throws when the store is unavailable. */
  observe(key: string): Promise<ObjectObservation | null>;
  /** Read the object's bytes with the observation they were read at; null when absent. */
  read(key: string): Promise<ObjectReadResult | null>;
  /** Delete a key, returning an idempotent deletion receipt (equivalent on replay). */
  deleteObject(key: string): Promise<ObjectDeletionReceipt>;
  /**
   * Bounded, cursor-paged inventory for reconciliation. Never scans unbounded. An optional
   * `prefix` restricts the scan to keys that begin with it: the match is a literal string
   * prefix (S3 maps it to ListObjectsV2's native Prefix), so pass a trailing `/` to scope to a
   * path segment (e.g. `tenants/abc/`) rather than accidentally also matching `tenants/abcd/`.
   * Cursor pagination is unchanged and composes with the prefix (the cursor is still an absolute
   * key). An empty/absent prefix scans everything, exactly as before.
   */
  listInventory(input: {
    after?: ObjectInventoryCursor;
    prefix?: string;
    limit: number;
  }): Promise<ObjectInventoryPage>;
}

// ---------------------------------------------------------------------------
// Boundary validation shared by the memory and file adapters.
// ---------------------------------------------------------------------------

export function assertObjectKey(name: string, value: string): void {
  if (!OBJECT_STORE_KEY.test(value)) throw new TypeError(`${name} is not a valid object key`);
}

/**
 * Validates an inventory prefix: an empty string (scan everything) or a value drawn from the same
 * character set as an object key (so a path-segment prefix like `tenants/abc/` is valid). It shares
 * the key charset rules so a prefix can never carry a character a key could not, but unlike a key it
 * may be empty. It is a literal string prefix, not a key that must resolve to an object.
 */
export function assertObjectKeyPrefix(name: string, value: string): void {
  if (value === '') return;
  if (!OBJECT_STORE_KEY.test(value)) throw new TypeError(`${name} is not a valid object key prefix`);
}

export function assertObjectChecksum(name: string, value: string): void {
  if (!OBJECT_STORE_SHA256_HEX.test(value)) {
    throw new TypeError(`${name} must be a lowercase sha256 hex digest`);
  }
}

export function assertObjectSizeBytes(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_OBJECT_BYTES) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
}

export function assertUploadId(name: string, value: string): void {
  if (!OBJECT_STORE_UPLOAD_ID.test(value)) throw new TypeError(`${name} is invalid`);
}

export function assertPartNumber(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_MULTIPART_PARTS) {
    throw new TypeError(`${name} must be a 1-based part number within bounds`);
  }
}

export function assertInventoryLimit(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_INVENTORY_LIMIT) {
    throw new TypeError(`object inventory limit must be between 1 and ${MAX_INVENTORY_LIMIT}`);
  }
}

/**
 * Validates a dense, ordered, 1-based part list whose parts each carry a checksum,
 * and whose non-final parts meet the multipart minimum. Returns the total byte count.
 */
export function assertMultipartPartList(parts: readonly ObjectMultipartPart[]): number {
  if (parts.length === 0 || parts.length > MAX_MULTIPART_PARTS) {
    throw new TypeError('multipart part list is empty or exceeds the part limit');
  }
  let total = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    if (part.partNumber !== index + 1) {
      throw new TypeError('multipart parts must be dense and 1-based in order');
    }
    assertObjectChecksum('multipart part checksum', part.checksumSha256);
    assertObjectSizeBytes('multipart part bytes', part.sizeBytes);
    const isFinal = index === parts.length - 1;
    if (!isFinal && part.sizeBytes < OBJECT_STORE_MIN_PART_BYTES) {
      throw new TypeError('non-final multipart parts must meet the minimum part size');
    }
    total += part.sizeBytes;
  }
  return total;
}
