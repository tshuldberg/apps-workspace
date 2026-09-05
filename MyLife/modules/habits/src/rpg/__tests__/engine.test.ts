import { describe, it, expect } from 'vitest';
import {
  calculateXPForAction,
  xpForLevel,
  getLevelForXP,
  getXPProgress,
  calculateStreakBonus,
  getUnlockableForLevel,
  getUnlockedItems,
  UNLOCKABLE_ITEMS,
  buildLevelHistory,
} from '../engine';

describe('rpg engine', () => {
  describe('calculateXPForAction', () => {
    it('awards 10 XP for standard completion', () => {
      expect(calculateXPForAction('completion')).toBe(10);
    });

    it('awards 15 XP for timed completion', () => {
      expect(calculateXPForAction('timed_completion')).toBe(15);
    });

    it('awards 12 XP for measurable completion', () => {
      expect(calculateXPForAction('measurable_completion')).toBe(12);
    });

    it('awards 20 XP for craving resist', () => {
      expect(calculateXPForAction('craving_resist')).toBe(20);
    });

    it('awards 5 XP for daily pledge', () => {
      expect(calculateXPForAction('daily_pledge')).toBe(5);
    });

    it('awards 25 XP for all complete', () => {
      expect(calculateXPForAction('all_complete')).toBe(25);
    });

    it('awards streak-based XP capped at 50', () => {
      expect(calculateXPForAction('streak_bonus', { streakLength: 15 })).toBe(15);
      expect(calculateXPForAction('streak_bonus', { streakLength: 100 })).toBe(50);
    });

    it('awards milestone XP by threshold', () => {
      expect(calculateXPForAction('milestone', { milestoneThreshold: 7 })).toBe(50);
      expect(calculateXPForAction('milestone', { milestoneThreshold: 365 })).toBe(2000);
    });
  });

  describe('xpForLevel', () => {
    it('returns 0 for level 1', () => {
      expect(xpForLevel(1)).toBe(0);
    });

    it('returns 120 for level 2', () => {
      // formula: floor(100 * 1.2^(2-1)) = floor(120) = 120
      expect(xpForLevel(2)).toBe(120);
    });

    it('follows exponential curve for level 5', () => {
      expect(xpForLevel(5)).toBe(Math.floor(100 * Math.pow(1.2, 4)));
    });
  });

  describe('getLevelForXP', () => {
    it('returns level 1 for 0 XP', () => {
      expect(getLevelForXP(0)).toBe(1);
    });

    it('returns level 2 for 120 XP', () => {
      // Level 2 requires 120 XP (formula: floor(100 * 1.2^1))
      expect(getLevelForXP(120)).toBe(2);
    });

    it('returns level 1 for 119 XP', () => {
      expect(getLevelForXP(119)).toBe(1);
    });

    it('returns level 5 for cumulative XP', () => {
      // cumulative: 120 + 144 + 172 + 207 = 643
      const cumXP = xpForLevel(2) + xpForLevel(3) + xpForLevel(4) + xpForLevel(5);
      expect(getLevelForXP(cumXP)).toBe(5);
    });
  });

  describe('getXPProgress', () => {
    it('returns progress within current level', () => {
      // Level 2 starts at 120 XP. At 150 XP, currentXP = 150 - 120 = 30
      const progress = getXPProgress(150);
      expect(progress.level).toBe(2);
      expect(progress.currentXP).toBe(30);
      expect(progress.neededXP).toBe(xpForLevel(3));
    });
  });

  describe('calculateStreakBonus', () => {
    it('returns streak length as XP', () => {
      expect(calculateStreakBonus(15)).toBe(15);
    });

    it('caps at 50', () => {
      expect(calculateStreakBonus(100)).toBe(50);
    });
  });

  describe('getUnlockableForLevel', () => {
    it('returns item for level 3', () => {
      const item = getUnlockableForLevel(3);
      expect(item?.name).toBe('Green Hat');
    });

    it('returns Habit Master for level 10', () => {
      const item = getUnlockableForLevel(10);
      expect(item?.name).toBe('Habit Master');
    });

    it('returns null for level without unlock', () => {
      expect(getUnlockableForLevel(99)).toBeNull();
    });
  });

  describe('getUnlockedItems', () => {
    it('returns all items up to given level', () => {
      const items = getUnlockedItems(5);
      expect(items.length).toBe(UNLOCKABLE_ITEMS.filter(i => i.level <= 5).length);
    });
  });

  describe('buildLevelHistory', () => {
    it('creates level-up entries when cumulative XP crosses thresholds', () => {
      const history = buildLevelHistory([
        {
          id: 'tx-1',
          amount: 60,
          source: 'completion',
          habitId: 'habit-1',
          earnedAt: '2026-04-01T08:00:00Z',
          createdAt: '2026-04-01T08:00:00Z',
        },
        {
          id: 'tx-2',
          amount: 70,
          source: 'completion',
          habitId: 'habit-1',
          earnedAt: '2026-04-02T08:00:00Z',
          createdAt: '2026-04-02T08:00:00Z',
        },
      ]);

      expect(history).toHaveLength(1);
      expect(history[0].level).toBe(2);
      expect(history[0].earnedAt).toBe('2026-04-02T08:00:00Z');
    });

    it('handles multi-level jumps in one transaction', () => {
      const history = buildLevelHistory([
        {
          id: 'tx-1',
          amount: 500,
          source: 'milestone',
          habitId: null,
          earnedAt: '2026-04-03T08:00:00Z',
          createdAt: '2026-04-03T08:00:00Z',
        },
      ]);

      expect(history[0].level).toBeGreaterThan(history[history.length - 1].level);
      expect(history.some((entry) => entry.level >= 3)).toBe(true);
    });
  });
});
