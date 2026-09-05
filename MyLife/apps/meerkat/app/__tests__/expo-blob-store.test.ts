import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';

const fsState = vi.hoisted(() => ({ exists: true }));
const deleteAsync = vi.hoisted(() => vi.fn(async () => { fsState.exists = false; }));
const getInfoAsync = vi.hoisted(() => vi.fn(async () => ({ exists: fsState.exists })));
const makeDirectoryAsync = vi.hoisted(() => vi.fn(async () => { fsState.exists = true; }));
const writeAsStringAsync = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../(root)/data/private-storage', () => ({ getPrivateStorageRoot: () => 'file:///private/' }));

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
  readAsStringAsync: vi.fn(),
}));

import { ExpoBlobStore } from '../(root)/data/expo-blob-store';

describe('ExpoBlobStore destructive wipe', () => {
  beforeEach(() => {
    fsState.exists = true;
    vi.clearAllMocks();
  });

  it('deletes and verifies the entire plaintext blob directory', async () => {
    const store = new ExpoBlobStore(createInMemoryTestDatabase().adapter);
    await store.clearAll();
    expect(deleteAsync).toHaveBeenCalledWith('file:///private/meerkat/blobs/', { idempotent: true });
    expect(getInfoAsync).toHaveBeenLastCalledWith('file:///private/meerkat/blobs/');
    expect(fsState.exists).toBe(false);
  });

  it('fails loudly if the platform reports that the directory survived', async () => {
    deleteAsync.mockImplementationOnce(async () => { fsState.exists = true; });
    const store = new ExpoBlobStore(createInMemoryTestDatabase().adapter);
    await expect(store.clearAll()).rejects.toThrow(/still exists/u);
  });
});
