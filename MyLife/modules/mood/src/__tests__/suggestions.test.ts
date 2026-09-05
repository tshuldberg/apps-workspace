import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { MOOD_MODULE } from '../definition';
import {
  createSuggestionHistory,
  updateSuggestionAction,
  getSuggestionHistory,
  getRecentSuggestionKeys,
  getSuggestionsByKey,
} from '../db/suggestions';
import {
  generateSuggestions,
  SUGGESTION_CATALOG,
  getSuggestionsByCategory,
  type SuggestionInput,
} from '../engine/suggestions';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('mood', MOOD_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Suggestion Engine', () => {
  describe('SUGGESTION_CATALOG', () => {
    it('has at least 25 items', () => {
      expect(SUGGESTION_CATALOG.length).toBeGreaterThanOrEqual(25);
    });

    it('covers all 5 categories', () => {
      const categories = new Set(SUGGESTION_CATALOG.map((s) => s.category));
      expect(categories.has('physical')).toBe(true);
      expect(categories.has('social')).toBe(true);
      expect(categories.has('creative')).toBe(true);
      expect(categories.has('relaxation')).toBe(true);
      expect(categories.has('mindfulness')).toBe(true);
    });

    it('each item has unique key', () => {
      const keys = SUGGESTION_CATALOG.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('generateSuggestions', () => {
    const baseInput: SuggestionInput = {
      currentScore: 4,
      activityCorrelations: [],
      recentSuggestionKeys: [],
      enabledModules: [],
      entryCount: 10,
    };

    it('returns 2-3 suggestions for low score (<=5)', () => {
      const result = generateSuggestions(baseInput);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('returns 0-1 suggestions for high score (>5)', () => {
      const result = generateSuggestions({ ...baseInput, currentScore: 7 });
      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('includes data-driven suggestions when correlation >= 0.2', () => {
      const result = generateSuggestions({
        ...baseInput,
        activityCorrelations: [
          { activityId: 'a1', activityName: 'Exercise', entryCount: 10, averageScore: 8, pearsonR: 0.45 },
        ],
      });
      expect(result.some((s) => s.source === 'data_driven')).toBe(true);
    });

    it('excludes data-driven suggestions when < 7 entries', () => {
      const result = generateSuggestions({
        ...baseInput,
        entryCount: 5,
        activityCorrelations: [
          { activityId: 'a1', activityName: 'Exercise', entryCount: 10, averageScore: 8, pearsonR: 0.45 },
        ],
      });
      expect(result.every((s) => s.source !== 'data_driven')).toBe(true);
    });

    it('includes cross-module suggestions for enabled modules', () => {
      const result = generateSuggestions({
        ...baseInput,
        enabledModules: ['workouts', 'journal'],
      });
      expect(result.some((s) => s.source === 'cross_module')).toBe(true);
    });

    it('deduplicates by recent suggestion keys', () => {
      const result1 = generateSuggestions(baseInput);
      const keys = result1.map((r) => r.key);
      const result2 = generateSuggestions({ ...baseInput, recentSuggestionKeys: keys });
      const overlap = result2.filter((r) => keys.includes(r.key));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('getSuggestionsByCategory', () => {
    it('returns only items from the requested category', () => {
      const physical = getSuggestionsByCategory('physical');
      expect(physical.length).toBeGreaterThan(0);
      expect(physical.every((s) => s.category === 'physical')).toBe(true);
    });
  });
});

describe('Suggestion CRUD', () => {
  it('creates suggestion history', () => {
    const record = createSuggestionHistory(testDb.adapter, 'sh-1', {
      suggestionKey: 'physical-walk',
      category: 'physical',
      source: 'catalog',
    });
    expect(record.id).toBe('sh-1');
    expect(record.suggestionKey).toBe('physical-walk');
    expect(record.action).toBeNull();
  });

  it('updates suggestion action', () => {
    createSuggestionHistory(testDb.adapter, 'sh-1', {
      suggestionKey: 'physical-walk',
      category: 'physical',
      source: 'catalog',
    });
    updateSuggestionAction(testDb.adapter, 'sh-1', 'completed');
    const history = getSuggestionHistory(testDb.adapter);
    expect(history[0].action).toBe('completed');
    expect(history[0].actedAt).not.toBeNull();
  });

  it('lists suggestion history', () => {
    createSuggestionHistory(testDb.adapter, 'sh-1', {
      suggestionKey: 'physical-walk', category: 'physical', source: 'catalog',
    });
    createSuggestionHistory(testDb.adapter, 'sh-2', {
      suggestionKey: 'social-call-friend', category: 'social', source: 'catalog',
    });
    expect(getSuggestionHistory(testDb.adapter)).toHaveLength(2);
  });

  it('gets recent suggestion keys', () => {
    createSuggestionHistory(testDb.adapter, 'sh-1', {
      suggestionKey: 'physical-walk', category: 'physical', source: 'catalog',
    });
    const keys = getRecentSuggestionKeys(testDb.adapter, '2020-01-01');
    expect(keys).toContain('physical-walk');
  });

  it('gets suggestions by key', () => {
    createSuggestionHistory(testDb.adapter, 'sh-1', {
      suggestionKey: 'physical-walk', category: 'physical', source: 'catalog',
    });
    createSuggestionHistory(testDb.adapter, 'sh-2', {
      suggestionKey: 'physical-walk', category: 'physical', source: 'catalog',
    });
    expect(getSuggestionsByKey(testDb.adapter, 'physical-walk')).toHaveLength(2);
  });
});
