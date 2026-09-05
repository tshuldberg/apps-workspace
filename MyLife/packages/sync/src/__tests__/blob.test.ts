import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import type { DatabaseAdapter } from '@mylife/db';
import { BlobStore } from '../blob/blob-store';
import {
  splitIntoBlocks,
  reassembleBlocks,
  verifyBlob,
  getMissingBlockIndices,
  BLOCK_SIZE,
} from '../blob/blob-sync';
import {
  getDefaultPolicy,
  shouldSyncBlob,
  ensureBlobPolicy,
} from '../blob/blob-policy';
import type { BlobPolicyEntry } from '../types';

function createMockDb(): DatabaseAdapter {
  return {
    execute: vi.fn(),
    query: vi.fn().mockReturnValue([]),
    transaction: vi.fn((fn: () => void) => fn()),
  };
}

// ---------------------------------------------------------------------------
// BlobStore
// ---------------------------------------------------------------------------

describe('BlobStore', () => {
  let tmpDir: string;
  let store: BlobStore;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'blob-test-'));
    store = new BlobStore({ basePath: tmpDir });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('hash produces consistent SHA-256', async () => {
    const data = new TextEncoder().encode('hello world');
    const hash1 = await BlobStore.hash(data);
    const hash2 = await BlobStore.hash(data);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it('hash produces different results for different inputs', async () => {
    const hash1 = await BlobStore.hash(new TextEncoder().encode('hello'));
    const hash2 = await BlobStore.hash(new TextEncoder().encode('world'));
    expect(hash1).not.toBe(hash2);
  });

  it('put/get roundtrip', async () => {
    const data = new TextEncoder().encode('test blob content');
    const { hash, size } = await store.put(data, 'text/plain');

    expect(hash).toHaveLength(64);
    expect(size).toBe(data.length);

    const retrieved = await store.get(hash);
    expect(retrieved).not.toBeNull();
    expect(new TextDecoder().decode(retrieved!)).toBe('test blob content');
  });

  it('has returns false for missing blobs', async () => {
    const exists = await store.has('0000000000000000000000000000000000000000000000000000000000000000');
    expect(exists).toBe(false);
  });

  it('has returns true for stored blobs', async () => {
    const data = new TextEncoder().encode('exists');
    const { hash } = await store.put(data, 'text/plain');

    expect(await store.has(hash)).toBe(true);
  });

  it('get returns null for missing blobs', async () => {
    const result = await store.get('deadbeef00000000000000000000000000000000000000000000000000000000');
    expect(result).toBeNull();
  });

  it('delete removes file', async () => {
    const data = new TextEncoder().encode('delete me');
    const { hash } = await store.put(data, 'text/plain');

    expect(await store.has(hash)).toBe(true);
    await store.delete(hash);
    expect(await store.has(hash)).toBe(false);
  });

  it('delete is a no-op for missing blobs', async () => {
    // Should not throw
    await store.delete('0000000000000000000000000000000000000000000000000000000000000000');
  });

  it('uses 2-char subdirectory structure', () => {
    const hash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const filePath = store.getPath(hash);
    expect(filePath).toBe(path.join(tmpDir, 'ab', hash));
  });
});

// ---------------------------------------------------------------------------
// BlobSync
// ---------------------------------------------------------------------------

describe('BlobSync', () => {
  it('splitIntoBlocks creates correct number of blocks for small data', () => {
    const data = new Uint8Array(100);
    const blocks = splitIntoBlocks(data, 'testhash');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.index).toBe(0);
    expect(blocks[0]!.total).toBe(1);
    expect(blocks[0]!.hash).toBe('testhash');
    expect(blocks[0]!.data.length).toBe(100);
  });

  it('splitIntoBlocks creates correct number of blocks for large data', () => {
    const data = new Uint8Array(BLOCK_SIZE * 3 + 100);
    const blocks = splitIntoBlocks(data, 'testhash');
    expect(blocks).toHaveLength(4);
    expect(blocks[0]!.data.length).toBe(BLOCK_SIZE);
    expect(blocks[1]!.data.length).toBe(BLOCK_SIZE);
    expect(blocks[2]!.data.length).toBe(BLOCK_SIZE);
    expect(blocks[3]!.data.length).toBe(100);
  });

  it('splitIntoBlocks handles empty data', () => {
    const data = new Uint8Array(0);
    const blocks = splitIntoBlocks(data, 'testhash');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.data.length).toBe(0);
  });

  it('reassembleBlocks recovers original data', () => {
    const original = new Uint8Array(BLOCK_SIZE * 2 + 500);
    for (let i = 0; i < original.length; i++) {
      original[i] = i % 256;
    }

    const blocks = splitIntoBlocks(original, 'hash');
    const reassembled = reassembleBlocks(blocks);

    expect(reassembled.length).toBe(original.length);
    expect(reassembled).toEqual(original);
  });

  it('reassembleBlocks handles out-of-order blocks', () => {
    const original = new Uint8Array(BLOCK_SIZE * 2 + 100);
    for (let i = 0; i < original.length; i++) {
      original[i] = i % 256;
    }

    const blocks = splitIntoBlocks(original, 'hash');
    const shuffled = [blocks[2]!, blocks[0]!, blocks[1]!];
    const reassembled = reassembleBlocks(shuffled);

    expect(reassembled).toEqual(original);
  });

  it('verifyBlob returns true for matching hash', async () => {
    const data = new TextEncoder().encode('verify me');
    const hash = await BlobStore.hash(data);
    const result = await verifyBlob(data, hash);
    expect(result).toBe(true);
  });

  it('verifyBlob returns false for mismatched hash', async () => {
    const data = new TextEncoder().encode('verify me');
    const result = await verifyBlob(data, 'wrong_hash');
    expect(result).toBe(false);
  });

  it('getMissingBlockIndices returns correct indices', () => {
    const peerHas = [true, false, true, false, true];
    const missing = getMissingBlockIndices(5, peerHas);
    expect(missing).toEqual([1, 3]);
  });

  it('getMissingBlockIndices returns all when peer has none', () => {
    const peerHas = [false, false, false];
    const missing = getMissingBlockIndices(3, peerHas);
    expect(missing).toEqual([0, 1, 2]);
  });

  it('getMissingBlockIndices returns empty when peer has all', () => {
    const peerHas = [true, true, true];
    const missing = getMissingBlockIndices(3, peerHas);
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// BlobPolicy
// ---------------------------------------------------------------------------

describe('BlobPolicy', () => {
  it('getDefaultPolicy returns wifi_only with 50MB limit', () => {
    const policy = getDefaultPolicy('books');
    expect(policy.moduleId).toBe('books');
    expect(policy.policy).toBe('wifi_only');
    expect(policy.maxBlobSizeBytes).toBe(50 * 1024 * 1024);
    expect(policy.updatedAt).toBeDefined();
  });

  describe('shouldSyncBlob', () => {
    const wifiConditions = { isWifi: true, isCellular: false, isMetered: false };
    const cellularConditions = { isWifi: false, isCellular: true, isMetered: true };
    const unmeteredCellular = { isWifi: false, isCellular: true, isMetered: false };

    it('respects "never" policy', () => {
      const policy: BlobPolicyEntry = {
        moduleId: 'books',
        policy: 'never',
        maxBlobSizeBytes: 50 * 1024 * 1024,
        updatedAt: new Date().toISOString(),
      };
      expect(shouldSyncBlob(policy, 100, wifiConditions)).toBe(false);
    });

    it('respects "manual" policy', () => {
      const policy: BlobPolicyEntry = {
        moduleId: 'books',
        policy: 'manual',
        maxBlobSizeBytes: 50 * 1024 * 1024,
        updatedAt: new Date().toISOString(),
      };
      expect(shouldSyncBlob(policy, 100, wifiConditions)).toBe(false);
    });

    it('wifi_only allows sync on WiFi', () => {
      const policy: BlobPolicyEntry = {
        moduleId: 'books',
        policy: 'wifi_only',
        maxBlobSizeBytes: 50 * 1024 * 1024,
        updatedAt: new Date().toISOString(),
      };
      expect(shouldSyncBlob(policy, 100, wifiConditions)).toBe(true);
    });

    it('wifi_only blocks sync on cellular', () => {
      const policy: BlobPolicyEntry = {
        moduleId: 'books',
        policy: 'wifi_only',
        maxBlobSizeBytes: 50 * 1024 * 1024,
        updatedAt: new Date().toISOString(),
      };
      expect(shouldSyncBlob(policy, 100, cellularConditions)).toBe(false);
    });

    it('wifi_only blocks sync on metered WiFi', () => {
      const policy: BlobPolicyEntry = {
        moduleId: 'books',
        policy: 'wifi_only',
        maxBlobSizeBytes: 50 * 1024 * 1024,
        updatedAt: new Date().toISOString(),
      };
      const meteredWifi = { isWifi: true, isCellular: false, isMetered: true };
      expect(shouldSyncBlob(policy, 100, meteredWifi)).toBe(false);
    });

    it('"always" allows sync on any connection', () => {
      const policy: BlobPolicyEntry = {
        moduleId: 'books',
        policy: 'always',
        maxBlobSizeBytes: 50 * 1024 * 1024,
        updatedAt: new Date().toISOString(),
      };
      expect(shouldSyncBlob(policy, 100, wifiConditions)).toBe(true);
      expect(shouldSyncBlob(policy, 100, cellularConditions)).toBe(true);
      expect(shouldSyncBlob(policy, 100, unmeteredCellular)).toBe(true);
    });

    it('respects maxBlobSizeBytes limit', () => {
      const policy: BlobPolicyEntry = {
        moduleId: 'books',
        policy: 'always',
        maxBlobSizeBytes: 1000,
        updatedAt: new Date().toISOString(),
      };
      expect(shouldSyncBlob(policy, 999, wifiConditions)).toBe(true);
      expect(shouldSyncBlob(policy, 1000, wifiConditions)).toBe(true);
      expect(shouldSyncBlob(policy, 1001, wifiConditions)).toBe(false);
    });
  });

  it('ensureBlobPolicy returns existing policy from DB', () => {
    const db = createMockDb();
    vi.mocked(db.query).mockReturnValueOnce([{
      module_id: 'books',
      policy: 'always',
      max_blob_size_bytes: 100_000_000,
      updated_at: '2025-01-01T00:00:00Z',
    }]);

    const policy = ensureBlobPolicy(db, 'books');
    expect(policy.policy).toBe('always');
    expect(policy.maxBlobSizeBytes).toBe(100_000_000);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('ensureBlobPolicy creates default when none exists', () => {
    const db = createMockDb();
    vi.mocked(db.query).mockReturnValueOnce([]);

    const policy = ensureBlobPolicy(db, 'books');
    expect(policy.policy).toBe('wifi_only');
    expect(policy.moduleId).toBe('books');
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO sync_blob_policy'),
      expect.any(Array),
    );
  });
});
