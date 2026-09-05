import { describe, it, expect } from 'vitest';
import { tierRequiresAuth, isCloudTier, STORAGE_LIMITS } from '../types';
import type { SyncTier } from '../types';

describe('types', () => {
  describe('tierRequiresAuth()', () => {
    it('returns false for local_only', () => {
      expect(tierRequiresAuth('local_only')).toBe(false);
    });

    it('returns false for p2p', () => {
      expect(tierRequiresAuth('p2p')).toBe(false);
    });

    it('returns true for all cloud tiers', () => {
      expect(tierRequiresAuth('free_cloud')).toBe(true);
      expect(tierRequiresAuth('starter_cloud')).toBe(true);
      expect(tierRequiresAuth('power_cloud')).toBe(true);
    });
  });

  describe('isCloudTier()', () => {
    it('returns false for non-cloud tiers', () => {
      expect(isCloudTier('local_only')).toBe(false);
      expect(isCloudTier('p2p')).toBe(false);
    });

    it('returns true for cloud tiers', () => {
      expect(isCloudTier('free_cloud')).toBe(true);
      expect(isCloudTier('starter_cloud')).toBe(true);
      expect(isCloudTier('power_cloud')).toBe(true);
    });
  });

  describe('STORAGE_LIMITS', () => {
    it('local_only and p2p have infinite limits', () => {
      expect(STORAGE_LIMITS.local_only).toBe(Infinity);
      expect(STORAGE_LIMITS.p2p).toBe(Infinity);
    });

    it('cloud tiers have finite limits in ascending order', () => {
      expect(STORAGE_LIMITS.free_cloud).toBeLessThan(STORAGE_LIMITS.starter_cloud);
      expect(STORAGE_LIMITS.starter_cloud).toBeLessThan(STORAGE_LIMITS.power_cloud);
    });

    it('covers all SyncTier values', () => {
      const allTiers: SyncTier[] = [
        'local_only',
        'p2p',
        'free_cloud',
        'starter_cloud',
        'power_cloud',
      ];
      for (const tier of allTiers) {
        expect(STORAGE_LIMITS[tier]).toBeDefined();
      }
    });
  });
});
