import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_PROGRAMS,
  interpolateSchedule,
  getCurrentDay,
  resolveDailyTarget,
  isProgramComplete,
} from '../engine';

describe('challenges engine', () => {
  describe('interpolateSchedule', () => {
    it('interpolates linearly between two keyframes', () => {
      const schedule = interpolateSchedule([{ day: 1, value: 5 }, { day: 30, value: 30 }], 30);
      expect(schedule.length).toBe(30);
      expect(schedule[0]).toBe(5);
      expect(schedule[29]).toBe(30);
      // Day 15 should be ~17-18
      expect(schedule[14]).toBeGreaterThanOrEqual(17);
      expect(schedule[14]).toBeLessThanOrEqual(18);
    });

    it('handles single keyframe (flat schedule)', () => {
      const schedule = interpolateSchedule([{ day: 1, value: 10 }], 14);
      expect(schedule.length).toBe(14);
      expect(schedule.every(v => v === 10)).toBe(true);
    });

    it('handles multiple keyframes', () => {
      const schedule = interpolateSchedule(
        [{ day: 1, value: 2 }, { day: 15, value: 10 }, { day: 30, value: 20 }],
        30,
      );
      expect(schedule[0]).toBe(2);
      expect(schedule[14]).toBe(10);
      expect(schedule[29]).toBe(20);
    });

    it('returns all 1s for empty keyframes', () => {
      const schedule = interpolateSchedule([], 7);
      expect(schedule.length).toBe(7);
      expect(schedule.every(v => v === 1)).toBe(true);
    });
  });

  describe('getCurrentDay', () => {
    it('returns 1 for start date = today', () => {
      expect(getCurrentDay('2026-03-22', '2026-03-22')).toBe(1);
    });

    it('returns correct day for dates apart', () => {
      expect(getCurrentDay('2026-03-01', '2026-03-15')).toBe(15);
    });
  });

  describe('resolveDailyTarget', () => {
    const schedule = [5, 6, 7, 8, 9, 10];

    it('returns correct target for day 1', () => {
      expect(resolveDailyTarget(schedule, 1)).toBe(5);
    });

    it('returns correct target for last day', () => {
      expect(resolveDailyTarget(schedule, 6)).toBe(10);
    });

    it('returns null for day beyond schedule', () => {
      expect(resolveDailyTarget(schedule, 7)).toBeNull();
    });

    it('returns null for day 0', () => {
      expect(resolveDailyTarget(schedule, 0)).toBeNull();
    });
  });

  describe('isProgramComplete', () => {
    it('returns false when currentDay <= durationDays', () => {
      expect(isProgramComplete(30, 30)).toBe(false);
    });

    it('returns true when currentDay > durationDays', () => {
      expect(isProgramComplete(31, 30)).toBe(true);
    });
  });

  describe('BUILT_IN_PROGRAMS', () => {
    it('contains 8 programs', () => {
      expect(BUILT_IN_PROGRAMS.length).toBe(8);
    });

    it('all have valid schedules matching durationDays', () => {
      for (const prog of BUILT_IN_PROGRAMS) {
        expect(prog.schedule.length).toBe(prog.durationDays);
        expect(prog.schedule.every(v => v >= 0)).toBe(true);
      }
    });
  });
});
