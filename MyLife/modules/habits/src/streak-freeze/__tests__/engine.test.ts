import { describe, it, expect } from 'vitest';
import {
  canFreeze,
  remainingFreezes,
  calculateStreakWithFreezes,
  shouldSuggestFreeze,
  MAX_FREEZES_PER_MONTH,
} from '../engine';

describe('streak-freeze/engine', () => {
  describe('canFreeze', () => {
    it('allows freeze when under monthly limit', () => {
      expect(canFreeze(['2026-03-01'], '2026-03-15')).toBe(true);
    });

    it('rejects freeze when monthly limit reached', () => {
      expect(canFreeze(['2026-03-01', '2026-03-10'], '2026-03-15')).toBe(false);
    });

    it('allows freeze in a different month', () => {
      expect(canFreeze(['2026-02-01', '2026-02-10'], '2026-03-15')).toBe(true);
    });

    it('allows freeze with no existing freezes', () => {
      expect(canFreeze([], '2026-03-15')).toBe(true);
    });
  });

  describe('remainingFreezes', () => {
    it('returns max when no freezes used', () => {
      expect(remainingFreezes([], '2026-03')).toBe(MAX_FREEZES_PER_MONTH);
    });

    it('returns correct remaining count', () => {
      expect(remainingFreezes(['2026-03-01'], '2026-03')).toBe(1);
    });

    it('returns 0 when all used', () => {
      expect(remainingFreezes(['2026-03-01', '2026-03-10'], '2026-03')).toBe(0);
    });

    it('ignores freezes from other months', () => {
      expect(remainingFreezes(['2026-02-01', '2026-02-10'], '2026-03')).toBe(2);
    });
  });

  describe('calculateStreakWithFreezes', () => {
    it('returns 0 for no completions and no freezes', () => {
      const result = calculateStreakWithFreezes([], new Set(), '2026-03-15');
      expect(result.currentStreak).toBe(0);
      expect(result.frozenDaysUsed).toBe(0);
    });

    it('counts consecutive completions', () => {
      const completions = ['2026-03-15', '2026-03-14', '2026-03-13'];
      const result = calculateStreakWithFreezes(completions, new Set(), '2026-03-15');
      expect(result.currentStreak).toBe(3);
    });

    it('bridges gaps with frozen dates', () => {
      // Completed 13, 14, frozen 15, completed 16
      const completions = ['2026-03-16', '2026-03-14', '2026-03-13'];
      const frozen = new Set(['2026-03-15']);
      const result = calculateStreakWithFreezes(completions, frozen, '2026-03-16');
      // Streak: 16(completed) + 15(frozen) + 14(completed) + 13(completed) = 3 completions + 1 frozen
      expect(result.currentStreak).toBe(3);
      expect(result.frozenDaysUsed).toBe(1);
    });

    it('breaks streak on gap without freeze', () => {
      const completions = ['2026-03-16', '2026-03-14'];
      const result = calculateStreakWithFreezes(completions, new Set(), '2026-03-16');
      // Gap on 15 with no freeze, streak is just today
      expect(result.currentStreak).toBe(1);
    });
  });

  describe('shouldSuggestFreeze', () => {
    it('suggests freeze when no habits completed and past typical time', () => {
      expect(shouldSuggestFreeze(0, 5, 22, 20)).toBe(true);
    });

    it('does not suggest when habits are completed', () => {
      expect(shouldSuggestFreeze(1, 5, 22, 20)).toBe(false);
    });

    it('does not suggest before typical completion time', () => {
      expect(shouldSuggestFreeze(0, 5, 19, 20)).toBe(false);
    });

    it('does not suggest when no active habits', () => {
      expect(shouldSuggestFreeze(0, 0, 22, 20)).toBe(false);
    });
  });
});
