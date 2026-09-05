import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { CLOSET_MODULE } from '../definition';
import {
  calculateCostPerWear,
  calculateWardrobeValue,
  summarizeClosetDashboard,
  createClothingItem,
  createOutfit,
  getClosetDashboard,
  getClosetSetting,
  getClothingItemById,
  getOutfitById,
  getWearLogById,
  listClothingItems,
  listClosetTags,
  listDonationCandidates,
  listOutfits,
  listWearLogs,
  logWearEvent,
  setClosetSetting,
  updateClothingItem,
} from '..';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('closet', CLOSET_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ─── Clothing Item CRUD ───────────────────────────────────────────────────────

describe('createClothingItem', () => {
  it('creates an item with required fields only', () => {
    const item = createClothingItem(testDb.adapter, 'item-1', {
      name: 'Navy Blazer',
      category: 'outerwear',
    });

    expect(item.id).toBe('item-1');
    expect(item.name).toBe('Navy Blazer');
    expect(item.category).toBe('outerwear');
    expect(item.status).toBe('active');
    expect(item.condition).toBe('good');
    expect(item.laundryStatus).toBe('clean');
    expect(item.timesWorn).toBe(0);
    expect(item.lastWornDate).toBeNull();
    expect(item.seasons).toEqual(['all-season']);
    expect(item.tags).toEqual([]);
  });

  it('creates an item with all optional fields', () => {
    const item = createClothingItem(testDb.adapter, 'item-2', {
      name: 'White Oxford',
      category: 'tops',
      color: 'white',
      brand: 'Brooks Brothers',
      purchasePriceCents: 8500,
      purchaseDate: '2025-12-01',
      imageUri: '/photos/oxford.jpg',
      seasons: ['spring', 'fall'],
      occasions: ['work', 'date night'],
      condition: 'new',
      status: 'active',
      laundryStatus: 'clean',
      notes: 'Gift from mom',
      tags: ['formal', 'work'],
    });

    expect(item.color).toBe('white');
    expect(item.brand).toBe('Brooks Brothers');
    expect(item.purchasePriceCents).toBe(8500);
    expect(item.purchaseDate).toBe('2025-12-01');
    expect(item.imageUri).toBe('/photos/oxford.jpg');
    expect(item.seasons).toEqual(['spring', 'fall']);
    expect(item.occasions).toEqual(['work', 'date night']);
    expect(item.condition).toBe('new');
    expect(item.notes).toBe('Gift from mom');
    expect(item.tags).toEqual(['formal', 'work']);
  });

  it('trims whitespace from item name', () => {
    const item = createClothingItem(testDb.adapter, 'item-3', {
      name: '  Linen Shirt  ',
      category: 'tops',
    });
    expect(item.name).toBe('Linen Shirt');
  });

  it('normalizes tag names to lowercase', () => {
    const item = createClothingItem(testDb.adapter, 'item-4', {
      name: 'Red Dress',
      category: 'dresses',
      tags: ['FORMAL', 'Date Night', 'summer'],
    });
    expect(item.tags).toEqual(['date night', 'formal', 'summer']);
  });

  it('deduplicates tags on create', () => {
    const item = createClothingItem(testDb.adapter, 'item-5', {
      name: 'Sneakers',
      category: 'shoes',
      tags: ['casual', 'Casual', 'CASUAL'],
    });
    expect(item.tags).toEqual(['casual']);
  });
});

describe('getClothingItemById', () => {
  it('returns null for a non-existent item', () => {
    const item = getClothingItemById(testDb.adapter, 'does-not-exist');
    expect(item).toBeNull();
  });

  it('returns the item when it exists', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Cargo Pants',
      category: 'bottoms',
    });
    const item = getClothingItemById(testDb.adapter, 'item-1');
    expect(item).not.toBeNull();
    expect(item!.name).toBe('Cargo Pants');
  });
});

describe('updateClothingItem', () => {
  it('returns null when updating a non-existent item', () => {
    const result = updateClothingItem(testDb.adapter, 'ghost', { name: 'Nope' });
    expect(result).toBeNull();
  });

  it('updates a single field while preserving others', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Grey Hoodie',
      category: 'outerwear',
      brand: 'Nike',
      color: 'grey',
    });

    const updated = updateClothingItem(testDb.adapter, 'item-1', { color: 'charcoal' });
    expect(updated).not.toBeNull();
    expect(updated!.color).toBe('charcoal');
    expect(updated!.brand).toBe('Nike');
    expect(updated!.name).toBe('Grey Hoodie');
  });

  it('can set nullable fields to null', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Leather Jacket',
      category: 'outerwear',
      brand: 'AllSaints',
      notes: 'Needs conditioning',
    });

    const updated = updateClothingItem(testDb.adapter, 'item-1', { brand: null, notes: null });
    expect(updated!.brand).toBeNull();
    expect(updated!.notes).toBeNull();
  });

  it('can change status to archived', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Old T-Shirt',
      category: 'tops',
    });

    const updated = updateClothingItem(testDb.adapter, 'item-1', { status: 'archived' });
    expect(updated!.status).toBe('archived');
  });

  it('replaces tags completely when tags are provided', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Blazer',
      category: 'outerwear',
      tags: ['work', 'capsule'],
    });

    const updated = updateClothingItem(testDb.adapter, 'item-1', { tags: ['travel'] });
    expect(updated!.tags).toEqual(['travel']);
  });
});

describe('listClothingItems', () => {
  it('returns empty array when no items exist', () => {
    const items = listClothingItems(testDb.adapter);
    expect(items).toEqual([]);
  });

  it('returns items ordered by creation date descending', () => {
    createClothingItem(testDb.adapter, 'a', { name: 'First', category: 'tops' });
    createClothingItem(testDb.adapter, 'b', { name: 'Second', category: 'bottoms' });
    createClothingItem(testDb.adapter, 'c', { name: 'Third', category: 'shoes' });

    // Force distinct timestamps so ORDER BY created_at DESC is deterministic
    testDb.adapter.execute(`UPDATE cl_items SET created_at = '2024-01-01T00:00:00' WHERE id = 'a'`);
    testDb.adapter.execute(`UPDATE cl_items SET created_at = '2024-01-02T00:00:00' WHERE id = 'b'`);
    testDb.adapter.execute(`UPDATE cl_items SET created_at = '2024-01-03T00:00:00' WHERE id = 'c'`);

    const items = listClothingItems(testDb.adapter);
    expect(items).toHaveLength(3);
    // Most recent first
    expect(items[0]!.name).toBe('Third');
  });

  it('filters by category', () => {
    createClothingItem(testDb.adapter, 'a', { name: 'Tee', category: 'tops' });
    createClothingItem(testDb.adapter, 'b', { name: 'Jeans', category: 'bottoms' });
    createClothingItem(testDb.adapter, 'c', { name: 'Polo', category: 'tops' });

    const tops = listClothingItems(testDb.adapter, { category: 'tops' });
    expect(tops).toHaveLength(2);
    expect(tops.every((i) => i.category === 'tops')).toBe(true);
  });

  it('filters by status', () => {
    createClothingItem(testDb.adapter, 'a', { name: 'Active Shirt', category: 'tops' });
    createClothingItem(testDb.adapter, 'b', {
      name: 'Donated Shirt',
      category: 'tops',
      status: 'donated',
    });

    const active = listClothingItems(testDb.adapter, { status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0]!.name).toBe('Active Shirt');
  });

  it('filters by tag', () => {
    createClothingItem(testDb.adapter, 'a', {
      name: 'Work Blazer',
      category: 'outerwear',
      tags: ['work'],
    });
    createClothingItem(testDb.adapter, 'b', {
      name: 'Weekend Tee',
      category: 'tops',
      tags: ['casual'],
    });

    const workItems = listClothingItems(testDb.adapter, { tag: 'work' });
    expect(workItems).toHaveLength(1);
    expect(workItems[0]!.name).toBe('Work Blazer');
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 5; i++) {
      createClothingItem(testDb.adapter, `item-${i}`, {
        name: `Item ${i}`,
        category: 'tops',
      });
    }

    const limited = listClothingItems(testDb.adapter, { limit: 2 });
    expect(limited).toHaveLength(2);
  });
});

// ─── Tags ─────────────────────────────────────────────────────────────────────

describe('listClosetTags', () => {
  it('returns empty array when no tags exist', () => {
    expect(listClosetTags(testDb.adapter)).toEqual([]);
  });

  it('returns tags with usage counts sorted alphabetically', () => {
    createClothingItem(testDb.adapter, 'a', {
      name: 'Shirt A',
      category: 'tops',
      tags: ['work', 'capsule'],
    });
    createClothingItem(testDb.adapter, 'b', {
      name: 'Shirt B',
      category: 'tops',
      tags: ['work'],
    });

    const tags = listClosetTags(testDb.adapter);
    expect(tags).toHaveLength(2);
    expect(tags[0]!.name).toBe('capsule');
    expect(tags[0]!.usageCount).toBe(1);
    expect(tags[1]!.name).toBe('work');
    expect(tags[1]!.usageCount).toBe(2);
  });

  it('preserves tags even when items with those tags are removed from a tag', () => {
    createClothingItem(testDb.adapter, 'a', {
      name: 'Shirt',
      category: 'tops',
      tags: ['work', 'capsule'],
    });

    // Remove all tags from the item
    updateClothingItem(testDb.adapter, 'a', { tags: [] });

    // Tags still exist in the tags table but with zero usage
    const tags = listClosetTags(testDb.adapter);
    expect(tags).toHaveLength(2);
    expect(tags.every((t) => t.usageCount === 0)).toBe(true);
  });
});

// ─── Outfits ──────────────────────────────────────────────────────────────────

describe('createOutfit', () => {
  it('creates an outfit linked to items', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'White Tee', category: 'tops' });
    createClothingItem(testDb.adapter, 'item-2', { name: 'Blue Jeans', category: 'bottoms' });

    const outfit = createOutfit(testDb.adapter, 'outfit-1', {
      name: 'Weekend Uniform',
      itemIds: ['item-1', 'item-2'],
      occasion: 'casual',
      season: 'summer',
    });

    expect(outfit.id).toBe('outfit-1');
    expect(outfit.name).toBe('Weekend Uniform');
    expect(outfit.itemIds).toEqual(['item-1', 'item-2']);
    expect(outfit.occasion).toBe('casual');
    expect(outfit.season).toBe('summer');
  });

  it('deduplicates item IDs in an outfit', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'Shirt', category: 'tops' });

    const outfit = createOutfit(testDb.adapter, 'outfit-1', {
      name: 'Dupe Test',
      itemIds: ['item-1', 'item-1', 'item-1'],
    });

    expect(outfit.itemIds).toEqual(['item-1']);
  });
});

describe('getOutfitById', () => {
  it('returns null for a non-existent outfit', () => {
    expect(getOutfitById(testDb.adapter, 'no-outfit')).toBeNull();
  });

  it('retrieves an outfit with its item IDs', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'Shirt', category: 'tops' });
    createOutfit(testDb.adapter, 'outfit-1', {
      name: 'Simple',
      itemIds: ['item-1'],
    });

    const outfit = getOutfitById(testDb.adapter, 'outfit-1');
    expect(outfit).not.toBeNull();
    expect(outfit!.itemIds).toContain('item-1');
  });
});

describe('listOutfits', () => {
  it('returns empty array when no outfits exist', () => {
    expect(listOutfits(testDb.adapter)).toEqual([]);
  });

  it('lists outfits in reverse creation order', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'Shirt', category: 'tops' });
    createOutfit(testDb.adapter, 'outfit-a', { name: 'First', itemIds: ['item-1'] });
    createOutfit(testDb.adapter, 'outfit-b', { name: 'Second', itemIds: ['item-1'] });

    // Force distinct timestamps so ORDER BY created_at DESC is deterministic
    testDb.adapter.execute(`UPDATE cl_outfits SET created_at = '2024-01-01T00:00:00' WHERE id = 'outfit-a'`);
    testDb.adapter.execute(`UPDATE cl_outfits SET created_at = '2024-01-02T00:00:00' WHERE id = 'outfit-b'`);

    const outfits = listOutfits(testDb.adapter);
    expect(outfits).toHaveLength(2);
    expect(outfits[0]!.name).toBe('Second');
  });
});

// ─── Wear Logs ────────────────────────────────────────────────────────────────

describe('logWearEvent', () => {
  it('logs a wear event with individual items', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'Shirt', category: 'tops' });

    const log = logWearEvent(testDb.adapter, 'wear-1', {
      date: '2026-03-08',
      itemIds: ['item-1'],
      notes: 'Meeting day',
    });

    expect(log.id).toBe('wear-1');
    expect(log.date).toBe('2026-03-08');
    expect(log.itemIds).toContain('item-1');
    expect(log.notes).toBe('Meeting day');

    // Item wear count should be incremented
    const item = getClothingItemById(testDb.adapter, 'item-1');
    expect(item!.timesWorn).toBe(1);
    expect(item!.lastWornDate).toBe('2026-03-08');
  });

  it('logs a wear event via outfit and merges outfit item IDs', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'Shirt', category: 'tops' });
    createClothingItem(testDb.adapter, 'item-2', { name: 'Pants', category: 'bottoms' });
    createOutfit(testDb.adapter, 'outfit-1', {
      name: 'Work Outfit',
      itemIds: ['item-1', 'item-2'],
    });

    const log = logWearEvent(testDb.adapter, 'wear-1', {
      date: '2026-03-08',
      outfitId: 'outfit-1',
    });

    expect(log.outfitId).toBe('outfit-1');
    expect(log.itemIds).toContain('item-1');
    expect(log.itemIds).toContain('item-2');

    expect(getClothingItemById(testDb.adapter, 'item-1')!.timesWorn).toBe(1);
    expect(getClothingItemById(testDb.adapter, 'item-2')!.timesWorn).toBe(1);
  });

  it('merges outfit items with additional individual items without duplicates', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'Shirt', category: 'tops' });
    createClothingItem(testDb.adapter, 'item-2', { name: 'Pants', category: 'bottoms' });
    createClothingItem(testDb.adapter, 'item-3', { name: 'Watch', category: 'accessories' });
    createOutfit(testDb.adapter, 'outfit-1', {
      name: 'Base',
      itemIds: ['item-1', 'item-2'],
    });

    const log = logWearEvent(testDb.adapter, 'wear-1', {
      date: '2026-03-08',
      outfitId: 'outfit-1',
      itemIds: ['item-1', 'item-3'], // item-1 overlaps with outfit
    });

    // Should have all three unique items
    expect(log.itemIds).toHaveLength(3);
  });

  it('increments wear count across multiple wear events', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'Shirt', category: 'tops' });

    logWearEvent(testDb.adapter, 'wear-1', { date: '2026-03-01', itemIds: ['item-1'] });
    logWearEvent(testDb.adapter, 'wear-2', { date: '2026-03-05', itemIds: ['item-1'] });
    logWearEvent(testDb.adapter, 'wear-3', { date: '2026-03-08', itemIds: ['item-1'] });

    const item = getClothingItemById(testDb.adapter, 'item-1');
    expect(item!.timesWorn).toBe(3);
    expect(item!.lastWornDate).toBe('2026-03-08');
  });
});

describe('getWearLogById', () => {
  it('returns null for a non-existent wear log', () => {
    expect(getWearLogById(testDb.adapter, 'no-log')).toBeNull();
  });
});

describe('listWearLogs', () => {
  it('returns empty array when no logs exist', () => {
    expect(listWearLogs(testDb.adapter)).toEqual([]);
  });

  it('filters logs by date range', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'Shirt', category: 'tops' });

    logWearEvent(testDb.adapter, 'w1', { date: '2026-02-01', itemIds: ['item-1'] });
    logWearEvent(testDb.adapter, 'w2', { date: '2026-03-01', itemIds: ['item-1'] });
    logWearEvent(testDb.adapter, 'w3', { date: '2026-03-15', itemIds: ['item-1'] });

    const marchLogs = listWearLogs(testDb.adapter, {
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });
    expect(marchLogs).toHaveLength(2);
  });

  it('respects the limit parameter', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'Shirt', category: 'tops' });
    for (let i = 0; i < 5; i++) {
      logWearEvent(testDb.adapter, `w${i}`, { date: `2026-03-0${i + 1}`, itemIds: ['item-1'] });
    }

    const limited = listWearLogs(testDb.adapter, { limit: 3 });
    expect(limited).toHaveLength(3);
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

describe('getClosetSetting / setClosetSetting', () => {
  it('returns seeded donationThresholdDays setting', () => {
    expect(getClosetSetting(testDb.adapter, 'donationThresholdDays')).toBe('365');
  });

  it('returns null for a non-existent setting', () => {
    expect(getClosetSetting(testDb.adapter, 'nonexistent')).toBeNull();
  });

  it('creates and retrieves a new setting', () => {
    const result = setClosetSetting(testDb.adapter, 'viewMode', 'grid');
    expect(result.key).toBe('viewMode');
    expect(result.value).toBe('grid');
    expect(getClosetSetting(testDb.adapter, 'viewMode')).toBe('grid');
  });

  it('upserts an existing setting', () => {
    setClosetSetting(testDb.adapter, 'donationThresholdDays', '180');
    expect(getClosetSetting(testDb.adapter, 'donationThresholdDays')).toBe('180');
  });
});

// ─── Donation Candidates ──────────────────────────────────────────────────────

describe('listDonationCandidates', () => {
  it('returns empty array when no items exist', () => {
    expect(listDonationCandidates(testDb.adapter, '2026-03-08')).toEqual([]);
  });

  it('returns items never worn as donation candidates with default threshold', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Unworn Shirt',
      category: 'tops',
    });

    // Default threshold is 365 days. The item was just created (today),
    // but since it has never been worn (lastWornDate is NULL), it qualifies.
    const candidates = listDonationCandidates(testDb.adapter, '2026-03-08');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.name).toBe('Unworn Shirt');
  });

  it('excludes non-active items from donation candidates', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Already Donated',
      category: 'tops',
      status: 'donated',
    });

    const candidates = listDonationCandidates(testDb.adapter, '2026-03-08');
    expect(candidates).toEqual([]);
  });

  it('excludes recently worn items from donation candidates', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Worn Recently',
      category: 'tops',
    });
    logWearEvent(testDb.adapter, 'w1', { date: '2026-03-07', itemIds: ['item-1'] });

    setClosetSetting(testDb.adapter, 'donationThresholdDays', '30');
    const candidates = listDonationCandidates(testDb.adapter, '2026-03-08');
    expect(candidates).toEqual([]);
  });

  it('respects custom donation threshold', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Worn Long Ago',
      category: 'tops',
    });
    updateClothingItem(testDb.adapter, 'item-1', { lastWornDate: '2026-02-01' });

    // 30-day threshold means anything not worn after Feb 6 qualifies
    setClosetSetting(testDb.adapter, 'donationThresholdDays', '30');
    const candidates = listDonationCandidates(testDb.adapter, '2026-03-08');
    expect(candidates).toHaveLength(1);
  });
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

describe('getClosetDashboard', () => {
  it('returns zeroed dashboard when closet is empty', () => {
    const dashboard = getClosetDashboard(testDb.adapter, '2026-03-08');
    expect(dashboard.totalItems).toBe(0);
    expect(dashboard.totalOutfits).toBe(0);
    expect(dashboard.wardrobeValueCents).toBe(0);
    expect(dashboard.itemsWorn30Days).toBe(0);
    expect(dashboard.donationCandidateCount).toBe(0);
  });

  it('computes dashboard metrics for a populated closet', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Hoodie',
      category: 'outerwear',
      purchasePriceCents: 6000,
    });
    createClothingItem(testDb.adapter, 'item-2', {
      name: 'Boots',
      category: 'shoes',
      purchasePriceCents: 9000,
    });
    createOutfit(testDb.adapter, 'outfit-1', {
      name: 'Cold weather',
      itemIds: ['item-1', 'item-2'],
    });

    logWearEvent(testDb.adapter, 'wear-1', {
      date: '2026-03-05',
      itemIds: ['item-1'],
    });

    const dashboard = getClosetDashboard(testDb.adapter, '2026-03-08');
    expect(dashboard.totalItems).toBe(2);
    expect(dashboard.totalOutfits).toBe(1);
    expect(dashboard.wardrobeValueCents).toBe(15000);
    expect(dashboard.itemsWorn30Days).toBe(1);
  });

  it('counts items worn in the 30-day window', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'A', category: 'tops' });
    createClothingItem(testDb.adapter, 'item-2', { name: 'B', category: 'bottoms' });

    // Worn within 30-day window
    logWearEvent(testDb.adapter, 'w1', { date: '2026-03-01', itemIds: ['item-1'] });
    // Worn outside 30-day window
    logWearEvent(testDb.adapter, 'w2', { date: '2026-01-01', itemIds: ['item-2'] });

    const dashboard = getClosetDashboard(testDb.adapter, '2026-03-08');
    expect(dashboard.itemsWorn30Days).toBe(1);
  });
});

// ─── Engine: Analytics ────────────────────────────────────────────────────────

describe('calculateWardrobeValue', () => {
  it('returns 0 for empty items array', () => {
    expect(calculateWardrobeValue([])).toBe(0);
  });

  it('sums only active items with purchase price', () => {
    const items = [
      createClothingItem(testDb.adapter, 'a', {
        name: 'Active Jacket',
        category: 'outerwear',
        purchasePriceCents: 15000,
      }),
      createClothingItem(testDb.adapter, 'b', {
        name: 'Donated Shirt',
        category: 'tops',
        purchasePriceCents: 3000,
        status: 'donated',
      }),
      createClothingItem(testDb.adapter, 'c', {
        name: 'No-Price Pants',
        category: 'bottoms',
      }),
    ];

    expect(calculateWardrobeValue(items)).toBe(15000);
  });
});

describe('calculateCostPerWear', () => {
  it('returns null when purchase price is null', () => {
    const item = createClothingItem(testDb.adapter, 'a', {
      name: 'Cheap Shirt',
      category: 'tops',
    });
    expect(calculateCostPerWear(item)).toBeNull();
  });

  it('returns null when times worn is 0', () => {
    const item = createClothingItem(testDb.adapter, 'a', {
      name: 'New Shirt',
      category: 'tops',
      purchasePriceCents: 5000,
    });
    expect(calculateCostPerWear(item)).toBeNull();
  });

  it('calculates cost per wear correctly', () => {
    createClothingItem(testDb.adapter, 'a', {
      name: 'Well-Worn Jacket',
      category: 'outerwear',
      purchasePriceCents: 12000,
    });
    updateClothingItem(testDb.adapter, 'a', { timesWorn: 4 });
    const item = getClothingItemById(testDb.adapter, 'a')!;
    expect(calculateCostPerWear(item)).toBe(3000); // 12000 / 4 = 3000
  });

  it('rounds to nearest cent', () => {
    createClothingItem(testDb.adapter, 'a', {
      name: 'Shirt',
      category: 'tops',
      purchasePriceCents: 1000,
    });
    updateClothingItem(testDb.adapter, 'a', { timesWorn: 3 });
    const item = getClothingItemById(testDb.adapter, 'a')!;
    expect(calculateCostPerWear(item)).toBe(333); // Math.round(1000/3)
  });
});

describe('summarizeClosetDashboard', () => {
  it('returns structured summary from raw inputs', () => {
    const items = [
      createClothingItem(testDb.adapter, 'a', {
        name: 'Shirt',
        category: 'tops',
        purchasePriceCents: 5000,
      }),
      createClothingItem(testDb.adapter, 'b', {
        name: 'Pants',
        category: 'bottoms',
        purchasePriceCents: 8000,
        status: 'stored',
      }),
    ];

    const summary = summarizeClosetDashboard(items, 3, 5, 2);
    expect(summary.totalItems).toBe(1); // only active items
    expect(summary.totalOutfits).toBe(3);
    expect(summary.wardrobeValueCents).toBe(5000); // only active with price
    expect(summary.itemsWorn30Days).toBe(5);
    expect(summary.donationCandidateCount).toBe(2);
  });
});

// ─── Module Definition ────────────────────────────────────────────────────────

describe('CLOSET_MODULE definition', () => {
  it('has the correct module metadata', () => {
    expect(CLOSET_MODULE.id).toBe('closet');
    expect(CLOSET_MODULE.name).toBe('MyCloset');
    expect(CLOSET_MODULE.tablePrefix).toBe('cl_');
    expect(CLOSET_MODULE.tier).toBe('premium');
    expect(CLOSET_MODULE.storageType).toBe('sqlite');
    expect(CLOSET_MODULE.requiresAuth).toBe(false);
    expect(CLOSET_MODULE.requiresNetwork).toBe(false);
    expect(CLOSET_MODULE.accentColor).toBe('#E879A8');
  });

  it('has migrations that create all expected tables', () => {
    expect(CLOSET_MODULE.migrations).toHaveLength(3);

    // Verify tables were created by querying sqlite_master
    const tables = testDb.adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'cl_%' ORDER BY name`,
    );
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toEqual([
      'cl_capsule_items',
      'cl_capsules',
      'cl_item_tags',
      'cl_items',
      'cl_laundry_events',
      'cl_outfit_items',
      'cl_outfits',
      'cl_packing_list_items',
      'cl_packing_lists',
      'cl_settings',
      'cl_suggestion_feedback',
      'cl_tags',
      'cl_wear_log_items',
      'cl_wear_logs',
      'cl_weather_cache',
      'cl_wishlist_items',
    ]);
  });

  it('seeds the default donationThresholdDays setting', () => {
    expect(getClosetSetting(testDb.adapter, 'donationThresholdDays')).toBe('365');
  });
});
