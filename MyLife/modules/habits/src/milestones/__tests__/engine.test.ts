import { describe, it, expect } from 'vitest';
import {
  detectNewMilestones,
  getNextMilestone,
  generateStandardMilestones,
  getMilestoneLabel,
} from '../engine';
import type { Milestone } from '../../types';

function makeMilestone(
  type: 'streak' | 'total_completions' | 'sobriety_days' | 'sobriety_money',
  threshold: number,
  achievedAt: string | null = null,
): Milestone {
  const { label, emoji } = getMilestoneLabel(type, threshold);
  return {
    id: `m-${type}-${threshold}`,
    habitId: 'h1',
    milestoneType: type,
    threshold,
    label,
    emoji,
    achievedAt,
    dismissed: false,
    createdAt: '2026-03-01T00:00:00.000Z',
  };
}

describe('Milestone Engine', () => {
  describe('detectNewMilestones', () => {
    it('returns 7-day milestone when streak = 7 and not yet achieved', () => {
      const milestones = [
        makeMilestone('streak', 3, '2026-03-05T00:00:00.000Z'), // already achieved
        makeMilestone('streak', 7),
        makeMilestone('streak', 14),
      ];
      const result = detectNewMilestones(milestones, { streak: 7 });
      expect(result).toHaveLength(1);
      expect(result[0].threshold).toBe(7);
    });

    it('returns empty when 7-day already achieved', () => {
      const milestones = [
        makeMilestone('streak', 7, '2026-03-10T00:00:00.000Z'),
      ];
      const result = detectNewMilestones(milestones, { streak: 7 });
      expect(result).toHaveLength(0);
    });

    it('returns only 30-day when 7/14/21 already achieved', () => {
      const milestones = [
        makeMilestone('streak', 7, '2026-03-01'),
        makeMilestone('streak', 14, '2026-03-08'),
        makeMilestone('streak', 21, '2026-03-15'),
        makeMilestone('streak', 30),
      ];
      const result = detectNewMilestones(milestones, { streak: 30 });
      expect(result).toHaveLength(1);
      expect(result[0].threshold).toBe(30);
    });

    it('detects completion milestones', () => {
      const milestones = [makeMilestone('total_completions', 100)];
      const result = detectNewMilestones(milestones, { totalCompletions: 100 });
      expect(result).toHaveLength(1);
    });

    it('detects sobriety day milestones', () => {
      const milestones = [makeMilestone('sobriety_days', 365)];
      const result = detectNewMilestones(milestones, { sobrietyDays: 365 });
      expect(result).toHaveLength(1);
    });

    it('detects money saved milestones', () => {
      const milestones = [makeMilestone('sobriety_money', 100000)]; // $1000
      const result = detectNewMilestones(milestones, { moneySavedCents: 150000 });
      expect(result).toHaveLength(1);
    });
  });

  describe('getNextMilestone', () => {
    it('returns next milestone with progress', () => {
      const milestones = [
        makeMilestone('streak', 3, '2026-03-03'),
        makeMilestone('streak', 7),
        makeMilestone('streak', 14),
      ];
      const result = getNextMilestone(milestones, 5, 'streak');
      expect(result).not.toBeNull();
      expect(result!.milestone.threshold).toBe(7);
      expect(result!.percentage).toBe(71);
    });

    it('returns null when all achieved', () => {
      const milestones = [
        makeMilestone('streak', 7, '2026-03-10'),
      ];
      const result = getNextMilestone(milestones, 10, 'streak');
      expect(result).toBeNull();
    });
  });

  describe('generateStandardMilestones', () => {
    it('creates streak + completion milestones for standard habit', () => {
      const milestones = generateStandardMilestones('standard', false, 0);
      const types = new Set(milestones.map((m) => m.type));
      expect(types.has('streak')).toBe(true);
      expect(types.has('total_completions')).toBe(true);
      expect(types.has('sobriety_days')).toBe(false);
    });

    it('creates sobriety + money milestones for negative habit with profile', () => {
      const milestones = generateStandardMilestones('negative', true, 1500);
      const types = new Set(milestones.map((m) => m.type));
      expect(types.has('streak')).toBe(true);
      expect(types.has('sobriety_days')).toBe(true);
      expect(types.has('sobriety_money')).toBe(true);
      expect(types.has('total_completions')).toBe(false); // negative habits don't get completion milestones
    });
  });
});
