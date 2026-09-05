import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createSyncTables,
  getBlob,
  incrementBlobRefCount,
  insertBlob,
} from '@mylife/sync';
import {
  hasBlobLocal,
  removeBlobLocal,
  type BlobIoAdapter,
} from '../(root)/data/blob-store-core';

// A fake filesystem so the honesty-critical presence + removal branches run under
// Node without loading expo-file-system. `forceStillPresentAfterDelete` simulates
// a delete that silently does not land, to prove removeLocal fails closed.
interface FakeBlobIoOptions {
  forceStillPresentAfterDelete?: boolean;
  deleteThrows?: boolean;
}

interface FakeBlobIo extends BlobIoAdapter {
  files: Set<string>;
  deletes: string[];
}

function makeFakeIo(opts: FakeBlobIoOptions = {}): FakeBlobIo {
  const files = new Set<string>();
  const deletes: string[] = [];
  return {
    files,
    deletes,
    blobPath: (hash) => `/blobs/${hash}`,
    fileExists: async (path) => files.has(path),
    deleteFile: async (path) => {
      deletes.push(path);
      if (opts.deleteThrows) throw new Error('disk error during delete');
      if (!opts.forceStillPresentAfterDelete) files.delete(path);
    },
  };
}

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function seedIndex(db: InMemoryTestDatabase, hash: string, refCount = 1): void {
  insertBlob(db.adapter, {
    hash,
    size: 1234,
    mimeType: 'image/png',
    moduleId: 'community',
    refCount,
    storedAt: new Date().toISOString(),
  });
}

let db: InMemoryTestDatabase;

beforeEach(() => {
  db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
});

afterEach(() => {
  db.close();
});

describe('hasBlobLocal (presence, derived live)', () => {
  it('returns true when the file is on disk and false otherwise', async () => {
    const io = makeFakeIo();
    expect(await hasBlobLocal(io, HASH_A)).toBe(false);
    io.files.add(io.blobPath(HASH_A));
    expect(await hasBlobLocal(io, HASH_A)).toBe(true);
    expect(await hasBlobLocal(io, HASH_B)).toBe(false);
  });

  it('never throws; returns false when the IO layer fails', async () => {
    const io: BlobIoAdapter = {
      blobPath: (h) => `/blobs/${h}`,
      fileExists: async () => {
        throw new Error('stat failed');
      },
      deleteFile: async () => {},
    };
    expect(await hasBlobLocal(io, HASH_A)).toBe(false);
  });
});

describe('removeBlobLocal (ref-count aware, verified after delete)', () => {
  it('frees the bytes and index row when the blob is singly referenced', async () => {
    const io = makeFakeIo();
    io.files.add(io.blobPath(HASH_A));
    seedIndex(db, HASH_A, 1);

    const result = await removeBlobLocal(io, db.adapter, HASH_A);

    expect(result).toEqual({ freed: true, remainingRefs: 0 });
    expect(io.deletes).toEqual([io.blobPath(HASH_A)]);
    expect(await hasBlobLocal(io, HASH_A)).toBe(false);
    // The index row is gone.
    expect(getBlob(db.adapter, HASH_A)).toBeNull();
  });

  it('returns not-present (frees nothing) when the file is already gone', async () => {
    const io = makeFakeIo();
    seedIndex(db, HASH_A, 1);

    const result = await removeBlobLocal(io, db.adapter, HASH_A);

    expect(result).toEqual({ freed: false, reason: 'not-present' });
    expect(io.deletes).toHaveLength(0);
    // The index row is left untouched (we never decremented or deleted it).
    expect(getBlob(db.adapter, HASH_A)?.refCount).toBe(1);
  });

  it('KEEPS the on-disk bytes when another reference remains (ref-count aware)', async () => {
    // Two references to the same blob: removing one card must not orphan the
    // other card's bytes.
    const io = makeFakeIo();
    io.files.add(io.blobPath(HASH_A));
    seedIndex(db, HASH_A, 1);
    incrementBlobRefCount(db.adapter, HASH_A); // now ref_count = 2

    const result = await removeBlobLocal(io, db.adapter, HASH_A);

    expect(result).toEqual({ freed: false, reason: 'still-referenced', remainingRefs: 1 });
    // File is intentionally kept; nothing was deleted.
    expect(io.deletes).toHaveLength(0);
    expect(await hasBlobLocal(io, HASH_A)).toBe(true);
    // The row survives with the decremented count.
    expect(getBlob(db.adapter, HASH_A)?.refCount).toBe(1);
  });

  it('fails closed (verify-failed) when the file survives the delete', async () => {
    // A delete that silently does not land must NEVER report space freed.
    const io = makeFakeIo({ forceStillPresentAfterDelete: true });
    io.files.add(io.blobPath(HASH_A));
    seedIndex(db, HASH_A, 1);

    const result = await removeBlobLocal(io, db.adapter, HASH_A);

    expect(result).toEqual({ freed: false, reason: 'verify-failed' });
    // We attempted the delete and removed the index row, but the bytes remain.
    expect(io.deletes).toEqual([io.blobPath(HASH_A)]);
    expect(await hasBlobLocal(io, HASH_A)).toBe(true);
  });

  it('returns an error result (not a false success) when delete throws', async () => {
    const io = makeFakeIo({ deleteThrows: true });
    io.files.add(io.blobPath(HASH_A));
    seedIndex(db, HASH_A, 1);

    const result = await removeBlobLocal(io, db.adapter, HASH_A);

    expect(result.freed).toBe(false);
    if (!result.freed && result.reason === 'error') {
      expect(result.message).toMatch(/disk error/i);
    } else {
      throw new Error(`expected an error result, got ${JSON.stringify(result)}`);
    }
    // The bytes are still on disk; we never claimed they were freed.
    expect(await hasBlobLocal(io, HASH_A)).toBe(true);
  });

  it('frees orphaned bytes that have no index row (treated as last reference)', async () => {
    const io = makeFakeIo();
    io.files.add(io.blobPath(HASH_A));
    // No insertBlob: there is no sync_blobs row for this hash.

    const result = await removeBlobLocal(io, db.adapter, HASH_A);

    expect(result).toEqual({ freed: true, remainingRefs: 0 });
    expect(await hasBlobLocal(io, HASH_A)).toBe(false);
  });
});
