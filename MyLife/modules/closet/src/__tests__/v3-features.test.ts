import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { CLOSET_MODULE } from '../definition';
import {
  createClothingItem,
  createOutfit,
  logWearEvent,
  listClothingItems,
  listOutfits,
  getClothingItemById,
} from '../db/crud';
import {
  createWishlistItem,
  getWishlistItemById,
  listWishlistItems,
  updateWishlistItem,
  deleteWishlistItem,
  markWishlistItemPurchased,
  getWishlistSummary,
} from '../db/wishlist';
import {
  createCapsule,
  getCapsuleById,
  listCapsules,
  setActiveCapsule,
  addCapsuleItem,
  removeCapsuleItem,
  deleteCapsule,
} from '../db/capsules';
import {
  recordSuggestionFeedback,
  listSuggestionFeedback,
} from '../db/suggestions';
import { getCPWLeaderboard, getCPWByCategory, getCPWSummary } from '../engine/cpw';
import {
  recommendForWeather,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
} from '../engine/weather';
import {
  detectCurrentSeason,
  shouldShowRotationReminder,
  getItemsToStore,
  getItemsToActivate,
  getPreviousSeason,
} from '../engine/seasonal';
import { generateOutfitSuggestions, hashOutfitItems } from '../engine/outfit-suggest';
import {
  calculateVersatilityScore,
  suggestCapsuleItems,
  analyzeCapsuleGaps,
  estimateOutfitCombinations,
} from '../engine/capsule';
import {
  normalizeColor,
  getColorDistribution,
  getColorDistributionByCategory,
  generateColorInsights,
  getColorHarmonyPairs,
} from '../engine/color';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('closet', CLOSET_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ────────────────────────────────────────────────────────────────────────────
// 1. Cost-Per-Wear Engine
// ────────────────────────────────────────────────────────────────────────────
describe('cost-per-wear engine', () => {
  it('returns empty leaderboard for empty wardrobe', () => {
    expect(getCPWLeaderboard([], 'asc')).toEqual([]);
  });

  it('excludes items without price from leaderboard', () => {
    createClothingItem(testDb.adapter, 'item-1', { name: 'No Price', category: 'tops' });
    logWearEvent(testDb.adapter, 'w1', { itemIds: ['item-1'] });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    expect(getCPWLeaderboard(items, 'asc')).toHaveLength(0);
  });

  it('ranks items by CPW ascending (best value first)', () => {
    createClothingItem(testDb.adapter, 'cheap', { name: 'Cheap Tee', category: 'tops', purchasePriceCents: 1000 });
    createClothingItem(testDb.adapter, 'pricey', { name: 'Pricey Jacket', category: 'outerwear', purchasePriceCents: 20000 });
    for (let i = 0; i < 10; i++) logWearEvent(testDb.adapter, `w-cheap-${i}`, { itemIds: ['cheap'] });
    logWearEvent(testDb.adapter, 'w-pricey', { itemIds: ['pricey'] });

    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const leaderboard = getCPWLeaderboard(items, 'asc');
    expect(leaderboard[0]!.itemId).toBe('cheap');
    expect(leaderboard[0]!.costPerWearCents).toBe(100); // 1000/10
    expect(leaderboard[1]!.itemId).toBe('pricey');
    expect(leaderboard[1]!.costPerWearCents).toBe(20000); // 20000/1
  });

  it('computes category averages', () => {
    createClothingItem(testDb.adapter, 'top1', { name: 'Top A', category: 'tops', purchasePriceCents: 2000 });
    createClothingItem(testDb.adapter, 'top2', { name: 'Top B', category: 'tops', purchasePriceCents: 4000 });
    logWearEvent(testDb.adapter, 'w1', { itemIds: ['top1'] });
    logWearEvent(testDb.adapter, 'w2', { itemIds: ['top2'] });

    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const categories = getCPWByCategory(items);
    const topsAvg = categories.find((c) => c.category === 'tops');
    expect(topsAvg).toBeDefined();
    expect(topsAvg!.averageCPWCents).toBe(3000); // (2000+4000)/2
    expect(topsAvg!.itemCount).toBe(2);
  });

  it('computes summary with median', () => {
    createClothingItem(testDb.adapter, 'a', { name: 'A', category: 'tops', purchasePriceCents: 1000 });
    createClothingItem(testDb.adapter, 'b', { name: 'B', category: 'tops', purchasePriceCents: 3000 });
    createClothingItem(testDb.adapter, 'c', { name: 'C', category: 'tops', purchasePriceCents: 5000 });
    logWearEvent(testDb.adapter, 'w1', { itemIds: ['a', 'b', 'c'] });

    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const summary = getCPWSummary(items);
    expect(summary.totalValueCents).toBe(9000);
    expect(summary.itemsWithCPW).toBe(3);
    expect(summary.medianCPWCents).toBe(3000);
  });

  it('excludes non-active items', () => {
    createClothingItem(testDb.adapter, 'donated', { name: 'Donated', category: 'tops', purchasePriceCents: 5000, status: 'donated' });
    logWearEvent(testDb.adapter, 'w1', { itemIds: ['donated'] });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    expect(getCPWLeaderboard(items, 'asc')).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Weather Engine
// ────────────────────────────────────────────────────────────────────────────
describe('weather recommendation engine', () => {
  it('recommends outerwear for cold weather', () => {
    createClothingItem(testDb.adapter, 'coat', { name: 'Winter Coat', category: 'outerwear', seasons: ['winter'] });
    createClothingItem(testDb.adapter, 'tank', { name: 'Tank Top', category: 'tops', seasons: ['summer'] });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const recs = recommendForWeather(items, { temperatureF: 25, condition: 'snow', humidity: 80, windSpeedMph: 10 });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.category).toBe('outerwear');
  });

  it('recommends light items for hot weather', () => {
    createClothingItem(testDb.adapter, 'coat', { name: 'Winter Coat', category: 'outerwear' });
    createClothingItem(testDb.adapter, 'tee', { name: 'Light Tee', category: 'tops' });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const recs = recommendForWeather(items, { temperatureF: 90, condition: 'sunny', humidity: 40, windSpeedMph: 5 });
    expect(recs[0]!.category).toBe('tops');
  });

  it('prioritizes clean items over dirty', () => {
    createClothingItem(testDb.adapter, 'clean-tee', { name: 'Clean Tee', category: 'tops' });
    createClothingItem(testDb.adapter, 'dirty-tee', { name: 'Dirty Tee', category: 'tops', laundryStatus: 'dirty' });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const recs = recommendForWeather(items, { temperatureF: 70, condition: 'clear', humidity: null, windSpeedMph: null });
    expect(recs).toHaveLength(1); // dirty excluded
    expect(recs[0]!.itemId).toBe('clean-tee');
  });

  it('handles empty wardrobe', () => {
    expect(recommendForWeather([], { temperatureF: 70, condition: 'clear', humidity: null, windSpeedMph: null })).toEqual([]);
  });

  it('converts temperature units correctly', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(fahrenheitToCelsius(212)).toBe(100);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Seasonal Rotation Engine
// ────────────────────────────────────────────────────────────────────────────
describe('seasonal rotation engine', () => {
  it('detects spring for March in northern hemisphere', () => {
    expect(detectCurrentSeason(new Date('2026-03-15T00:00:00Z'), 'northern')).toBe('spring');
  });

  it('detects fall for March in southern hemisphere', () => {
    expect(detectCurrentSeason(new Date('2026-03-15T00:00:00Z'), 'southern')).toBe('fall');
  });

  it('detects winter for December northern', () => {
    expect(detectCurrentSeason(new Date('2026-12-01T00:00:00Z'), 'northern')).toBe('winter');
  });

  it('detects summer for December southern', () => {
    expect(detectCurrentSeason(new Date('2026-12-01T00:00:00Z'), 'southern')).toBe('summer');
  });

  it('shows reminder when season changed and not rotated', () => {
    expect(shouldShowRotationReminder(new Date('2026-06-01'), null, 14, 'northern')).toBe(true);
  });

  it('hides reminder when already rotated this season', () => {
    expect(shouldShowRotationReminder(new Date('2026-06-15'), '2026-06-01', 14, 'northern')).toBe(false);
  });

  it('shows reminder when rotated in previous season', () => {
    expect(shouldShowRotationReminder(new Date('2026-06-15'), '2026-04-01', 14, 'northern')).toBe(true);
  });

  it('identifies items to store (outgoing season only)', () => {
    createClothingItem(testDb.adapter, 'winter-coat', { name: 'Coat', category: 'outerwear', seasons: ['winter'] });
    createClothingItem(testDb.adapter, 'all-jeans', { name: 'Jeans', category: 'bottoms', seasons: ['all-season'] });
    createClothingItem(testDb.adapter, 'spring-tee', { name: 'Spring Tee', category: 'tops', seasons: ['spring'] });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const toStore = getItemsToStore(items, 'winter', 'spring');
    expect(toStore.map((i) => i.id)).toEqual(['winter-coat']);
  });

  it('excludes all-season items from store suggestions', () => {
    createClothingItem(testDb.adapter, 'jeans', { name: 'Jeans', category: 'bottoms', seasons: ['all-season'] });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    expect(getItemsToStore(items, 'winter', 'spring')).toHaveLength(0);
  });

  it('identifies stored items to activate for incoming season', () => {
    createClothingItem(testDb.adapter, 'stored-summer', { name: 'Tank', category: 'tops', seasons: ['summer'], status: 'stored' });
    createClothingItem(testDb.adapter, 'active-top', { name: 'Top', category: 'tops', seasons: ['summer'] });
    // listClothingItems may include stored items since we don't filter by status here
    // Build array from individual lookups to avoid duplicates
    const allItems = [
      getClothingItemById(testDb.adapter, 'stored-summer')!,
      getClothingItemById(testDb.adapter, 'active-top')!,
    ];
    const toActivate = getItemsToActivate(allItems, 'summer');
    expect(toActivate.map((i) => i.id)).toEqual(['stored-summer']);
  });

  it('gets previous season correctly', () => {
    expect(getPreviousSeason('spring')).toBe('winter');
    expect(getPreviousSeason('summer')).toBe('spring');
    expect(getPreviousSeason('fall')).toBe('summer');
    expect(getPreviousSeason('winter')).toBe('fall');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Shopping Wishlist CRUD
// ────────────────────────────────────────────────────────────────────────────
describe('shopping wishlist', () => {
  it('creates a wishlist item with defaults', () => {
    const item = createWishlistItem(testDb.adapter, 'wish-1', {
      name: 'Black Jacket',
      category: 'outerwear',
    });
    expect(item.name).toBe('Black Jacket');
    expect(item.priority).toBe('medium');
    expect(item.isPurchased).toBe(false);
  });

  it('creates with all fields', () => {
    const item = createWishlistItem(testDb.adapter, 'wish-2', {
      name: 'Leather Boots',
      category: 'shoes',
      brand: 'AllSaints',
      color: 'black',
      estimatedPriceCents: 45000,
      url: 'https://example.com',
      notes: 'Wait for sale',
      priority: 'high',
    });
    expect(item.brand).toBe('AllSaints');
    expect(item.estimatedPriceCents).toBe(45000);
    expect(item.priority).toBe('high');
  });

  it('lists sorted by priority then date', () => {
    createWishlistItem(testDb.adapter, 'low', { name: 'Low', category: 'tops', priority: 'low' });
    createWishlistItem(testDb.adapter, 'high', { name: 'High', category: 'tops', priority: 'high' });
    createWishlistItem(testDb.adapter, 'med', { name: 'Med', category: 'tops', priority: 'medium' });
    const items = listWishlistItems(testDb.adapter);
    expect(items.map((i) => i.priority)).toEqual(['high', 'medium', 'low']);
  });

  it('filters by purchased status', () => {
    createWishlistItem(testDb.adapter, 'a', { name: 'A', category: 'tops' });
    createWishlistItem(testDb.adapter, 'b', { name: 'B', category: 'tops' });
    markWishlistItemPurchased(testDb.adapter, 'b');
    expect(listWishlistItems(testDb.adapter, { isPurchased: false })).toHaveLength(1);
    expect(listWishlistItems(testDb.adapter, { isPurchased: true })).toHaveLength(1);
  });

  it('updates partial fields', () => {
    createWishlistItem(testDb.adapter, 'wish', { name: 'Orig', category: 'tops', priority: 'low' });
    const updated = updateWishlistItem(testDb.adapter, 'wish', { priority: 'high' });
    expect(updated?.priority).toBe('high');
    expect(updated?.name).toBe('Orig');
  });

  it('deletes a wishlist item', () => {
    createWishlistItem(testDb.adapter, 'wish', { name: 'Del', category: 'tops' });
    deleteWishlistItem(testDb.adapter, 'wish');
    expect(getWishlistItemById(testDb.adapter, 'wish')).toBeNull();
  });

  it('marks purchased with date', () => {
    createWishlistItem(testDb.adapter, 'wish', { name: 'Buy', category: 'tops' });
    const purchased = markWishlistItemPurchased(testDb.adapter, 'wish', '2026-03-22');
    expect(purchased?.isPurchased).toBe(true);
    expect(purchased?.purchasedDate).toBe('2026-03-22');
  });

  it('computes summary excluding purchased items', () => {
    createWishlistItem(testDb.adapter, 'a', { name: 'A', category: 'tops', estimatedPriceCents: 5000, priority: 'high' });
    createWishlistItem(testDb.adapter, 'b', { name: 'B', category: 'tops', estimatedPriceCents: 3000, priority: 'medium' });
    createWishlistItem(testDb.adapter, 'c', { name: 'C', category: 'tops', priority: 'low' });
    markWishlistItemPurchased(testDb.adapter, 'b');
    const summary = getWishlistSummary(testDb.adapter);
    expect(summary.totalItems).toBe(2);
    expect(summary.totalEstimatedCents).toBe(5000); // only unpurchased
    expect(summary.countByPriority.high).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Capsule Wardrobe CRUD
// ────────────────────────────────────────────────────────────────────────────
describe('capsule wardrobe', () => {
  it('creates a capsule with items', () => {
    createClothingItem(testDb.adapter, 'top1', { name: 'Top', category: 'tops' });
    createClothingItem(testDb.adapter, 'bot1', { name: 'Bottom', category: 'bottoms' });
    const capsule = createCapsule(testDb.adapter, 'cap-1', {
      name: 'Fall Essentials',
      season: 'fall',
      targetCount: 33,
      itemIds: ['top1', 'bot1'],
      essentialItemIds: ['top1'],
    });
    expect(capsule.name).toBe('Fall Essentials');
    expect(capsule.itemIds).toEqual(['top1', 'bot1']);
    expect(capsule.essentialItemIds).toEqual(['top1']);
    expect(capsule.isActive).toBe(true);
  });

  it('deactivates previous capsule when creating new one', () => {
    createCapsule(testDb.adapter, 'cap-1', { name: 'First', season: 'spring' });
    createCapsule(testDb.adapter, 'cap-2', { name: 'Second', season: 'fall' });
    const first = getCapsuleById(testDb.adapter, 'cap-1');
    const second = getCapsuleById(testDb.adapter, 'cap-2');
    expect(first?.isActive).toBe(false);
    expect(second?.isActive).toBe(true);
  });

  it('sets active capsule', () => {
    createCapsule(testDb.adapter, 'cap-1', { name: 'A', season: 'spring' });
    createCapsule(testDb.adapter, 'cap-2', { name: 'B', season: 'fall' });
    setActiveCapsule(testDb.adapter, 'cap-1');
    expect(getCapsuleById(testDb.adapter, 'cap-1')?.isActive).toBe(true);
    expect(getCapsuleById(testDb.adapter, 'cap-2')?.isActive).toBe(false);
  });

  it('adds and removes capsule items', () => {
    createClothingItem(testDb.adapter, 'shoe1', { name: 'Shoe', category: 'shoes' });
    createCapsule(testDb.adapter, 'cap-1', { name: 'Test', season: 'spring' });
    addCapsuleItem(testDb.adapter, 'cap-1', 'shoe1', true);
    let capsule = getCapsuleById(testDb.adapter, 'cap-1')!;
    expect(capsule.itemIds).toContain('shoe1');
    expect(capsule.essentialItemIds).toContain('shoe1');

    removeCapsuleItem(testDb.adapter, 'cap-1', 'shoe1');
    capsule = getCapsuleById(testDb.adapter, 'cap-1')!;
    expect(capsule.itemIds).not.toContain('shoe1');
  });

  it('lists capsules with active first', () => {
    createCapsule(testDb.adapter, 'old', { name: 'Old', season: 'winter' });
    createCapsule(testDb.adapter, 'new', { name: 'New', season: 'spring' });
    const capsules = listCapsules(testDb.adapter);
    expect(capsules[0]!.isActive).toBe(true);
    expect(capsules[0]!.id).toBe('new');
  });

  it('deletes capsule without affecting items', () => {
    createClothingItem(testDb.adapter, 'top1', { name: 'Top', category: 'tops' });
    createCapsule(testDb.adapter, 'cap-1', { name: 'Del', season: 'spring', itemIds: ['top1'] });
    deleteCapsule(testDb.adapter, 'cap-1');
    expect(getCapsuleById(testDb.adapter, 'cap-1')).toBeNull();
    expect(getClothingItemById(testDb.adapter, 'top1')).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Capsule Engine
// ────────────────────────────────────────────────────────────────────────────
describe('capsule engine', () => {
  it('scores all-season items higher than single-season', () => {
    createClothingItem(testDb.adapter, 'all', { name: 'All', category: 'tops', seasons: ['all-season'] });
    createClothingItem(testDb.adapter, 'winter', { name: 'Winter', category: 'tops', seasons: ['winter'] });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const scoreAll = calculateVersatilityScore(items.find((i) => i.id === 'all')!, []);
    const scoreWinter = calculateVersatilityScore(items.find((i) => i.id === 'winter')!, []);
    expect(scoreAll.score).toBeGreaterThan(scoreWinter.score);
  });

  it('items in outfits score higher', () => {
    createClothingItem(testDb.adapter, 'used', { name: 'Used', category: 'tops' });
    createClothingItem(testDb.adapter, 'unused', { name: 'Unused', category: 'tops' });
    createOutfit(testDb.adapter, 'outfit-1', { name: 'Outfit', itemIds: ['used'] });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const outfits = listOutfits(testDb.adapter);
    const usedScore = calculateVersatilityScore(items.find((i) => i.id === 'used')!, outfits);
    const unusedScore = calculateVersatilityScore(items.find((i) => i.id === 'unused')!, outfits);
    expect(usedScore.score).toBeGreaterThan(unusedScore.score);
  });

  it('suggests balanced capsule items', () => {
    for (let i = 0; i < 5; i++) createClothingItem(testDb.adapter, `top-${i}`, { name: `Top ${i}`, category: 'tops' });
    for (let i = 0; i < 3; i++) createClothingItem(testDb.adapter, `bot-${i}`, { name: `Bottom ${i}`, category: 'bottoms' });
    for (let i = 0; i < 2; i++) createClothingItem(testDb.adapter, `shoe-${i}`, { name: `Shoe ${i}`, category: 'shoes' });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const suggestions = suggestCapsuleItems(items, [], 8);
    expect(suggestions.length).toBe(8);
    const categories = suggestions.map((s) => s.category);
    expect(categories).toContain('tops');
    expect(categories).toContain('bottoms');
  });

  it('analyzes gaps in capsule', () => {
    const gaps = analyzeCapsuleGaps(['tops', 'tops', 'tops'], 33);
    expect(gaps.length).toBeGreaterThan(0);
    const bottomsGap = gaps.find((g) => g.category === 'bottoms');
    expect(bottomsGap).toBeDefined();
    expect(bottomsGap!.deficit).toBeGreaterThan(0);
  });

  it('estimates outfit combinations', () => {
    const combos = estimateOutfitCombinations(['tops', 'tops', 'tops', 'bottoms', 'bottoms', 'shoes']);
    expect(combos).toBe(3 * 2 * 1 * 1); // 3 tops * 2 bottoms * 1 shoe * 1 outerwear(default 1)
  });

  it('returns 0 combinations with no tops', () => {
    expect(estimateOutfitCombinations(['bottoms', 'shoes'])).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. AI Outfit Suggestions
// ────────────────────────────────────────────────────────────────────────────
describe('outfit suggestion engine', () => {
  it('generates suggestions for a wardrobe with tops and bottoms', () => {
    createClothingItem(testDb.adapter, 'top1', { name: 'Tee', category: 'tops' });
    createClothingItem(testDb.adapter, 'top2', { name: 'Polo', category: 'tops' });
    createClothingItem(testDb.adapter, 'bot1', { name: 'Jeans', category: 'bottoms' });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const suggestions = generateOutfitSuggestions(items, [], { limit: 3 });
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.itemIds.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('returns 0 for empty wardrobe', () => {
    expect(generateOutfitSuggestions([], [])).toEqual([]);
  });

  it('excludes dirty items', () => {
    createClothingItem(testDb.adapter, 'clean', { name: 'Clean', category: 'tops' });
    createClothingItem(testDb.adapter, 'dirty', { name: 'Dirty', category: 'bottoms', laundryStatus: 'dirty' });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const suggestions = generateOutfitSuggestions(items, []);
    expect(suggestions).toEqual([]);
  });

  it('respects excluded hashes', () => {
    createClothingItem(testDb.adapter, 'top1', { name: 'Tee', category: 'tops' });
    createClothingItem(testDb.adapter, 'bot1', { name: 'Jeans', category: 'bottoms' });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const hash = hashOutfitItems(['top1', 'bot1']);
    const suggestions = generateOutfitSuggestions(items, [], { excludeHashes: [hash] });
    expect(suggestions).toEqual([]);
  });

  it('produces deterministic hashes regardless of order', () => {
    expect(hashOutfitItems(['a', 'b', 'c'])).toBe(hashOutfitItems(['c', 'a', 'b']));
  });

  it('incorporates feedback into scoring', () => {
    createClothingItem(testDb.adapter, 'top1', { name: 'Tee A', category: 'tops' });
    createClothingItem(testDb.adapter, 'top2', { name: 'Tee B', category: 'tops' });
    createClothingItem(testDb.adapter, 'bot1', { name: 'Jeans', category: 'bottoms' });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const hash1 = hashOutfitItems(['top1', 'bot1']);
    const feedback = [recordSuggestionFeedback(testDb.adapter, hash1, ['top1', 'bot1'], 'down')];
    const suggestions = generateOutfitSuggestions(items, feedback, { limit: 2 });
    if (suggestions.length >= 2) {
      const downvoted = suggestions.find((s) => s.hash === hash1);
      const other = suggestions.find((s) => s.hash !== hash1);
      if (downvoted && other) {
        expect(other.score).toBeGreaterThanOrEqual(downvoted.score);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. Suggestion Feedback CRUD
// ────────────────────────────────────────────────────────────────────────────
describe('suggestion feedback CRUD', () => {
  it('records and retrieves feedback', () => {
    const fb = recordSuggestionFeedback(testDb.adapter, 'hash1', ['a', 'b'], 'up', 'casual');
    expect(fb.feedback).toBe('up');
    expect(fb.itemIds).toEqual(['a', 'b']);
    const all = listSuggestionFeedback(testDb.adapter);
    expect(all).toHaveLength(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. Color Palette Analysis
// ────────────────────────────────────────────────────────────────────────────
describe('color palette analysis', () => {
  it('normalizes common color names', () => {
    expect(normalizeColor('black')).toBe('black');
    expect(normalizeColor('Navy')).toBe('blue');
    expect(normalizeColor('  Burgundy  ')).toBe('red');
    expect(normalizeColor('cream')).toBe('white');
    expect(normalizeColor('olive')).toBe('green');
    expect(normalizeColor('plum')).toBe('purple');
    expect(normalizeColor('rust')).toBe('orange');
    expect(normalizeColor('tan')).toBe('brown');
    expect(normalizeColor('floral')).toBe('multi');
  });

  it('returns unknown for unrecognized colors', () => {
    expect(normalizeColor('chartreuse')).toBe('unknown');
    expect(normalizeColor(null)).toBe('unknown');
    expect(normalizeColor('')).toBe('unknown');
  });

  it('computes color distribution from wardrobe', () => {
    createClothingItem(testDb.adapter, 'a', { name: 'A', category: 'tops', color: 'black' });
    createClothingItem(testDb.adapter, 'b', { name: 'B', category: 'tops', color: 'black' });
    createClothingItem(testDb.adapter, 'c', { name: 'C', category: 'tops', color: 'navy' });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const dist = getColorDistribution(items);
    expect(dist.find((e) => e.color === 'black')?.count).toBe(2);
    expect(dist.find((e) => e.color === 'blue')?.count).toBe(1);
  });

  it('excludes non-active items', () => {
    createClothingItem(testDb.adapter, 'sold', { name: 'Sold', category: 'tops', color: 'red', status: 'sold' });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    expect(getColorDistribution(items)).toEqual([]);
  });

  it('returns distribution by clothing category', () => {
    createClothingItem(testDb.adapter, 'top1', { name: 'Top', category: 'tops', color: 'black' });
    createClothingItem(testDb.adapter, 'shoe1', { name: 'Shoe', category: 'shoes', color: 'white' });
    const items = listClothingItems(testDb.adapter, { limit: 100 });
    const byCat = getColorDistributionByCategory(items);
    expect(byCat['tops']).toBeDefined();
    expect(byCat['shoes']).toBeDefined();
  });

  it('generates insights about neutral percentage', () => {
    const dist = [
      { color: 'black' as const, count: 7, percentage: 70 },
      { color: 'blue' as const, count: 3, percentage: 30 },
    ];
    const insights = generateColorInsights(dist);
    expect(insights.some((i) => i.includes('neutral'))).toBe(true);
  });

  it('suggests missing colors', () => {
    const dist = [
      { color: 'black' as const, count: 5, percentage: 50 },
      { color: 'white' as const, count: 5, percentage: 50 },
    ];
    const insights = generateColorInsights(dist);
    expect(insights.some((i) => i.includes('Consider adding'))).toBe(true);
  });

  it('finds complementary color harmony pairs', () => {
    const dist = [
      { color: 'blue' as const, count: 3, percentage: 50 },
      { color: 'orange' as const, count: 3, percentage: 50 },
    ];
    const pairs = getColorHarmonyPairs(dist);
    expect(pairs).toContainEqual(['blue', 'orange']);
  });

  it('returns empty array for no harmony pairs', () => {
    const dist = [{ color: 'black' as const, count: 10, percentage: 100 }];
    expect(getColorHarmonyPairs(dist)).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// V3 Migration Verification
// ────────────────────────────────────────────────────────────────────────────
describe('V3 migration', () => {
  it('creates all V3 tables', () => {
    const tables = testDb.adapter.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    );
    const names = tables.map((t) => t.name);
    expect(names).toContain('cl_wishlist_items');
    expect(names).toContain('cl_capsules');
    expect(names).toContain('cl_capsule_items');
    expect(names).toContain('cl_suggestion_feedback');
    expect(names).toContain('cl_weather_cache');
  });

  it('seeds V3 settings', () => {
    const settings = testDb.adapter.query<{ key: string; value: string }>(
      `SELECT key, value FROM cl_settings WHERE key IN ('seasonalReminderEnabled', 'hemisphere', 'temperatureUnit')`,
    );
    expect(settings.find((s) => s.key === 'seasonalReminderEnabled')?.value).toBe('1');
    expect(settings.find((s) => s.key === 'hemisphere')?.value).toBe('northern');
    expect(settings.find((s) => s.key === 'temperatureUnit')?.value).toBe('F');
  });

  it('module definition has schema version 3 with 3 migrations', () => {
    expect(CLOSET_MODULE.schemaVersion).toBe(3);
    expect(CLOSET_MODULE.migrations).toHaveLength(3);
  });
});
