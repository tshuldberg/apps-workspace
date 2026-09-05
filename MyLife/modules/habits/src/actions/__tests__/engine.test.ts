import { describe, it, expect } from 'vitest';
import {
  calculateActionProgress,
  resolveActionStates,
  reorderItems,
  getNextIncomplete,
  shouldAutoCompleteHabit,
} from '../engine';

describe('actions/engine', () => {
  const items = [
    { id: 'a1', label: 'Brush teeth', sortOrder: 0 },
    { id: 'a2', label: 'Stretch', sortOrder: 1 },
    { id: 'a3', label: 'Journal', sortOrder: 2 },
    { id: 'a4', label: 'Meditate', sortOrder: 3 },
  ];

  describe('calculateActionProgress', () => {
    it('returns 0% for no completions', () => {
      const result = calculateActionProgress(4, 0);
      expect(result.percentage).toBe(0);
      expect(result.allDone).toBe(false);
    });

    it('returns 50% for half completed', () => {
      const result = calculateActionProgress(4, 2);
      expect(result.percentage).toBe(50);
      expect(result.allDone).toBe(false);
    });

    it('returns 100% when all done', () => {
      const result = calculateActionProgress(4, 4);
      expect(result.percentage).toBe(100);
      expect(result.allDone).toBe(true);
    });

    it('handles zero total items', () => {
      const result = calculateActionProgress(0, 0);
      expect(result.percentage).toBe(100);
      expect(result.allDone).toBe(true);
    });
  });

  describe('resolveActionStates', () => {
    it('marks completed items', () => {
      const completed = new Set(['a1', 'a3']);
      const states = resolveActionStates(items, completed);
      expect(states[0].isCompleted).toBe(true);
      expect(states[1].isCompleted).toBe(false);
      expect(states[2].isCompleted).toBe(true);
      expect(states[3].isCompleted).toBe(false);
    });

    it('sorts by sortOrder', () => {
      const unordered = [
        { id: 'a3', label: 'Journal', sortOrder: 2 },
        { id: 'a1', label: 'Brush teeth', sortOrder: 0 },
      ];
      const states = resolveActionStates(unordered, new Set());
      expect(states[0].id).toBe('a1');
      expect(states[1].id).toBe('a3');
    });
  });

  describe('reorderItems', () => {
    it('assigns sequential sort orders', () => {
      const result = reorderItems(['a3', 'a1', 'a2']);
      expect(result).toEqual([
        { id: 'a3', sortOrder: 0 },
        { id: 'a1', sortOrder: 1 },
        { id: 'a2', sortOrder: 2 },
      ]);
    });
  });

  describe('getNextIncomplete', () => {
    it('returns the first incomplete item', () => {
      const states = resolveActionStates(items, new Set(['a1']));
      const next = getNextIncomplete(states);
      expect(next?.id).toBe('a2');
    });

    it('returns null when all complete', () => {
      const states = resolveActionStates(items, new Set(['a1', 'a2', 'a3', 'a4']));
      expect(getNextIncomplete(states)).toBeNull();
    });

    it('returns first item when none complete', () => {
      const states = resolveActionStates(items, new Set());
      expect(getNextIncomplete(states)?.id).toBe('a1');
    });
  });

  describe('shouldAutoCompleteHabit', () => {
    it('returns true when all items completed', () => {
      expect(shouldAutoCompleteHabit(4, 4)).toBe(true);
    });

    it('returns false when items remain', () => {
      expect(shouldAutoCompleteHabit(4, 3)).toBe(false);
    });

    it('returns false for zero items', () => {
      expect(shouldAutoCompleteHabit(0, 0)).toBe(false);
    });
  });
});
