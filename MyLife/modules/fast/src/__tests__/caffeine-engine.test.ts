import { describe, it, expect } from 'vitest';
import {
  scaleCaffeine,
  calculateDailyCaffeine,
  remainingFromDose,
  calculateRemainingCaffeine,
  calculateClearByTime,
  getCaffeineStatus,
  hasLateCaffeine,
  buildCaffeineSummary,
} from '../engines/caffeine-engine';
import type { CaffeineSnapshot } from '../types';

// Helper to create a snapshot at a specific time
function makeSnap(mg: number, loggedAt: string): CaffeineSnapshot {
  return {
    beverageTypeId: 'coffee',
    beverageName: 'Coffee',
    caffeineMg: mg,
    volumeOz: 8,
    loggedAt,
  };
}

describe('Caffeine Engine', () => {
  // ── scaleCaffeine ──

  describe('scaleCaffeine', () => {
    it('scales correctly for double volume', () => {
      expect(scaleCaffeine(95, 16, 8)).toBe(190);
    });

    it('returns base amount for default volume', () => {
      expect(scaleCaffeine(95, 8, 8)).toBe(95);
    });

    it('returns 0 for zero default_oz', () => {
      expect(scaleCaffeine(95, 8, 0)).toBe(0);
    });

    it('scales for espresso', () => {
      // 63mg per 2oz shot, ordering a 4oz double
      expect(scaleCaffeine(63, 4, 2)).toBe(126);
    });
  });

  // ── calculateDailyCaffeine ──

  describe('calculateDailyCaffeine', () => {
    it('sums 2 coffees correctly', () => {
      const drinks = [makeSnap(95, '2026-03-22T08:00:00Z'), makeSnap(95, '2026-03-22T10:00:00Z')];
      expect(calculateDailyCaffeine(drinks)).toBe(190);
    });

    it('returns 0 for empty array', () => {
      expect(calculateDailyCaffeine([])).toBe(0);
    });

    it('sums mixed drinks', () => {
      const drinks = [
        makeSnap(95, '2026-03-22T08:00:00Z'),  // coffee
        makeSnap(28, '2026-03-22T09:00:00Z'),  // green tea
      ];
      expect(calculateDailyCaffeine(drinks)).toBe(123);
    });
  });

  // ── remainingFromDose ──

  describe('remainingFromDose', () => {
    const fiveHoursMs = 5 * 60 * 60 * 1000;

    it('returns full dose at time of intake', () => {
      const now = Date.now();
      expect(remainingFromDose(200, now, now)).toBe(200);
    });

    it('returns ~100mg after one half-life', () => {
      const loggedAt = Date.now();
      const now = loggedAt + fiveHoursMs;
      const remaining = remainingFromDose(200, loggedAt, now);
      expect(remaining).toBeCloseTo(100, 0);
    });

    it('returns ~50mg after two half-lives', () => {
      const loggedAt = Date.now();
      const now = loggedAt + 2 * fiveHoursMs;
      const remaining = remainingFromDose(200, loggedAt, now);
      expect(remaining).toBeCloseTo(50, 0);
    });

    it('returns full dose if now is before logged time', () => {
      const loggedAt = Date.now();
      expect(remainingFromDose(200, loggedAt, loggedAt - 1000)).toBe(200);
    });
  });

  // ── calculateRemainingCaffeine ──

  describe('calculateRemainingCaffeine', () => {
    it('sums remaining from multiple drinks', () => {
      const fiveHoursLater = new Date('2026-03-22T13:00:00Z');
      const drinks = [
        makeSnap(200, '2026-03-22T08:00:00Z'),
        makeSnap(100, '2026-03-22T13:00:00Z'),
      ];
      // At 13:00: 200mg is 5h old (~100mg), 100mg is fresh (100mg) = ~200mg
      const remaining = calculateRemainingCaffeine(drinks, fiveHoursLater);
      expect(remaining).toBeCloseTo(200, 0);
    });
  });

  // ── calculateClearByTime ──

  describe('calculateClearByTime', () => {
    it('returns null for no drinks', () => {
      expect(calculateClearByTime([])).toBeNull();
    });

    it('returns null when already below threshold', () => {
      // 10mg drink long ago
      const drinks = [makeSnap(10, '2020-01-01T08:00:00Z')];
      expect(calculateClearByTime(drinks, new Date('2026-03-22T08:00:00Z'))).toBeNull();
    });

    it('returns a future time for significant caffeine', () => {
      const now = new Date('2026-03-22T08:00:00Z');
      const drinks = [makeSnap(200, '2026-03-22T08:00:00Z')];
      const clearBy = calculateClearByTime(drinks, now);
      expect(clearBy).not.toBeNull();
      // 200 * 0.5^(t/5h) < 25 => t > 15h => clear by ~23:00
      const clearDate = new Date(clearBy!);
      expect(clearDate.getTime()).toBeGreaterThan(now.getTime() + 14 * 60 * 60 * 1000);
    });
  });

  // ── getCaffeineStatus ──

  describe('getCaffeineStatus', () => {
    it('returns "empty" for 0mg', () => {
      expect(getCaffeineStatus(0, 400, false)).toBe('empty');
    });

    it('returns "normal" for moderate intake', () => {
      expect(getCaffeineStatus(190, 400, false)).toBe('normal');
    });

    it('returns "high" at or above daily limit', () => {
      expect(getCaffeineStatus(400, 400, false)).toBe('high');
    });

    it('returns "late" when late drink exists', () => {
      expect(getCaffeineStatus(100, 400, true)).toBe('late');
    });

    it('returns "critical" at 1000mg+', () => {
      expect(getCaffeineStatus(1000, 400, false)).toBe('critical');
    });

    it('critical overrides late', () => {
      expect(getCaffeineStatus(1200, 400, true)).toBe('critical');
    });
  });

  // ── hasLateCaffeine ──

  describe('hasLateCaffeine', () => {
    it('returns false for empty array', () => {
      expect(hasLateCaffeine([], '14:00')).toBe(false);
    });

    it('returns true for drink after cutoff', () => {
      const ref = new Date('2026-03-22T12:00:00');
      const drinks = [makeSnap(95, '2026-03-22T16:00:00')];
      expect(hasLateCaffeine(drinks, '14:00', ref)).toBe(true);
    });

    it('returns false for drink before cutoff', () => {
      const ref = new Date('2026-03-22T12:00:00');
      const drinks = [makeSnap(95, '2026-03-22T08:00:00')];
      expect(hasLateCaffeine(drinks, '14:00', ref)).toBe(false);
    });
  });

  // ── buildCaffeineSummary ──

  describe('buildCaffeineSummary', () => {
    it('builds complete summary', () => {
      const now = new Date('2026-03-22T10:00:00Z');
      const drinks = [
        makeSnap(95, '2026-03-22T08:00:00Z'),
        makeSnap(95, '2026-03-22T10:00:00Z'),
      ];
      const summary = buildCaffeineSummary(drinks, 400, '14:00', now);
      expect(summary.totalMg).toBe(190);
      expect(summary.status).toBe('normal');
      expect(summary.drinks).toHaveLength(2);
      expect(summary.remainingMg).toBeGreaterThan(0);
      expect(summary.clearByTime).not.toBeNull();
    });

    it('returns empty status with no drinks', () => {
      const summary = buildCaffeineSummary([], 400, '14:00');
      expect(summary.totalMg).toBe(0);
      expect(summary.status).toBe('empty');
      expect(summary.clearByTime).toBeNull();
    });
  });
});
