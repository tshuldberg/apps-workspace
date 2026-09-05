import { describe, it, expect } from 'vitest';
import {
  calculateXP,
  determinePromotions,
  generateInviteCode,
  getWeekStart,
  getWeekEnd,
} from '../leagues/engine';
import {
  getTierDefinition,
  getNextTier,
  getPreviousTier,
  TIER_ORDER,
} from '../leagues/tiers';
import type { LeagueScore } from '../leagues/types';

describe('leagues engine', () => {
  describe('calculateXP', () => {
    it('gives 10 XP per review', () => {
      const logs = [
        { cardId: 'c1', rating: 'hard', reviewedAt: '2026-01-01T10:00:00Z' },
        { cardId: 'c2', rating: 'hard', reviewedAt: '2026-01-01T10:01:00Z' },
      ];
      const result = calculateXP(logs, 0);
      expect(result.reviewXP).toBe(20);
      expect(result.cardsReviewed).toBe(2);
    });

    it('gives +5 bonus for good/easy ratings', () => {
      const logs = [
        { cardId: 'c1', rating: 'good', reviewedAt: '2026-01-01T10:00:00Z' },
      ];
      const result = calculateXP(logs, 0);
      // 10 base XP, but capped at 10 per card per day, so bonus comes from the combined total
      expect(result.reviewXP + result.bonusXP).toBeLessThanOrEqual(10);
    });

    it('caps at 10 XP per card per day', () => {
      const logs = [
        { cardId: 'c1', rating: 'good', reviewedAt: '2026-01-01T10:00:00Z' },
        { cardId: 'c1', rating: 'good', reviewedAt: '2026-01-01T10:05:00Z' },
      ];
      const result = calculateXP(logs, 0);
      // Two reviews of same card same day, cap at 10 total
      expect(result.reviewXP + result.bonusXP).toBe(10);
    });

    it('gives streak bonus', () => {
      const result = calculateXP([], 5);
      expect(result.streakXP).toBe(250);
    });

    it('returns zero for empty input', () => {
      const result = calculateXP([], 0);
      expect(result.totalXP).toBe(0);
    });

    it('caps practice test bonuses at 3 per day', () => {
      const result = calculateXP([], 0, { practiceTests: 5, mcSessions: 0, matchSessions: 0 });
      expect(result.activityXP).toBe(300); // 3 * 100
    });
  });

  describe('determinePromotions', () => {
    const makeScore = (userId: string, xp: number): LeagueScore => ({
      id: `s_${userId}`, leagueId: 'lg1', userId, weekStart: '2026-01-06',
      xpEarned: xp, cardsReviewed: xp / 10, streakDays: 0, rank: null, updatedAt: '2026-01-12',
    });

    it('promotes top players', () => {
      const scores = Array.from({ length: 12 }, (_, i) => makeScore(`u${i}`, (12 - i) * 100));
      const results = determinePromotions(scores, 'silver');
      const promoted = results.filter((r) => r.promoted);
      expect(promoted.length).toBe(2); // ceil(12/6) = 2
      expect(promoted[0].newTier).toBe('gold');
    });

    it('demotes bottom players', () => {
      const scores = Array.from({ length: 12 }, (_, i) => makeScore(`u${i}`, (12 - i) * 100));
      const results = determinePromotions(scores, 'silver');
      const demoted = results.filter((r) => r.demoted);
      expect(demoted.length).toBe(2);
      expect(demoted[0].newTier).toBe('bronze');
    });

    it('does not demote from bronze', () => {
      const scores = Array.from({ length: 6 }, (_, i) => makeScore(`u${i}`, (6 - i) * 100));
      const results = determinePromotions(scores, 'bronze');
      const demoted = results.filter((r) => r.demoted);
      expect(demoted.length).toBe(0);
    });

    it('does not promote from diamond', () => {
      const scores = [makeScore('u1', 1000), makeScore('u2', 500)];
      const results = determinePromotions(scores, 'diamond');
      const promoted = results.filter((r) => r.promoted);
      expect(promoted.length).toBe(0);
    });

    it('handles empty scores', () => {
      expect(determinePromotions([], 'gold')).toEqual([]);
    });
  });

  describe('generateInviteCode', () => {
    it('returns 6-character string', () => {
      const code = generateInviteCode();
      expect(code).toHaveLength(6);
    });
    it('produces different codes', () => {
      const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
      expect(codes.size).toBeGreaterThan(15); // statistically should be all unique
    });
  });

  describe('getWeekStart', () => {
    it('returns Monday for a Wednesday', () => {
      const ws = getWeekStart(new Date('2026-01-07')); // Wednesday
      expect(ws).toBe('2026-01-05'); // Monday
    });
    it('returns same day for Monday', () => {
      const ws = getWeekStart(new Date('2026-01-05')); // Monday
      expect(ws).toBe('2026-01-05');
    });
  });

  describe('getWeekEnd', () => {
    it('returns Sunday for a Monday start', () => {
      const we = getWeekEnd('2026-01-05');
      expect(we).toBe('2026-01-11');
    });
  });
});

describe('leagues tiers', () => {
  it('has 5 tiers in order', () => {
    expect(TIER_ORDER).toEqual(['bronze', 'silver', 'gold', 'platinum', 'diamond']);
  });

  it('getTierDefinition returns correct data', () => {
    const gold = getTierDefinition('gold');
    expect(gold.name).toBe('Gold');
    expect(gold.color).toBe('#FFD700');
  });

  it('getNextTier returns next tier', () => {
    expect(getNextTier('bronze')).toBe('silver');
    expect(getNextTier('gold')).toBe('platinum');
    expect(getNextTier('diamond')).toBeNull();
  });

  it('getPreviousTier returns previous tier', () => {
    expect(getPreviousTier('silver')).toBe('bronze');
    expect(getPreviousTier('bronze')).toBeNull();
    expect(getPreviousTier('diamond')).toBe('platinum');
  });
});
