// blob-store-core.ts: pure, native-free logic for local blob presence + removal.
//
// Why this exists (Critical, mirrors file-save.ts's FileSaveAdapter seam):
//   ExpoBlobStore imports expo-file-system/legacy at module load, which cannot
//   resolve under Node/Vitest. The honesty-critical branches of "is this blob on
//   this device?" and "remove the local copy and free space" must be unit-tested,
//   so the decision logic lives here behind an injectable IO adapter and takes the
//   DatabaseAdapter directly. ExpoBlobStore builds the real native adapter and
//   delegates; tests inject a fake filesystem and an in-memory db.
//
// This module performs NO transport and NO sealed-store access. It only deletes
// plaintext blob bytes the user explicitly chose to free and the matching
// sync_blobs index row. Removal is LOCAL-ONLY: it never records a cm_ event,
// never calls recordLocalChange, and never queues a mailbox message.

import type { DatabaseAdapter } from '@mylife/db';
import { decrementBlobRefCount, deleteBlob, getBlob } from '@mylife/sync';

/**
 * The single boundary to native blob-file IO. Wraps only the expo-file-system
 * calls the presence/removal logic needs, so tests inject a fake and never load
 * a native module.
 */
export interface BlobIoAdapter {
  /** Absolute on-disk path for a content hash. */
  blobPath(hash: string): string;
  /** Whether a file exists at the given path. Must never throw (catch + false). */
  fileExists(path: string): Promise<boolean>;
  /** Delete the file at the path. Idempotent; resolves even if absent. */
  deleteFile(path: string): Promise<void>;
}

/**
 * Result of a local removal. `freed` is true only when the on-disk bytes are
 * confirmed gone (ref count reached 0 AND a verify-after-delete check passes).
 * `freed: false` with `reason: 'still-referenced'` means another card/message
 * still references the blob, so the file was intentionally kept. Any other
 * `reason` is a real failure the UI must surface instead of claiming space freed.
 */
export type RemoveBlobResult =
  | { freed: true; remainingRefs: 0 }
  | { freed: false; reason: 'still-referenced'; remainingRefs: number }
  | { freed: false; reason: 'not-present' }
  | { freed: false; reason: 'verify-failed' }
  | { freed: false; reason: 'error'; message: string };

/**
 * Is the plaintext blob for this hash on this device right now? Derived LIVE from
 * a real filesystem check, never a stored flag. Returns false (never throws) when
 * the IO layer cannot answer.
 */
export async function hasBlobLocal(io: BlobIoAdapter, hash: string): Promise<boolean> {
  try {
    return await io.fileExists(io.blobPath(hash));
  } catch {
    return false;
  }
}

/**
 * Remove the LOCAL copy of a blob, ref-count aware, verifying the bytes are
 * actually gone before reporting that space was freed.
 *
 * Steps:
 *   1. If the file is not on disk, return 'not-present' (nothing to free; the
 *      card should already be showing the removed placeholder).
 *   2. Decrement the sync_blobs ref count. If a row exists and the new count is
 *      still > 0, KEEP the file (another attachment/message references these
 *      bytes) and return 'still-referenced'. Deleting here would orphan another
 *      card's bytes and make it falsely read "removed".
 *   3. At ref 0 (or no index row), delete the on-disk file AND the index row,
 *      then re-check presence. If the file somehow survives, return
 *      'verify-failed' so the UI never claims space was freed when it was not.
 *
 * Never touches a relay, the sealed store, or any cm_ event/mailbox row.
 */
export async function removeBlobLocal(
  io: BlobIoAdapter,
  db: DatabaseAdapter,
  hash: string,
): Promise<RemoveBlobResult> {
  try {
    const path = io.blobPath(hash);
    const present = await hasBlobLocal(io, hash);
    if (!present) return { freed: false, reason: 'not-present' };

    // Ref-count gate. getBlob === null means there is no index row (e.g. a blob
    // received without an index entry); treat that as singly-referenced so the
    // explicit user removal can still free the orphaned bytes.
    const existing = getBlob(db, hash);
    if (existing) {
      const remaining = decrementBlobRefCount(db, hash);
      if (remaining > 0) {
        return { freed: false, reason: 'still-referenced', remainingRefs: remaining };
      }
    }

    // Ref count is 0 (or there was no index row): the user's local copy is the
    // last reference. Delete the bytes and the index row, then verify.
    await io.deleteFile(path);
    deleteBlob(db, hash);

    const stillPresent = await hasBlobLocal(io, hash);
    if (stillPresent) return { freed: false, reason: 'verify-failed' };

    return { freed: true, remainingRefs: 0 };
  } catch (err) {
    return {
      freed: false,
      reason: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
