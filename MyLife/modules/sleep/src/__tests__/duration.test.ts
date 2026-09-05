import { describe, expect, it } from 'vitest';
import {
  calculateDuration,
  calculateSleepLatency,
} from '../engine/duration';

describe('sleep duration engine', () => {
  it('handles overnight entries that cross midnight on the same calendar date', () => {
    expect(
      calculateDuration(
        '2026-03-01T23:00:00Z',
        '2026-03-01T07:00:00Z',
      ),
    ).toBe(8 * 60);
  });

  it('handles same-day durations', () => {
    expect(
      calculateDuration(
        '2026-03-01T13:00:00Z',
        '2026-03-01T13:45:00Z',
      ),
    ).toBe(45);
  });

  it('preserves explicit multi-day sleeps', () => {
    expect(
      calculateDuration(
        '2026-03-01T23:00:00Z',
        '2026-03-03T07:00:00Z',
      ),
    ).toBe(32 * 60);
  });

  it('calculates sleep latency across midnight on the same calendar date', () => {
    expect(
      calculateSleepLatency(
        '2026-03-01T23:50:00Z',
        '2026-03-01T00:10:00Z',
      ),
    ).toBe(20);
  });

  it('rejects impossible reversed chronology when dates disagree', () => {
    expect(() =>
      calculateDuration(
        '2026-03-02T23:00:00Z',
        '2026-03-01T07:00:00Z',
      ),
    ).toThrow(/wakeTime must be after bedtime/i);
  });
});
