import { describe, it, expect } from 'vitest';
import {
  checkThreshold,
  getAutoTrackProgress,
  isHealthKitAvailable,
} from '../bridge';
import { HEALTHKIT_DATA_SOURCES, getDataSourceById } from '../data-sources';

describe('HealthKit Bridge', () => {
  describe('checkThreshold', () => {
    it('gte: 10000 >= 10000 returns true', () => {
      expect(checkThreshold(10000, 10000, 'gte')).toBe(true);
    });

    it('gte: 9999 >= 10000 returns false', () => {
      expect(checkThreshold(9999, 10000, 'gte')).toBe(false);
    });

    it('lte: 65 <= 70 returns true', () => {
      expect(checkThreshold(65, 70, 'lte')).toBe(true);
    });

    it('lte: 75 <= 70 returns false', () => {
      expect(checkThreshold(75, 70, 'lte')).toBe(false);
    });

    it('eq: exact match', () => {
      expect(checkThreshold(100, 100, 'eq')).toBe(true);
      expect(checkThreshold(99, 100, 'eq')).toBe(false);
    });

    it('gt: strictly greater', () => {
      expect(checkThreshold(101, 100, 'gt')).toBe(true);
      expect(checkThreshold(100, 100, 'gt')).toBe(false);
    });

    it('lt: strictly less', () => {
      expect(checkThreshold(99, 100, 'lt')).toBe(true);
      expect(checkThreshold(100, 100, 'lt')).toBe(false);
    });
  });

  describe('getAutoTrackProgress', () => {
    it('calculates progress for step count', () => {
      const result = getAutoTrackProgress(7500, 10000, 'gte');
      expect(result.current).toBe(7500);
      expect(result.target).toBe(10000);
      expect(result.percentage).toBe(75);
      expect(result.isComplete).toBe(false);
    });

    it('caps at 100% when exceeded', () => {
      const result = getAutoTrackProgress(12000, 10000, 'gte');
      expect(result.percentage).toBe(100);
      expect(result.isComplete).toBe(true);
    });

    it('shows complete for lte comparison when value is below target', () => {
      const result = getAutoTrackProgress(65, 70, 'lte');
      expect(result.isComplete).toBe(true);
      expect(result.percentage).toBe(100);
    });
  });

  describe('isHealthKitAvailable', () => {
    it('returns false in module code (non-iOS)', () => {
      expect(isHealthKitAvailable()).toBe(false);
    });
  });

  describe('Data Sources', () => {
    it('has 10 supported sources', () => {
      expect(HEALTHKIT_DATA_SOURCES).toHaveLength(10);
    });

    it('all sources have valid defaults', () => {
      for (const source of HEALTHKIT_DATA_SOURCES) {
        expect(source.id).toBeTruthy();
        expect(source.label).toBeTruthy();
        expect(source.healthKitIdentifier).toBeTruthy();
        expect(source.defaultThreshold).toBeGreaterThan(0);
        expect(source.unit).toBeTruthy();
        expect(['gte', 'lte', 'eq', 'gt', 'lt']).toContain(source.defaultComparison);
      }
    });

    it('finds source by ID', () => {
      const steps = getDataSourceById('steps');
      expect(steps).toBeDefined();
      expect(steps!.healthKitIdentifier).toBe('stepCount');
    });
  });
});
