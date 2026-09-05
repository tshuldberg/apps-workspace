import { describe, it, expect } from 'vitest';
import {
  resolveStack,
  getNextInStack,
  getParallelHabits,
  validateNoCircularDependency,
} from '../engine';

describe('stacking/engine', () => {
  const links = [
    { parentHabitId: 'anchor', childHabitId: 'stretch', linkType: 'before' as const, sortOrder: 0 },
    { parentHabitId: 'anchor', childHabitId: 'journal', linkType: 'after' as const, sortOrder: 0 },
    { parentHabitId: 'anchor', childHabitId: 'meditate', linkType: 'after' as const, sortOrder: 1 },
    { parentHabitId: 'anchor', childHabitId: 'water', linkType: 'with' as const, sortOrder: 0 },
  ];

  describe('resolveStack', () => {
    it('orders before -> anchor -> with -> after', () => {
      const stack = resolveStack(links, 'anchor');
      expect(stack.chain.map(n => n.habitId)).toEqual([
        'stretch', 'anchor', 'water', 'journal', 'meditate',
      ]);
    });

    it('returns only anchor when no links exist', () => {
      const stack = resolveStack([], 'solo');
      expect(stack.chain).toHaveLength(1);
      expect(stack.chain[0].habitId).toBe('solo');
    });
  });

  describe('getNextInStack', () => {
    it('returns the next sequential habit after completion', () => {
      const stack = resolveStack(links, 'anchor');
      // After completing stretch (before), next should be anchor
      expect(getNextInStack(stack, 'stretch')).toBe('anchor');
    });

    it('skips parallel (with) habits', () => {
      const stack = resolveStack(links, 'anchor');
      // After completing anchor, water is 'with' so skip to journal
      expect(getNextInStack(stack, 'anchor')).toBe('journal');
    });

    it('returns null for the last habit', () => {
      const stack = resolveStack(links, 'anchor');
      expect(getNextInStack(stack, 'meditate')).toBeNull();
    });

    it('returns null for unknown habit', () => {
      const stack = resolveStack(links, 'anchor');
      expect(getNextInStack(stack, 'unknown')).toBeNull();
    });
  });

  describe('getParallelHabits', () => {
    it('returns with-linked habits', () => {
      const stack = resolveStack(links, 'anchor');
      expect(getParallelHabits(stack, 'anchor')).toEqual(['water']);
    });

    it('returns empty for habits without parallel links', () => {
      const stack = resolveStack(links, 'anchor');
      expect(getParallelHabits(stack, 'stretch')).toEqual([]);
    });
  });

  describe('validateNoCircularDependency', () => {
    it('allows valid links', () => {
      const existing = [{ parentHabitId: 'a', childHabitId: 'b' }];
      expect(validateNoCircularDependency(existing, 'b', 'c')).toBe(true);
    });

    it('rejects self-links', () => {
      expect(validateNoCircularDependency([], 'a', 'a')).toBe(false);
    });

    it('rejects circular dependencies', () => {
      const existing = [
        { parentHabitId: 'a', childHabitId: 'b' },
        { parentHabitId: 'b', childHabitId: 'c' },
      ];
      // Adding c -> a would create a cycle: a -> b -> c -> a
      expect(validateNoCircularDependency(existing, 'c', 'a')).toBe(false);
    });

    it('allows non-circular chain extensions', () => {
      const existing = [
        { parentHabitId: 'a', childHabitId: 'b' },
        { parentHabitId: 'b', childHabitId: 'c' },
      ];
      // Adding c -> d is fine
      expect(validateNoCircularDependency(existing, 'c', 'd')).toBe(true);
    });
  });
});
