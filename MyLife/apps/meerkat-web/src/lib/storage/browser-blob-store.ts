// BrowserBlobStore: the on-device raw-bytes store for sync-session blob transfer,
// the web counterpart of apps/meerkat/app/(root)/data/expo-blob-store.ts.
//
// Message rows carry signed attachment metadata, while cm_message_attachments
// rows carry blob_hash references that the sync blob phase can request. This
// store owns only the raw bytes for those hashes. New values use native Blob
// objects so backup can slice large libraries without cloning the whole value
// into JavaScript heap. Legacy Uint8Array values remain readable.

import type { DatabaseAdapter } from '@mylife/db';
import {
  blobContentHash,
  getBlob,
  insertBlob,
  type SessionBlobProvider,
} from '@mylife/sync';
import { STORE_BLOB_BYTES, idbGet, idbPut, idbDelete, idbHas, idbClear } from './idb';
import {
  hasBlobLocal,
  removeBlobLocal,
  type BlobIoAdapter,
  type RemoveBlobResult,
} from './blob-store-core';

const FALLBACK_MIME = 'application/octet-stream';

// Defense-in-depth (Plan 32 P4 follow-up): a previewDataUri is ONLY ever meant for
// an <img>-rendered raster, so refuse any non-image mimeType. Without this, a
// future non-<img> caller could obtain a data:text/html;base64,... (or scripty)
// URI from an unvalidated mimeType and open an XSS sink. SVG is kept because it is
// rendered via <img src>, where browsers never execute embedded script. The
// normalized mime (type only, lowercased) is what gets written into the data: URI,
// so no `;`-smuggled parameters ride along.
const PREVIEW_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

// Content hash is sha512 hex; keep only hex chars as a store-key guard, mirroring
// browser-node-store.safeId and ExpoBlobStore.blobPath.
function blobKey(hash: string): string {
  return hash.replace(/[^a-f0-9]/gi, '');
}

/** Uint8Array -> base64, dependency-free (no tweetnacl-util in meerkat-web). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export interface StoredBlobMetadata {
  hash: string;
  size: number;
  mimeType: string;
  moduleId: string;
  storedAt: string;
}

/**
 * The real browser blob IO seam over the IndexedDB blobBytes store. This is the
 * ONLY place the presence/removal core is wired to IndexedDB; tests inject a fake
 * BlobIoAdapter instead. Never throws.
 */
export function createIdbBlobIoAdapter(): BlobIoAdapter {
  return {
    blobPath: blobKey,
    fileExists: async (key) => {
      try {
        return await idbHas(STORE_BLOB_BYTES, key);
      } catch {
        return false;
      }
    },
    deleteFile: async (key) => {
      try {
        await idbDelete(STORE_BLOB_BYTES, key);
      } catch {
        // idempotent: a missing key is already deleted
      }
    },
  };
}

export class BrowserBlobStore implements SessionBlobProvider {
  private readonly io: BlobIoAdapter;

  // `io` is injectable so the honesty-critical has()/removeLocal() branches stay
  // testable; production builds the real IndexedDB adapter.
  constructor(
    private readonly db: DatabaseAdapter,
    io: BlobIoAdapter = createIdbBlobIoAdapter(),
  ) {
    this.io = io;
  }

  async get(hash: string): Promise<Uint8Array | null> {
    try {
      const value = await idbGet<Blob | Uint8Array>(STORE_BLOB_BYTES, blobKey(hash));
      if (!value) return null;
      if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
      // fake-indexeddb may hand back a structured-clone copy; normalize to a
      // plain Uint8Array view so callers always see the raw bytes.
      return value instanceof Uint8Array ? value : new Uint8Array(value);
    } catch {
      return null;
    }
  }

  async size(hash: string): Promise<number | null> {
    const value = await idbGet<Blob | Uint8Array>(STORE_BLOB_BYTES, blobKey(hash));
    if (value === undefined) return null;
    return value instanceof Blob ? value.size : value.byteLength;
  }

  async readRange(hash: string, offset: number, length: number): Promise<Uint8Array | null> {
    const value = await idbGet<Blob | Uint8Array>(STORE_BLOB_BYTES, blobKey(hash));
    if (value === undefined) return null;
    if (value instanceof Blob) {
      return new Uint8Array(await value.slice(offset, offset + length).arrayBuffer());
    }
    return value.subarray(offset, offset + length).slice();
  }

  async put(
    hash: string,
    bytes: Uint8Array,
    _meta: { moduleId: string; mimeType: string | null },
  ): Promise<void> {
    const actual = blobContentHash(bytes);
    if (actual !== hash) {
      throw new Error(`Blob hash mismatch: expected ${hash.slice(0, 12)}, got ${actual.slice(0, 12)}`);
    }

    const key = blobKey(hash);
    // Blob construction snapshots the bytes and supports bounded slice reads.
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    await idbPut(STORE_BLOB_BYTES, key, new Blob([copy.buffer], { type: 'application/octet-stream' }));
    // Fail LOUD (audit P0 parity with the OPFS/IndexedDB block backends): verify
    // the bytes landed before reporting success, so a transfer can never record
    // a blob whose bytes never persisted.
    const landed = await idbHas(STORE_BLOB_BYTES, key);
    if (!landed) {
      throw new Error(`Blob write failed: ${hash.slice(0, 12)} did not land in IndexedDB`);
    }
  }

  async putLocal(
    bytes: Uint8Array,
    meta: { moduleId: string; mimeType?: string | null },
  ): Promise<StoredBlobMetadata> {
    const hash = blobContentHash(bytes);
    const mimeType = meta.mimeType ?? FALLBACK_MIME;
    const storedAt = new Date().toISOString();

    await this.put(hash, bytes, { moduleId: meta.moduleId, mimeType });
    if (!getBlob(this.db, hash)) {
      insertBlob(this.db, {
        hash,
        size: bytes.length,
        mimeType,
        moduleId: meta.moduleId,
        refCount: 1,
        storedAt,
      });
    }

    return { hash, size: bytes.length, mimeType, moduleId: meta.moduleId, storedAt };
  }

  async previewDataUri(hash: string, mimeType: string): Promise<string | null> {
    const normalizedMime = mimeType.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!PREVIEW_IMAGE_MIMES.has(normalizedMime)) return null;
    const bytes = await this.get(hash);
    if (!bytes) return null;
    return `data:${normalizedMime};base64,${bytesToBase64(bytes)}`;
  }

  /**
   * Is the plaintext blob for this hash on this device right now? Derived LIVE
   * from a real IndexedDB check; never a stored flag and never written onto the
   * signed, immutable attachment metadata.
   */
  async has(hash: string): Promise<boolean> {
    return hasBlobLocal(this.io, hash);
  }

  /**
   * Remove ONLY this device's local copy of a blob, ref-count aware and verified
   * after delete (see removeBlobLocal). Local-only: it does NOT emit a cm_ event,
   * call recordLocalChange, or queue a mailbox message, so freeing space never
   * replicates or looks like deleting the file for other members.
   */
  async removeLocal(hash: string): Promise<RemoveBlobResult> {
    return removeBlobLocal(this.io, this.db, hash);
  }

  /** Delete every plaintext attachment byte held by Meerkat in this browser. */
  async clearAll(): Promise<void> {
    await idbClear(STORE_BLOB_BYTES);
  }
}
