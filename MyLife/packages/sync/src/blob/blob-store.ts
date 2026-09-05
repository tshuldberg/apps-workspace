/**
 * Content-addressed local file storage with SHA-256 keys.
 *
 * Blobs are stored in a two-level directory structure using the
 * first two characters of the hash as a subdirectory, similar
 * to git's object storage.
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export interface BlobStoreOptions {
  /** Base directory for blob storage (e.g., ~/.mylife/blobs/) */
  basePath: string;
}

/**
 * Content-addressed blob store backed by the local filesystem.
 *
 * Uses SHA-256 hashes as keys and a two-level directory layout:
 * `basePath/ab/abcdef1234...` where `ab` is the first two hex chars.
 */
export class BlobStore {
  private basePath: string;

  constructor(options: BlobStoreOptions) {
    this.basePath = options.basePath;
  }

  /** Store a blob. Returns its SHA-256 hash and size. */
  async put(data: Uint8Array, _mimeType: string): Promise<{ hash: string; size: number }> {
    const hash = await BlobStore.hash(data);
    const filePath = this.getPath(hash);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, data);

    return { hash, size: data.length };
  }

  /** Retrieve a blob by hash. Returns null if not found. */
  async get(hash: string): Promise<Uint8Array | null> {
    const filePath = this.getPath(hash);
    try {
      const data = await fs.readFile(filePath);
      return new Uint8Array(data);
    } catch {
      return null;
    }
  }

  /** Check if a blob exists locally. */
  async has(hash: string): Promise<boolean> {
    const filePath = this.getPath(hash);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /** Delete a blob file from disk. */
  async delete(hash: string): Promise<void> {
    const filePath = this.getPath(hash);
    try {
      await fs.unlink(filePath);
    } catch {
      // File already gone, no-op
    }
  }

  /**
   * Get the file path for a blob hash.
   * Uses first 2 hex chars as subdirectory: basePath/ab/abcdef...
   */
  getPath(hash: string): string {
    const prefix = hash.slice(0, 2);
    return path.join(this.basePath, prefix, hash);
  }

  /** Compute SHA-256 hash of data. Returns hex string. */
  static async hash(data: Uint8Array): Promise<string> {
    const h = createHash('sha256');
    h.update(data);
    return h.digest('hex');
  }
}
