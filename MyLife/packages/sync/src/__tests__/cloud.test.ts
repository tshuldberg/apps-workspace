import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudProvider } from '../providers/cloud';
import type { CloudProviderOptions, PowerSyncLike, SupabaseStorageClient } from '../providers/cloud';
import { STORAGE_LIMITS } from '../types';

function createMockPowerSync(): PowerSyncLike {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    connected: true,
    currentStatus: {
      connected: true,
      lastSyncedAt: null,
      uploading: false,
      downloading: false,
    },
  };
}

function createMockSupabaseStorage(
  usedBytes = 0,
  token: string | null = 'mock-token',
): SupabaseStorageClient {
  return {
    getStorageUsedBytes: vi.fn().mockResolvedValue(usedBytes),
    getSessionToken: vi.fn().mockResolvedValue(token),
  };
}

describe('CloudProvider', () => {
  let provider: CloudProvider;
  let mockPowerSync: PowerSyncLike;
  let mockStorage: SupabaseStorageClient;

  beforeEach(() => {
    mockPowerSync = createMockPowerSync();
    mockStorage = createMockSupabaseStorage();
    provider = new CloudProvider({
      tier: 'free_cloud',
      powerSync: mockPowerSync,
      supabaseStorage: mockStorage,
    });
  });

  it('has the correct tier', () => {
    expect(provider.tier).toBe('free_cloud');
  });

  it('throws if constructed with non-cloud tier', () => {
    expect(() => {
      new CloudProvider({
        tier: 'local_only' as CloudProviderOptions['tier'],
        powerSync: mockPowerSync,
        supabaseStorage: mockStorage,
      });
    }).toThrow('requires a cloud tier');
  });

  describe('initialize()', () => {
    it('connects PowerSync when authenticated', async () => {
      await provider.initialize();
      expect(mockPowerSync.connect).toHaveBeenCalledOnce();
      expect(provider.initialized).toBe(true);
    });

    it('throws when not authenticated', async () => {
      const noAuthStorage = createMockSupabaseStorage(0, null);
      const noAuthProvider = new CloudProvider({
        tier: 'free_cloud',
        powerSync: mockPowerSync,
        supabaseStorage: noAuthStorage,
      });
      await expect(noAuthProvider.initialize()).rejects.toThrow(
        'requires authentication',
      );
    });
  });

  describe('sync()', () => {
    it('is a no-op when not initialized', async () => {
      await provider.sync();
      expect(mockStorage.getStorageUsedBytes).not.toHaveBeenCalled();
    });

    it('checks storage and syncs when initialized', async () => {
      await provider.initialize();
      await provider.sync();
      expect(mockStorage.getStorageUsedBytes).toHaveBeenCalled();
    });

    it('emits error when storage limit exceeded', async () => {
      const overLimitStorage = createMockSupabaseStorage(
        STORAGE_LIMITS.free_cloud + 1,
      );
      const overProvider = new CloudProvider({
        tier: 'free_cloud',
        powerSync: mockPowerSync,
        supabaseStorage: overLimitStorage,
      });
      await overProvider.initialize();

      const listener = vi.fn();
      overProvider.onEvent(listener);
      await overProvider.sync();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync_error',
          error: expect.objectContaining({
            message: expect.stringContaining('Storage limit exceeded'),
          }),
        }),
      );
    });
  });

  describe('pause() and resume()', () => {
    it('disconnects on pause and reconnects on resume', async () => {
      await provider.initialize();
      await provider.pause();
      expect(mockPowerSync.disconnect).toHaveBeenCalledOnce();

      await provider.resume();
      // connect called twice: once in initialize, once in resume
      expect(mockPowerSync.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('getStatus()', () => {
    it('returns cloud status with correct storage limit', () => {
      const status = provider.getStatus();
      expect(status.tier).toBe('free_cloud');
      expect(status.storageLimitBytes).toBe(STORAGE_LIMITS.free_cloud);
    });
  });

  describe('getStorageUsed()', () => {
    it('queries Supabase for storage usage', async () => {
      const storage = createMockSupabaseStorage(5000);
      const p = new CloudProvider({
        tier: 'starter_cloud',
        powerSync: mockPowerSync,
        supabaseStorage: storage,
      });
      const used = await p.getStorageUsed();
      expect(used).toBe(5000);
    });

    it('falls back to local file size on error', async () => {
      const failStorage: SupabaseStorageClient = {
        getStorageUsedBytes: vi.fn().mockRejectedValue(new Error('network')),
        getSessionToken: vi.fn().mockResolvedValue('token'),
      };
      const getDbFileSize = vi.fn().mockResolvedValue(2048);
      const p = new CloudProvider({
        tier: 'free_cloud',
        powerSync: mockPowerSync,
        supabaseStorage: failStorage,
        getDbFileSize,
      });
      const used = await p.getStorageUsed();
      expect(used).toBe(2048);
    });
  });

  describe('destroy()', () => {
    it('disconnects PowerSync', async () => {
      await provider.initialize();
      await provider.destroy();
      expect(mockPowerSync.disconnect).toHaveBeenCalled();
      expect(provider.initialized).toBe(false);
    });
  });

  describe('storage limits per tier', () => {
    it('free_cloud has 1 GB', () => {
      expect(STORAGE_LIMITS.free_cloud).toBe(1 * 1024 * 1024 * 1024);
    });

    it('starter_cloud has 5 GB', () => {
      expect(STORAGE_LIMITS.starter_cloud).toBe(5 * 1024 * 1024 * 1024);
    });

    it('power_cloud has 25 GB', () => {
      expect(STORAGE_LIMITS.power_cloud).toBe(25 * 1024 * 1024 * 1024);
    });
  });
});
