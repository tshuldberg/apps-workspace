import { describe, it, expect } from 'vitest';
import {
  calculatePersonalizedTarget,
  calculateNextReminderTime,
  shouldSendReminder,
  generateReminderSlots,
} from '../engines/water-reminder-engine';

describe('Water Reminder Engine', () => {
  // ── calculatePersonalizedTarget ──

  describe('calculatePersonalizedTarget', () => {
    it('160 lbs returns 10 glasses', () => {
      expect(calculatePersonalizedTarget(160, 'lbs')).toBe(10);
    });

    it('70 kg returns 10 glasses', () => {
      // 70 * 33 / 29.5735 / 8 = 9.77, rounds to 10
      expect(calculatePersonalizedTarget(70, 'kg')).toBe(10);
    });

    it('50 lbs clamps to 4 glasses (minimum)', () => {
      expect(calculatePersonalizedTarget(50, 'lbs')).toBe(4);
    });

    it('500 lbs clamps to 30 glasses (maximum)', () => {
      // 500 * 0.5 / 8 = 31.25, clamped to 30
      expect(calculatePersonalizedTarget(500, 'lbs')).toBe(30);
    });

    it('0 lbs clamps to 4 glasses (edge)', () => {
      expect(calculatePersonalizedTarget(0, 'lbs')).toBe(4);
    });

    it('negative weight clamps to 4 glasses', () => {
      expect(calculatePersonalizedTarget(-10, 'lbs')).toBe(4);
    });

    it('200 lbs returns 13 glasses', () => {
      // 200 * 0.5 / 8 = 12.5, rounds to 13
      expect(calculatePersonalizedTarget(200, 'lbs')).toBe(13);
    });

    it('100 kg returns 14 glasses', () => {
      // 100 * 33 / 29.5735 / 8 = 13.95, rounds to 14
      expect(calculatePersonalizedTarget(100, 'kg')).toBe(14);
    });
  });

  // ── calculateNextReminderTime ──

  describe('calculateNextReminderTime', () => {
    it('at 14:00 with 60min interval returns 15:00 (next boundary)', () => {
      // With wakeStart 07:00, 14:00 is on a boundary (7 intervals from 07:00).
      // Next boundary is 15:00.
      const now = new Date('2026-03-22T14:00:00');
      const result = calculateNextReminderTime(now, 60, '07:00', '22:00');
      expect(result.getHours()).toBe(15);
      expect(result.getMinutes()).toBe(0);
    });

    it('at 14:15 with 60min interval returns 15:00 (round up)', () => {
      const now = new Date('2026-03-22T14:15:00');
      const result = calculateNextReminderTime(now, 60, '07:00', '22:00');
      expect(result.getHours()).toBe(15);
      expect(result.getMinutes()).toBe(0);
    });

    it('at 14:15 with 30min interval returns 14:30', () => {
      const now = new Date('2026-03-22T14:15:00');
      const result = calculateNextReminderTime(now, 30, '07:00', '22:00');
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it('at 21:50 with wakeEnd 22:00 and 60min interval returns tomorrow wakeStart', () => {
      const now = new Date('2026-03-22T21:50:00');
      const result = calculateNextReminderTime(now, 60, '07:00', '22:00');
      expect(result.getDate()).toBe(23); // tomorrow
      expect(result.getHours()).toBe(7);
      expect(result.getMinutes()).toBe(0);
    });

    it('before wakeStart returns wakeStart today', () => {
      const now = new Date('2026-03-22T05:30:00');
      const result = calculateNextReminderTime(now, 60, '07:00', '22:00');
      expect(result.getDate()).toBe(22); // today
      expect(result.getHours()).toBe(7);
      expect(result.getMinutes()).toBe(0);
    });

    it('after wakeEnd returns tomorrow wakeStart', () => {
      const now = new Date('2026-03-22T23:30:00');
      const result = calculateNextReminderTime(now, 60, '07:00', '22:00');
      expect(result.getDate()).toBe(23); // tomorrow
      expect(result.getHours()).toBe(7);
      expect(result.getMinutes()).toBe(0);
    });
  });

  // ── shouldSendReminder ──

  describe('shouldSendReminder', () => {
    it('returns true when count < target and reminders enabled', () => {
      expect(shouldSendReminder({
        enabled: true,
        currentCount: 3,
        target: 8,
        pauseDuringDryFast: false,
        isFastActive: false,
      })).toBe(true);
    });

    it('returns false when disabled', () => {
      expect(shouldSendReminder({
        enabled: false,
        currentCount: 3,
        target: 8,
        pauseDuringDryFast: false,
        isFastActive: false,
      })).toBe(false);
    });

    it('returns false when count >= target', () => {
      expect(shouldSendReminder({
        enabled: true,
        currentCount: 8,
        target: 8,
        pauseDuringDryFast: false,
        isFastActive: false,
      })).toBe(false);
    });

    it('returns false when count exceeds target', () => {
      expect(shouldSendReminder({
        enabled: true,
        currentCount: 10,
        target: 8,
        pauseDuringDryFast: false,
        isFastActive: false,
      })).toBe(false);
    });

    it('returns false when dry fast pause on and fast active', () => {
      expect(shouldSendReminder({
        enabled: true,
        currentCount: 3,
        target: 8,
        pauseDuringDryFast: true,
        isFastActive: true,
      })).toBe(false);
    });

    it('returns true when dry fast pause on but no fast active', () => {
      expect(shouldSendReminder({
        enabled: true,
        currentCount: 3,
        target: 8,
        pauseDuringDryFast: true,
        isFastActive: false,
      })).toBe(true);
    });
  });

  // ── generateReminderSlots ──

  describe('generateReminderSlots', () => {
    it('generates correct slots for 7AM-10PM with 60min interval (15 slots)', () => {
      const slots = generateReminderSlots(60, '07:00', '22:00');
      expect(slots).toHaveLength(15); // 7,8,9,...,21
      expect(slots[0]).toEqual({ hour: 7, minute: 0 });
      expect(slots[14]).toEqual({ hour: 21, minute: 0 });
    });

    it('generates correct slots for 30min interval', () => {
      const slots = generateReminderSlots(30, '07:00', '10:00');
      expect(slots).toHaveLength(6); // 7:00, 7:30, 8:00, 8:30, 9:00, 9:30
      expect(slots[0]).toEqual({ hour: 7, minute: 0 });
      expect(slots[1]).toEqual({ hour: 7, minute: 30 });
      expect(slots[5]).toEqual({ hour: 9, minute: 30 });
    });

    it('generates correct slots for 90min interval', () => {
      const slots = generateReminderSlots(90, '08:00', '22:00');
      // 8:00, 9:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00, 21:30
      expect(slots).toHaveLength(10);
      expect(slots[0]).toEqual({ hour: 8, minute: 0 });
      expect(slots[1]).toEqual({ hour: 9, minute: 30 });
    });

    it('handles waking hours spanning midnight', () => {
      const slots = generateReminderSlots(60, '22:00', '06:00');
      // 22:00, 23:00, 0:00, 1:00, 2:00, 3:00, 4:00, 5:00
      expect(slots).toHaveLength(8);
      expect(slots[0]).toEqual({ hour: 22, minute: 0 });
      expect(slots[1]).toEqual({ hour: 23, minute: 0 });
      expect(slots[2]).toEqual({ hour: 0, minute: 0 });
      expect(slots[7]).toEqual({ hour: 5, minute: 0 });
    });

    it('handles 120min interval', () => {
      const slots = generateReminderSlots(120, '07:00', '22:00');
      // 7:00, 9:00, 11:00, 13:00, 15:00, 17:00, 19:00, 21:00
      expect(slots).toHaveLength(8);
    });
  });
});
