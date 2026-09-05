import { describe, it, expect } from 'vitest';
import {
  calculateSobrietyDuration,
  calculateMoneySaved,
  calculateLifetimeStats,
  getPledgeStreak,
} from '../engine';

describe('Sobriety Engine', () => {
  describe('calculateSobrietyDuration', () => {
    it('returns 30 days for a quit date 30 days ago with no slips', () => {
      const quitDate = '2026-02-20T00:00:00.000Z';
      const now = new Date('2026-03-22T12:00:00.000Z').getTime();
      const result = calculateSobrietyDuration(quitDate, now);
      expect(result.totalDays).toBe(30);
      expect(result.years).toBe(0);
      expect(result.months).toBe(1);
      expect(result.days).toBe(0);
    });

    it('returns correct year/month/day breakdown for 1 year', () => {
      const quitDate = '2025-03-22T00:00:00.000Z';
      const now = new Date('2026-03-22T00:00:00.000Z').getTime();
      const result = calculateSobrietyDuration(quitDate, now);
      expect(result.totalDays).toBe(365);
      expect(result.years).toBe(1);
      expect(result.months).toBe(0);
      expect(result.days).toBe(0);
    });

    it('returns 0 for quit date today', () => {
      const now = new Date('2026-03-22T06:30:00.000Z').getTime();
      const quitDate = '2026-03-22T00:00:00.000Z';
      const result = calculateSobrietyDuration(quitDate, now);
      expect(result.totalDays).toBe(0);
      expect(result.hours).toBe(6);
      expect(result.minutes).toBe(30);
    });

    it('resets streak after a slip', () => {
      const quitDate = '2026-02-01T00:00:00.000Z';
      const now = new Date('2026-03-22T00:00:00.000Z').getTime();
      const slipDates = ['2026-03-01'];
      const result = calculateSobrietyDuration(quitDate, now, slipDates);
      // 20 days from Mar 2 00:00 to Mar 22 00:00
      expect(result.totalDays).toBe(20);
    });

    it('returns 0 for future quit date', () => {
      const now = new Date('2026-03-22T00:00:00.000Z').getTime();
      const quitDate = '2026-04-01T00:00:00.000Z';
      const result = calculateSobrietyDuration(quitDate, now);
      expect(result.totalDays).toBe(0);
    });
  });

  describe('calculateMoneySaved', () => {
    it('calculates correctly for 30 days at $15/day', () => {
      // $15/day = 1500 cents
      expect(calculateMoneySaved(30, 1500)).toBe(45000); // $450
    });

    it('returns 0 for 0 clean days', () => {
      expect(calculateMoneySaved(0, 1500)).toBe(0);
    });

    it('returns 0 for $0 daily cost', () => {
      expect(calculateMoneySaved(30, 0)).toBe(0);
    });
  });

  describe('calculateLifetimeStats', () => {
    it('calculates correctly with 2 slips', () => {
      const quitDate = '2025-12-12T00:00:00.000Z';
      const now = new Date('2026-03-22T00:00:00.000Z').getTime();
      const slipDates = ['2026-01-15', '2026-02-20'];
      const result = calculateLifetimeStats(quitDate, 1000, slipDates, now);
      expect(result.totalSlips).toBe(2);
      expect(result.totalCleanDays).toBe(98); // 100 - 2
      expect(result.currentStreak).toBe(29); // from Feb 21 to Mar 22 00:00
    });

    it('calculates correctly with no slips', () => {
      const quitDate = '2026-02-20T00:00:00.000Z';
      const now = new Date('2026-03-22T00:00:00.000Z').getTime();
      const result = calculateLifetimeStats(quitDate, 1500, [], now);
      expect(result.totalSlips).toBe(0);
      expect(result.totalCleanDays).toBe(30);
      expect(result.currentStreak).toBe(30);
      expect(result.longestStreak).toBe(30);
      expect(result.moneySavedCurrent).toBe(45000);
      expect(result.moneySavedLifetime).toBe(45000);
    });
  });

  describe('getPledgeStreak', () => {
    it('returns 5 for 5 consecutive pledges', () => {
      const today = '2026-03-22';
      const pledgeDates = ['2026-03-22', '2026-03-21', '2026-03-20', '2026-03-19', '2026-03-18'];
      expect(getPledgeStreak(pledgeDates, today)).toBe(5);
    });

    it('returns 0 for empty pledges', () => {
      expect(getPledgeStreak([], '2026-03-22')).toBe(0);
    });

    it('resets on gap', () => {
      const today = '2026-03-22';
      // Missing March 20
      const pledgeDates = ['2026-03-22', '2026-03-21', '2026-03-19'];
      expect(getPledgeStreak(pledgeDates, today)).toBe(2);
    });

    it('returns 0 if today is not pledged', () => {
      const today = '2026-03-22';
      const pledgeDates = ['2026-03-21', '2026-03-20'];
      expect(getPledgeStreak(pledgeDates, today)).toBe(0);
    });
  });
});
