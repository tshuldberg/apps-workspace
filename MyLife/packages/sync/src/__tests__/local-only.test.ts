import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalOnlyProvider } from '../providers/local-only';

describe('LocalOnlyProvider', () => {
  let provider: LocalOnlyProvider;

  beforeEach(() => {
    provider = new LocalOnlyProvider();
  });

  it('has tier "local_only"', () => {
    expect(provider.tier).toBe('local_only');
  });

  it('initialize() sets initialized to true', async () => {
    expect(provider.initialized).toBe(false);
    await provider.initialize();
    expect(provider.initialized).toBe(true);
  });

  it('destroy() sets initialized to false', async () => {
    await provider.initialize();
    await provider.destroy();
    expect(provider.initialized).toBe(false);
  });

  it('sync() is a no-op and resolves', async () => {
    await expect(provider.sync()).resolves.toBeUndefined();
  });

  it('pause() is a no-op and resolves', async () => {
    await expect(provider.pause()).resolves.toBeUndefined();
  });

  it('resume() is a no-op and resolves', async () => {
    await expect(provider.resume()).resolves.toBeUndefined();
  });

  describe('getStatus()', () => {
    it('returns local-only status', () => {
      const status = provider.getStatus();
      expect(status.tier).toBe('local_only');
      expect(status.connected).toBe(false);
      expect(status.lastSyncedAt).toBeNull();
      expect(status.storageLimitBytes).toBe(Infinity);
      expect(status.pendingChanges).toBe(0);
    });
  });

  describe('getStorageUsed()', () => {
    it('returns 0 when no getDbFileSize is provided', async () => {
      const used = await provider.getStorageUsed();
      expect(used).toBe(0);
    });

    it('delegates to getDbFileSize when provided', async () => {
      const getDbFileSize = vi.fn().mockResolvedValue(1024 * 1024);
      const providerWithSize = new LocalOnlyProvider({ getDbFileSize });
      const used = await providerWithSize.getStorageUsed();
      expect(used).toBe(1024 * 1024);
      expect(getDbFileSize).toHaveBeenCalledOnce();
    });
  });

  describe('onEvent()', () => {
    it('returns a no-op unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = provider.onEvent(listener);
      expect(typeof unsub).toBe('function');
      unsub(); // Should not throw
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
