import { describe, it, expect } from 'vitest';
import { computeTimerState } from '../timer';
import type { ActiveFast, LastCompletedFast } from '../types';

describe('computeTimerState - eating window', () => {
  const activeFast: ActiveFast = {
    id: 'af1',
    fastId: 'f1',
    protocol: '16:8',
    targetHours: 16,
    startedAt: '2026-03-17T20:00:00Z',
  };

  it('returns eating_window when within eating hours after fast completion', () => {
    const lastFast: LastCompletedFast = {
      endedAt: '2026-03-18T12:00:00Z', // ended at noon
      eatingHours: 8, // 8-hour eating window
    };
    // 2 hours into the eating window
    const now = new Date('2026-03-18T14:00:00Z');
    const state = computeTimerState(null, now, lastFast);

    expect(state.state).toBe('eating_window');
    expect(state.elapsed).toBe(7200); // 2 hours in seconds
    expect(state.remaining).toBe(21600); // 6 hours remaining
    expect(state.progress).toBeCloseTo(0.25); // 2/8
    expect(state.targetReached).toBe(false);
    expect(state.activeFast).toBeNull();
  });

  it('returns idle after eating window closes', () => {
    const lastFast: LastCompletedFast = {
      endedAt: '2026-03-18T12:00:00Z',
      eatingHours: 8,
    };
    // 9 hours after fast ended (window closed 1 hour ago)
    const now = new Date('2026-03-18T21:00:00Z');
    const state = computeTimerState(null, now, lastFast);

    expect(state.state).toBe('idle');
  });

  it('returns idle for protocols with 0 eating hours (extended fasts)', () => {
    const lastFast: LastCompletedFast = {
      endedAt: '2026-03-18T12:00:00Z',
      eatingHours: 0, // 36h, 48h, 72h protocols have no eating window
    };
    const now = new Date('2026-03-18T14:00:00Z');
    const state = computeTimerState(null, now, lastFast);

    expect(state.state).toBe('idle');
  });

  it('returns idle when no lastCompletedFast provided (backwards compatible)', () => {
    const state = computeTimerState(null, new Date());
    expect(state.state).toBe('idle');
  });

  it('returns idle when lastCompletedFast is null', () => {
    const state = computeTimerState(null, new Date(), null);
    expect(state.state).toBe('idle');
  });

  it('prioritizes active fast over eating window', () => {
    const lastFast: LastCompletedFast = {
      endedAt: '2026-03-17T12:00:00Z',
      eatingHours: 8,
    };
    const now = new Date('2026-03-17T14:00:00Z');
    // Active fast takes priority even if we're "in" an eating window
    const state = computeTimerState(activeFast, now, lastFast);

    expect(state.state).toBe('fasting');
    expect(state.activeFast).toBe(activeFast);
  });

  it('reaches target at end of eating window', () => {
    const lastFast: LastCompletedFast = {
      endedAt: '2026-03-18T12:00:00Z',
      eatingHours: 4,
    };
    // Exactly at the end of the eating window
    const now = new Date('2026-03-18T15:59:59Z');
    const state = computeTimerState(null, now, lastFast);

    expect(state.state).toBe('eating_window');
    expect(state.remaining).toBeGreaterThan(0);
    expect(state.remaining).toBeLessThanOrEqual(1);
  });

  it('handles OMAD 1-hour eating window', () => {
    const lastFast: LastCompletedFast = {
      endedAt: '2026-03-18T18:00:00Z',
      eatingHours: 1,
    };
    // 30 minutes into 1-hour OMAD window
    const now = new Date('2026-03-18T18:30:00Z');
    const state = computeTimerState(null, now, lastFast);

    expect(state.state).toBe('eating_window');
    expect(state.elapsed).toBe(1800);
    expect(state.remaining).toBe(1800);
    expect(state.progress).toBeCloseTo(0.5);
  });
});
