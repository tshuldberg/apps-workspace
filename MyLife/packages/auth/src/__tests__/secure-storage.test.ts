import { describe, it, expect, vi } from 'vitest';
import {
  createExpoSecureStorage,
  createWebStorage,
  createMemoryStorage,
} from '../secure-storage';

describe('createExpoSecureStorage', () => {
  function createMockSecureStore() {
    const store = new Map<string, string>();
    return {
      getItemAsync: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      setItemAsync: vi.fn((key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      deleteItemAsync: vi.fn((key: string) => {
        store.delete(key);
        return Promise.resolve();
      }),
      _store: store,
    };
  }

  it('stores and retrieves values with prefixed keys', async () => {
    const mock = createMockSecureStore();
    const storage = createExpoSecureStorage(mock);

    await storage.setItem('sb-token', 'abc123');
    const value = await storage.getItem('sb-token');

    expect(value).toBe('abc123');
    expect(mock.setItemAsync).toHaveBeenCalledWith('mylife.auth.sb-token', 'abc123');
    expect(mock.getItemAsync).toHaveBeenCalledWith('mylife.auth.sb-token');
  });

  it('removes values with prefixed keys', async () => {
    const mock = createMockSecureStore();
    const storage = createExpoSecureStorage(mock);

    await storage.setItem('sb-token', 'abc123');
    await storage.removeItem('sb-token');
    const value = await storage.getItem('sb-token');

    expect(value).toBeNull();
    expect(mock.deleteItemAsync).toHaveBeenCalledWith('mylife.auth.sb-token');
  });

  it('returns null when getItem throws', async () => {
    const mock = createMockSecureStore();
    mock.getItemAsync.mockRejectedValueOnce(new Error('Keychain not available'));
    const storage = createExpoSecureStorage(mock);

    const value = await storage.getItem('sb-token');
    expect(value).toBeNull();
  });

  it('swallows errors on removeItem for non-existent keys', async () => {
    const mock = createMockSecureStore();
    mock.deleteItemAsync.mockRejectedValueOnce(new Error('No such key'));
    const storage = createExpoSecureStorage(mock);

    await expect(storage.removeItem('nonexistent')).resolves.toBeUndefined();
  });
});

describe('createWebStorage', () => {
  it('stores and retrieves values from localStorage', async () => {
    const mockStorage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
    });

    const storage = createWebStorage();

    await storage.setItem('sb-refresh', 'refresh-token');
    const value = await storage.getItem('sb-refresh');

    expect(value).toBe('refresh-token');
    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
      'mylife.auth.sb-refresh',
      'refresh-token',
    );

    vi.unstubAllGlobals();
  });

  it('returns null when localStorage is unavailable', async () => {
    vi.stubGlobal('localStorage', undefined);
    const storage = createWebStorage();

    const value = await storage.getItem('sb-token');
    expect(value).toBeNull();

    vi.unstubAllGlobals();
  });

  it('silently fails setItem when localStorage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(() => { throw new Error('QuotaExceededError'); }),
      removeItem: vi.fn(),
    });

    const storage = createWebStorage();
    await expect(storage.setItem('key', 'value')).resolves.toBeUndefined();

    vi.unstubAllGlobals();
  });
});

describe('createMemoryStorage', () => {
  it('stores, retrieves, and removes values', async () => {
    const storage = createMemoryStorage();

    await storage.setItem('token', 'test-value');
    expect(await storage.getItem('token')).toBe('test-value');

    await storage.removeItem('token');
    expect(await storage.getItem('token')).toBeNull();
  });

  it('returns null for unknown keys', async () => {
    const storage = createMemoryStorage();
    expect(await storage.getItem('nonexistent')).toBeNull();
  });

  it('isolates instances from each other', async () => {
    const storage1 = createMemoryStorage();
    const storage2 = createMemoryStorage();

    await storage1.setItem('key', 'from-storage-1');
    expect(await storage2.getItem('key')).toBeNull();
  });
});
