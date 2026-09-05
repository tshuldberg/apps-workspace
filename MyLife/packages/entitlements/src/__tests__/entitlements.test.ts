import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isModuleUnlocked,
  getUnlockedModules,
  isHubUnlocked,
  getStorageTier,
  isUpdateEntitled,
  resolveEntitlements,
  PurchaseSchema,
  ProductIdSchema,
  StorageTierSchema,
  setTestMode,
} from '../index';
import type { EntitlementState, Purchase } from '../types';
import type { ModuleId } from '@mylife/module-registry';

beforeEach(() => setTestMode(false));
afterEach(() => setTestMode(true));

const NOW = Date.parse('2026-06-15T00:00:00.000Z');

const ALL_MODULES: ModuleId[] = [
  'books', 'budget', 'fast', 'recipes', 'rsvp',
  'surf', 'workouts', 'homes', 'car', 'habits', 'meds', 'words',
];

function emptyState(): EntitlementState {
  return {
    hubUnlocked: false,
    unlockedModules: new Set(),
    storageTier: 'free',
    updateEntitled: false,
    purchaseDate: null,
  };
}

// ---------------------------------------------------------------------------
// resolveEntitlements
// ---------------------------------------------------------------------------

describe('resolveEntitlements', () => {
  it('returns empty state when no purchases exist', () => {
    const state = resolveEntitlements([], NOW);
    expect(state.hubUnlocked).toBe(false);
    expect(state.unlockedModules.size).toBe(0);
    expect(state.storageTier).toBe('free');
    expect(state.updateEntitled).toBe(false);
    expect(state.purchaseDate).toBeNull();
  });

  it('unlocks all modules with hub unlock purchase', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_hub_unlock', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.hubUnlocked).toBe(true);
    expect(state.purchaseDate).toEqual(new Date('2026-06-01T00:00:00.000Z'));
  });

  it('unlocks a single standalone module', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_workouts_unlock', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.hubUnlocked).toBe(false);
    expect(state.unlockedModules.has('workouts')).toBe(true);
    expect(state.unlockedModules.size).toBe(1);
  });

  it('unlocks multiple standalone modules', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_books_unlock', purchaseDate: '2026-05-01T00:00:00.000Z', isActive: true },
      { productId: 'mylife_budget_unlock', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.unlockedModules.has('books')).toBe(true);
    expect(state.unlockedModules.has('budget')).toBe(true);
    expect(state.unlockedModules.size).toBe(2);
    // Earliest purchase date should be tracked
    expect(state.purchaseDate).toEqual(new Date('2026-05-01T00:00:00.000Z'));
  });

  it('does not conflict when hub unlock and standalone both exist', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_hub_unlock', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
      { productId: 'mylife_workouts_unlock', purchaseDate: '2026-05-15T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.hubUnlocked).toBe(true);
    expect(state.unlockedModules.has('workouts')).toBe(true);
    // Earliest date is the standalone purchase
    expect(state.purchaseDate).toEqual(new Date('2026-05-15T00:00:00.000Z'));
  });

  it('ignores inactive purchases', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_hub_unlock', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: false },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.hubUnlocked).toBe(false);
  });

  it('resolves storage tier to starter', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_storage_starter', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.storageTier).toBe('starter');
  });

  it('resolves storage tier to power', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_storage_power', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.storageTier).toBe('power');
  });

  it('power tier wins over starter when both present', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_storage_starter', purchaseDate: '2026-05-01T00:00:00.000Z', isActive: true },
      { productId: 'mylife_storage_power', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.storageTier).toBe('power');
  });

  it('power tier wins regardless of purchase order', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_storage_power', purchaseDate: '2026-05-01T00:00:00.000Z', isActive: true },
      { productId: 'mylife_storage_starter', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.storageTier).toBe('power');
  });

  it('sets updateEntitled true when annual update is active', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_annual_update', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.updateEntitled).toBe(true);
  });

  it('sets updateEntitled true when within Year 1 of purchase', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_hub_unlock', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    // 14 days after purchase -- well within Year 1
    const state = resolveEntitlements(purchases, NOW);
    expect(state.updateEntitled).toBe(true);
  });

  it('sets updateEntitled false when beyond Year 1 and no annual update', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_hub_unlock', purchaseDate: '2024-01-01T00:00:00.000Z', isActive: true },
    ];
    // ~2.5 years after purchase
    const state = resolveEntitlements(purchases, NOW);
    expect(state.updateEntitled).toBe(false);
  });

  it('annual update overrides expired Year 1 window', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_hub_unlock', purchaseDate: '2024-01-01T00:00:00.000Z', isActive: true },
      { productId: 'mylife_annual_update', purchaseDate: '2026-01-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(state.updateEntitled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isModuleUnlocked
// ---------------------------------------------------------------------------

describe('isModuleUnlocked', () => {
  it('MyFast is always unlocked (free tier)', () => {
    expect(isModuleUnlocked('fast', emptyState())).toBe(true);
  });

  it('premium module is locked with no purchases', () => {
    expect(isModuleUnlocked('books', emptyState())).toBe(false);
  });

  it('premium module is unlocked with hub unlock', () => {
    const state = { ...emptyState(), hubUnlocked: true };
    expect(isModuleUnlocked('books', state)).toBe(true);
    expect(isModuleUnlocked('workouts', state)).toBe(true);
  });

  it('standalone purchase unlocks only that module', () => {
    const state = { ...emptyState(), unlockedModules: new Set<ModuleId>(['workouts']) };
    expect(isModuleUnlocked('workouts', state)).toBe(true);
    expect(isModuleUnlocked('books', state)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getUnlockedModules
// ---------------------------------------------------------------------------

describe('getUnlockedModules', () => {
  it('returns only free modules with no purchases', () => {
    const result = getUnlockedModules(ALL_MODULES, emptyState());
    expect(result).toEqual(['fast']);
  });

  it('returns all modules with hub unlock', () => {
    const state = { ...emptyState(), hubUnlocked: true };
    const result = getUnlockedModules(ALL_MODULES, state);
    expect(result).toEqual(ALL_MODULES);
  });

  it('returns free modules plus unlocked standalones', () => {
    const state = { ...emptyState(), unlockedModules: new Set<ModuleId>(['books', 'budget']) };
    const result = getUnlockedModules(ALL_MODULES, state);
    expect(result).toEqual(['books', 'budget', 'fast']);
  });
});

// ---------------------------------------------------------------------------
// isHubUnlocked
// ---------------------------------------------------------------------------

describe('isHubUnlocked', () => {
  it('returns false with no purchases', () => {
    expect(isHubUnlocked(emptyState())).toBe(false);
  });

  it('returns true when hubUnlocked is set', () => {
    expect(isHubUnlocked({ ...emptyState(), hubUnlocked: true })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getStorageTier
// ---------------------------------------------------------------------------

describe('getStorageTier', () => {
  it('returns free by default', () => {
    expect(getStorageTier(emptyState())).toBe('free');
  });

  it('returns the configured tier', () => {
    expect(getStorageTier({ ...emptyState(), storageTier: 'starter' })).toBe('starter');
    expect(getStorageTier({ ...emptyState(), storageTier: 'power' })).toBe('power');
  });
});

// ---------------------------------------------------------------------------
// isUpdateEntitled
// ---------------------------------------------------------------------------

describe('isUpdateEntitled', () => {
  it('returns false when not entitled', () => {
    expect(isUpdateEntitled(emptyState())).toBe(false);
  });

  it('returns true when entitled', () => {
    expect(isUpdateEntitled({ ...emptyState(), updateEntitled: true })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bridge: standalone purchase unlocks hub module
// ---------------------------------------------------------------------------

describe('entitlement bridge', () => {
  it('standalone workouts purchase unlocks workouts in hub', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_workouts_unlock', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(isModuleUnlocked('workouts', state)).toBe(true);
    expect(isModuleUnlocked('books', state)).toBe(false);
    expect(isModuleUnlocked('fast', state)).toBe(true); // always free
  });

  it('standalone books purchase unlocks books in hub', () => {
    const purchases: Purchase[] = [
      { productId: 'mylife_books_unlock', purchaseDate: '2026-06-01T00:00:00.000Z', isActive: true },
    ];
    const state = resolveEntitlements(purchases, NOW);
    expect(isModuleUnlocked('books', state)).toBe(true);
    expect(state.hubUnlocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

describe('schemas', () => {
  it('PurchaseSchema accepts valid purchase', () => {
    const result = PurchaseSchema.safeParse({
      productId: 'mylife_hub_unlock',
      purchaseDate: '2026-06-01T00:00:00.000Z',
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it('PurchaseSchema rejects invalid purchase', () => {
    expect(PurchaseSchema.safeParse({ productId: '' }).success).toBe(false);
    expect(PurchaseSchema.safeParse({ productId: 'x', purchaseDate: 'bad' }).success).toBe(false);
  });

  it('ProductIdSchema accepts known product IDs', () => {
    expect(ProductIdSchema.safeParse('mylife_hub_unlock').success).toBe(true);
    expect(ProductIdSchema.safeParse('mylife_books_unlock').success).toBe(true);
    expect(ProductIdSchema.safeParse('mylife_annual_update').success).toBe(true);
    expect(ProductIdSchema.safeParse('mylife_storage_starter').success).toBe(true);
    expect(ProductIdSchema.safeParse('mylife_storage_power').success).toBe(true);
  });

  it('StorageTierSchema accepts valid tiers', () => {
    expect(StorageTierSchema.safeParse('free').success).toBe(true);
    expect(StorageTierSchema.safeParse('starter').success).toBe(true);
    expect(StorageTierSchema.safeParse('power').success).toBe(true);
    expect(StorageTierSchema.safeParse('ultra').success).toBe(false);
  });
});
