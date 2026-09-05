import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncManager, createSyncManager } from '../db-integration';
import { LocalOnlyProvider } from '../providers/local-only';

describe('SyncManager', () => {
  let manager: SyncManager;

  beforeEach(() => {
    manager = createSyncManager();
  });

  it('starts with local_only tier and no provider', () => {
    expect(manager.tier).toBe('local_only');
    expect(manager.provider).toBeNull();
  });

  describe('initialize()', () => {
    it('creates a LocalOnlyProvider by default', async () => {
      const provider = await manager.initialize();
      expect(provider).toBeInstanceOf(LocalOnlyProvider);
      expect(manager.tier).toBe('local_only');
      expect(manager.provider).toBe(provider);
    });

    it('accepts an explicit tier argument', async () => {
      const provider = await manager.initialize('local_only');
      expect(provider.tier).toBe('local_only');
    });
  });

  describe('switchTier()', () => {
    it('returns same provider when tier unchanged', async () => {
      const p1 = await manager.initialize('local_only');
      const p2 = await manager.switchTier('local_only');
      expect(p2).toBe(p1);
    });

    it('throws when switching to cloud without auth', async () => {
      const authManager = new SyncManager({
        isAuthenticated: async () => false,
      });
      await authManager.initialize('local_only');
      await expect(authManager.switchTier('free_cloud')).rejects.toThrow(
        'requires authentication',
      );
    });

    it('throws when switching to p2p without factory', async () => {
      await manager.initialize('local_only');
      await expect(manager.switchTier('p2p')).rejects.toThrow(
        'P2P sync is not available',
      );
    });

    it('throws when switching to cloud without factory', async () => {
      const authManager = new SyncManager({
        isAuthenticated: async () => true,
      });
      await authManager.initialize('local_only');
      await expect(authManager.switchTier('free_cloud')).rejects.toThrow(
        'Cloud sync is not available',
      );
    });

    it('destroys old provider before creating new one', async () => {
      const destroySpy = vi.fn().mockResolvedValue(undefined);
      await manager.initialize('local_only');
      const originalProvider = manager.provider!;
      originalProvider.destroy = destroySpy;

      // Switch to a "new" local-only by forcing different tier tracking
      (manager as unknown as { _currentTier: string })._currentTier = 'p2p';

      // This will fail because no p2p factory, but we can test local->local
      // Instead, test local_only -> local_only with forced tier change
      const freshManager = new SyncManager();
      await freshManager.initialize('local_only');
      const p1 = freshManager.provider!;
      p1.destroy = destroySpy;

      // Force internal tier to something else so switchTier sees a change
      (freshManager as unknown as { _currentTier: string })._currentTier = 'p2p';
      await freshManager.switchTier('local_only');

      expect(destroySpy).toHaveBeenCalledOnce();
    });
  });

  describe('destroy()', () => {
    it('tears down the current provider', async () => {
      await manager.initialize('local_only');
      expect(manager.provider).not.toBeNull();
      await manager.destroy();
      expect(manager.provider).toBeNull();
      expect(manager.tier).toBe('local_only');
    });

    it('is safe to call when no provider exists', async () => {
      await expect(manager.destroy()).resolves.toBeUndefined();
    });
  });
});

describe('createSyncManager()', () => {
  it('returns a SyncManager instance', () => {
    const manager = createSyncManager();
    expect(manager).toBeInstanceOf(SyncManager);
  });
});
