import { describe, expect, it } from 'vitest';
import { isRecapAvailable, calculateDurationMinutes, formatDuration } from '../engines/recap';

describe('recap engine', () => {
  describe('isRecapAvailable', () => {
    it('returns true for past events', () => {
      expect(isRecapAvailable('2020-01-01T00:00:00.000Z')).toBe(true);
    });

    it('returns false for future events', () => {
      expect(isRecapAvailable('2099-12-31T23:59:59.000Z')).toBe(false);
    });
  });

  describe('calculateDurationMinutes', () => {
    it('calculates duration from start and end', () => {
      expect(calculateDurationMinutes(
        '2026-06-15T19:00:00.000Z',
        '2026-06-15T22:00:00.000Z',
      )).toBe(180);
    });

    it('defaults to 120 minutes when endAt is null', () => {
      expect(calculateDurationMinutes('2026-06-15T19:00:00.000Z', null)).toBe(120);
    });

    it('returns 0 for same start and end', () => {
      expect(calculateDurationMinutes(
        '2026-06-15T19:00:00.000Z',
        '2026-06-15T19:00:00.000Z',
      )).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('formats hours and minutes', () => {
      expect(formatDuration(180)).toBe('3h');
      expect(formatDuration(90)).toBe('1h 30m');
      expect(formatDuration(45)).toBe('45m');
      expect(formatDuration(120)).toBe('2h');
    });
  });
});
