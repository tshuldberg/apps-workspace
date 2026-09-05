// ExpoBlobStore: filesystem bytes for sync-session blob transfer.
//
// Message rows carry signed attachment metadata, while cm_message_attachments
// rows carry blob_hash references that the sync blob phase can request. This
// store owns only the raw bytes for those hashes.

import * as FileSystem from 'expo-file-system/legacy';
import { getPrivateStorageRoot } from './private-storage';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import type { DatabaseAdapter } from '@mylife/db';
import {
  blobContentHash,
  getBlob,
  insertBlob,
  type SessionBlobProvider,
} from '@mylife/sync';
import {
  hasBlobLocal,
  removeBlobLocal,
  type BlobIoAdapter,
  type RemoveBlobResult,
} from './blob-store-core';

function storageDirectory(): string {
  return `${getPrivateStorageRoot()}meerkat/blobs/`;
}
const FALLBACK_MIME = 'application/octet-stream';

function blobPath(hash: string): string {
  const safe = hash.replace(/[^a-f0-9]/gi, '');
  return `${storageDirectory()}${safe}`;
}

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) || 'attachment';
}

// The real native blob IO seam. This is the ONLY place expo-file-system/legacy
// is wired to the pure presence/removal core in blob-store-core.ts; tests inject
// a fake BlobIoAdapter instead and never load the native module.
function createNativeBlobIoAdapter(): BlobIoAdapter {
  return {
    blobPath,
    fileExists: async (path) => {
      const info = await FileSystem.getInfoAsync(path);
      return info.exists;
    },
    deleteFile: (path) => FileSystem.deleteAsync(path, { idempotent: true }),
  };
}

export interface StoredBlobMetadata {
  hash: string;
  size: number;
  mimeType: string;
  moduleId: string;
  storedAt: string;
}

export class ExpoBlobStore implements SessionBlobProvider {
  private dirReady = false;
  private readonly io: BlobIoAdapter;

  // `io` is injectable so the honesty-critical has()/removeLocal() branches are
  // Node/Vitest-testable (see blob-store-core.test.ts). Production builds the
  // real native adapter; tests pass a fake filesystem.
  constructor(private readonly db: DatabaseAdapter, io: BlobIoAdapter = createNativeBlobIoAdapter()) {
    this.io = io;
  }

  private async ensureDir(): Promise<void> {
    if (this.dirReady) return;
    const info = await FileSystem.getInfoAsync(storageDirectory());
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(storageDirectory(), { intermediates: true });
    }
    this.dirReady = true;
  }

  async get(hash: string): Promise<Uint8Array | null> {
    try {
      const path = blobPath(hash);
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;
      return decodeBase64(await FileSystem.readAsStringAsync(path));
    } catch {
      return null;
    }
  }

  async size(hash: string): Promise<number | null> {
    const info = await FileSystem.getInfoAsync(blobPath(hash));
    return info.exists && Number.isSafeInteger(info.size) ? info.size ?? null : null;
  }

  async readRange(hash: string, offset: number, length: number): Promise<Uint8Array | null> {
    const info = await FileSystem.getInfoAsync(blobPath(hash));
    if (!info.exists) return null;
    const base64 = await FileSystem.readAsStringAsync(blobPath(hash), {
      encoding: FileSystem.EncodingType.Base64,
      position: offset,
      length,
    });
    return decodeBase64(base64);
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

    await this.ensureDir();
    await FileSystem.writeAsStringAsync(blobPath(hash), encodeBase64(bytes), {
      encoding: FileSystem.EncodingType.UTF8,
    });
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
    try {
      const path = blobPath(hash);
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;
      const base64 = await FileSystem.readAsStringAsync(path);
      return `data:${mimeType};base64,${base64}`;
    } catch {
      return null;
    }
  }

  /**
   * Is the plaintext blob for this hash on this device right now? Derived LIVE
   * from a real filesystem check; never a stored flag and never written onto the
   * signed, immutable attachment metadata. The attachment card calls this to show
   * "on this device" vs the removed placeholder.
   */
  async has(hash: string): Promise<boolean> {
    return hasBlobLocal(this.io, hash);
  }

  /**
   * Remove ONLY this device's local copy of a blob, ref-count aware and verified
   * after delete (see removeBlobLocal). Local-only: it does NOT emit a cm_ event,
   * call recordLocalChange, or queue a mailbox message, so freeing space never
   * replicates or looks like deleting the file for other members. The signed
   * message and its immutable attachment metadata are untouched.
   */
  async removeLocal(hash: string): Promise<RemoveBlobResult> {
    return removeBlobLocal(this.io, this.db, hash);
  }

  /** Delete every plaintext attachment byte held by Meerkat on this device. */
  async clearAll(): Promise<void> {
    await FileSystem.deleteAsync(storageDirectory(), { idempotent: true });
    const after = await FileSystem.getInfoAsync(storageDirectory());
    if (after.exists) throw new Error('Meerkat blob directory still exists after deletion.');
    this.dirReady = false;
  }

  async exportToCache(hash: string, name: string): Promise<string | null> {
    try {
      const path = blobPath(hash);
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;
      const cacheDir = FileSystem.cacheDirectory ?? getPrivateStorageRoot();
      if (!cacheDir) return null;
      const outputPath = `${cacheDir}meerkat-${hash.slice(0, 12)}-${safeFilename(name)}`;
      const base64 = await FileSystem.readAsStringAsync(path);
      await FileSystem.writeAsStringAsync(outputPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return outputPath;
    } catch {
      return null;
    }
  }
}
