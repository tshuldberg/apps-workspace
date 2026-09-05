import { describe, it, expect } from 'vitest';
import {
  calculateDailyHydration,
  hydrationToGlasses,
  meetsHydrationTarget,
  computeHydration,
} from '../engines/hydration';
import type { BeverageLog } from '../types';

function makeLog(hydrationOz: number): BeverageLog {
  return {
    id: `log-${Math.random()}`,
    date: '2026-03-22',
    beverageTypeId: 'water',
    volumeOz: 8,
    hydrationOz,
    loggedAt: new Date().toISOString(),
  };
}

describe('Hydration Engine', () => {
  describe('calculateDailyHydration', () => {
    it('sums positive hydration', () => {
      const logs = [makeLog(8), makeLog(8), makeLog(6.4)];
      expect(calculateDailyHydration(logs)).toBeCloseTo(22.4, 1);
    });

    it('clamps negative total to 0', () => {
      const logs = [makeLog(-10)];
      expect(calculateDailyHydration(logs)).toBe(0);
    });

    it('returns 0 for empty logs', () => {
      expect(calculateDailyHydration([])).toBe(0);
    });

    it('handles mixed positive and negative', () => {
      const logs = [makeLog(8), makeLog(-6)]; // 8 - 6 = 2
      expect(calculateDailyHydration(logs)).toBeCloseTo(2, 1);
    });
  });

  describe('hydrationToGlasses', () => {
    it('converts 8oz to 1 glass', () => {
      expect(hydrationToGlasses(8)).toBe(1);
    });

    it('converts 30.4oz to 3.8 glasses', () => {
      expect(hydrationToGlasses(30.4)).toBeCloseTo(3.8, 1);
    });
  });

  describe('meetsHydrationTarget', () => {
    it('returns true when target met', () => {
      expect(meetsHydrationTarget(64, 8)).toBe(true); // 64oz = 8 glasses
    });

    it('returns false when below target', () => {
      expect(meetsHydrationTarget(24, 8)).toBe(false); // 24oz = 3 glasses
    });
  });

  describe('computeHydration', () => {
    it('water: 8oz * 1.0 = 8oz', () => {
      expect(computeHydration(8, 1.0)).toBe(8);
    });

    it('coffee: 8oz * 0.8 = 6.4oz', () => {
      expect(computeHydration(8, 0.8)).toBeCloseTo(6.4, 1);
    });

    it('alcohol: 12oz * -0.5 = -6oz', () => {
      expect(computeHydration(12, -0.5)).toBe(-6);
    });

    it('sports drink: 12oz * 1.05 = 12.6oz', () => {
      expect(computeHydration(12, 1.05)).toBeCloseTo(12.6, 1);
    });

    it('juice: 8oz * 0.95 = 7.6oz', () => {
      expect(computeHydration(8, 0.95)).toBeCloseTo(7.6, 1);
    });
  });
});
