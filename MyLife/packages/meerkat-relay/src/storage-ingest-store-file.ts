import { promises as fs } from 'node:fs';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import type { SeederPieceStore } from './seeder-node';
import type {
  HostedStorageBlockStore,
  StorageBlockDeleteResult,
} from './storage-ingest';
import { withExclusiveFileLock } from './file-lock';

const SAFE_CONTENT_ID = /^[A-Za-z0-9_-]{1,128}$/u;

/** Durable adapter that exposes one tenant's opaque seeder pieces to resumable ingest. */
export class FileStorageIngestStore implements HostedStorageBlockStore {
  constructor(
    private readonly baseDir: string,
    private readonly pieces: SeederPieceStore,
    private readonly maximumBytes: number,
  ) {}

  usedBytes(): Promise<number> | number {
    return this.pieces.sizeBytes();
  }

  capBytes(): number {
    return this.maximumBytes;
  }

  async hasBlock(contentId: string, index: number): Promise<boolean> {
    return (await this.pieces.get(contentId, index)) !== null;
  }

  getBlock(contentId: string, index: number): Promise<Uint8Array | null> | Uint8Array | null {
    return this.pieces.get(contentId, index);
  }

  putBlock(contentId: string, index: number, bytes: Uint8Array): Promise<void> | void {
    return this.pieces.put(contentId, index, bytes);
  }

  async storedBitfield(contentId: string, total: number): Promise<boolean[]> {
    const stored: boolean[] = [];
    for (let index = 0; index < total; index += 1) {
      stored.push(await this.hasBlock(contentId, index));
    }
    return stored;
  }

  private async contentStats(contentId: string): Promise<StorageBlockDeleteResult> {
    let entries: string[];
    try {
      entries = await fs.readdir(path.join(this.baseDir, contentId));
    } catch {
      return { deletedBlocks: 0, deletedBytes: 0 };
    }
    let deletedBlocks = 0;
    let deletedBytes = 0;
    for (const entry of entries) {
      if (!/^\d+$/u.test(entry)) continue;
      try {
        const stat = await fs.stat(path.join(this.baseDir, contentId, entry));
        if (!stat.isFile()) continue;
        deletedBlocks += 1;
        deletedBytes += stat.size;
      } catch {
        // A concurrent retry already removed the block.
      }
    }
    return { deletedBlocks, deletedBytes };
  }

  private async deleteContentUnlocked(contentId: string): Promise<StorageBlockDeleteResult> {
    if (!SAFE_CONTENT_ID.test(contentId)) throw new TypeError('content id is invalid');
    const deleted = await this.contentStats(contentId);
    await this.pieces.removeContent(contentId);
    return deleted;
  }

  deleteContent(contentId: string): Promise<StorageBlockDeleteResult> {
    return this.withWriteLock(() => this.deleteContentUnlocked(contentId));
  }

  deleteAll(): Promise<StorageBlockDeleteResult> {
    return this.withWriteLock(async () => {
      let entries: Dirent[];
      try {
        entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      } catch {
        return { deletedBlocks: 0, deletedBytes: 0 };
      }
      let deletedBlocks = 0;
      let deletedBytes = 0;
      for (const entry of entries) {
        if (!entry.isDirectory() || !SAFE_CONTENT_ID.test(entry.name)) continue;
        const deleted = await this.deleteContentUnlocked(entry.name);
        deletedBlocks += deleted.deletedBlocks;
        deletedBytes += deleted.deletedBytes;
      }
      return { deletedBlocks, deletedBytes };
    });
  }

  withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    return withExclusiveFileLock(path.join(this.baseDir, '.storage-ingest.lock'), operation, {
      timeoutMs: 30_000,
    });
  }
}
