import { describe, expect, it } from 'vitest';
import { calculateNextOccurrence, generateOccurrences, shouldGenerateMore } from '../engines/recurrence';
import type { RecurrenceConfig } from '../engines/recurrence';

const weekly: RecurrenceConfig = { frequency: 'weekly', intervalCount: 1, dayOfWeek: null, dayOfMonth: null, endType: 'never', endAfterCount: null, endByDate: null };
const biweekly: RecurrenceConfig = { ...weekly, frequency: 'biweekly' };
const monthly: RecurrenceConfig = { ...weekly, frequency: 'monthly' };

describe('recurrence engine', () => {
  describe('calculateNextOccurrence', () => {
    it('weekly from Monday returns next Monday', () => {
      // 2026-06-15 is a Monday
      const next = calculateNextOccurrence('2026-06-15T19:00:00.000Z', weekly);
      expect(new Date(next).getUTCDate()).toBe(22);
    });

    it('biweekly from Jan 1 returns Jan 15', () => {
      const next = calculateNextOccurrence('2026-01-01T12:00:00.000Z', biweekly);
      expect(new Date(next).getUTCDate()).toBe(15);
    });

    it('monthly from Jan 31 returns Feb 28', () => {
      const config = { ...monthly, dayOfMonth: 31 };
      const next = calculateNextOccurrence('2026-01-31T12:00:00.000Z', config);
      const d = new Date(next);
      expect(d.getMonth()).toBe(1); // February
      expect(d.getDate()).toBe(28);
    });

    it('monthly from Jan 15 returns Feb 15', () => {
      const config = { ...monthly, dayOfMonth: 15 };
      const next = calculateNextOccurrence('2026-01-15T12:00:00.000Z', config);
      const d = new Date(next);
      expect(d.getMonth()).toBe(1);
      expect(d.getDate()).toBe(15);
    });

    it('custom every 3 weeks works', () => {
      const config: RecurrenceConfig = { ...weekly, frequency: 'custom', intervalCount: 3 };
      const next = calculateNextOccurrence('2026-06-01T12:00:00.000Z', config);
      const d = new Date(next);
      expect(d.getUTCDate()).toBe(22); // 1 + 21 = 22
    });

    it('daily frequency advances by 1 day', () => {
      const config: RecurrenceConfig = { ...weekly, frequency: 'daily', intervalCount: 1 };
      const next = calculateNextOccurrence('2026-06-01T12:00:00.000Z', config);
      expect(new Date(next).getUTCDate()).toBe(2);
    });
  });

  describe('generateOccurrences', () => {
    it('generates exactly 4 upcoming dates', () => {
      const dates = generateOccurrences('2026-06-01T12:00:00.000Z', weekly, 4);
      expect(dates).toHaveLength(4);
    });

    it('respects after_count end condition', () => {
      const config: RecurrenceConfig = { ...weekly, endType: 'after_count', endAfterCount: 3 };
      const dates = generateOccurrences('2026-06-01T12:00:00.000Z', config, 10);
      expect(dates).toHaveLength(3);
    });

    it('respects by_date end condition', () => {
      const config: RecurrenceConfig = { ...weekly, endType: 'by_date', endByDate: '2026-06-20T23:59:59.000Z' };
      const dates = generateOccurrences('2026-06-01T12:00:00.000Z', config, 10);
      for (const d of dates) {
        expect(new Date(d) <= new Date('2026-06-20T23:59:59.000Z')).toBe(true);
      }
    });

    it('returns empty array when end condition already met', () => {
      const config: RecurrenceConfig = { ...weekly, endType: 'after_count', endAfterCount: 2 };
      const dates = generateOccurrences('2026-06-01T12:00:00.000Z', config, 4, 2);
      expect(dates).toHaveLength(0);
    });
  });

  describe('shouldGenerateMore', () => {
    it('returns true when < 4 upcoming', () => {
      expect(shouldGenerateMore(2)).toBe(true);
    });

    it('returns false when >= 4 upcoming', () => {
      expect(shouldGenerateMore(4)).toBe(false);
      expect(shouldGenerateMore(5)).toBe(false);
    });
  });
});
