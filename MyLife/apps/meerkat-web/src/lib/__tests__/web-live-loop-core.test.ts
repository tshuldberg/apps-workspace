// Plan 30 Phase 4: the web twin of the mobile live-loop-core tests. Proves the
// SHARED cadence engine on the web build: immediate-on-focus, 5s hot / 10s steady,
// +-20% jitter with a provable worst-case bound, single-flight, and a clean stop.

import { describe, expect, it, vi } from 'vitest';
import {
  createLiveLoopEngine,
  nextDelayMs,
  HOT_CADENCE_MS,
  STEADY_CADENCE_MS,
  WORST_CASE_STEADY_DELAY_MS,
  JITTER_RATIO,
} from '../live-loop-core';

describe('nextDelayMs cadence', () => {
  it('is immediate while a first tick is pending', () => {
    expect(nextDelayMs({ now: 0, hotUntil: 1000, jitter: 0.5, firstTickPending: true })).toBe(0);
  });

  it('is 5s hot / 10s steady at the jitter midpoint', () => {
    expect(nextDelayMs({ now: 0, hotUntil: 60_000, jitter: 0.5, firstTickPending: false })).toBe(HOT_CADENCE_MS);
    expect(nextDelayMs({ now: 0, hotUntil: null, jitter: 0.5, firstTickPending: false })).toBe(STEADY_CADENCE_MS);
  });

  it('keeps the steady worst case under the 15s AC-5 bound', () => {
    const max = nextDelayMs({ now: 0, hotUntil: null, jitter: 1, firstTickPending: false });
    expect(max).toBe(WORST_CASE_STEADY_DELAY_MS);
    expect(max).toBe(Math.round(STEADY_CADENCE_MS * (1 + JITTER_RATIO)));
    expect(max).toBeLessThan(15_000);
  });
});

describe('createLiveLoopEngine', () => {
  it('fires immediately on start and reschedules after each settle (single-flight)', async () => {
    vi.useFakeTimers();
    try {
      let ticks = 0;
      const engine = createLiveLoopEngine({
        tick: async () => { ticks += 1; return { applied: false }; },
        now: () => Date.now(),
        random: () => 0.5,
      });
      engine.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(ticks).toBe(1); // immediate on focus
      // The loop keeps ticking on the steady cadence while running.
      await vi.advanceTimersByTimeAsync(STEADY_CADENCE_MS * 2);
      expect(ticks).toBeGreaterThan(1);
      engine.stop();
      const afterStop = ticks;
      await vi.advanceTimersByTimeAsync(STEADY_CADENCE_MS * 5);
      expect(ticks).toBe(afterStop); // stopped: no more ticks
    } finally {
      vi.useRealTimers();
    }
  });

  it('an applied>0 tick re-enters the hot window and calls onApplied', async () => {
    vi.useFakeTimers();
    try {
      const applied: boolean[] = [];
      let n = 0;
      const engine = createLiveLoopEngine({
        tick: async () => { n += 1; return { applied: n === 1 }; },
        onApplied: () => applied.push(true),
        random: () => 0.5,
      });
      engine.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(applied).toHaveLength(1);
      // Now hot: the next tick lands at 5s, not 10s.
      await vi.advanceTimersByTimeAsync(HOT_CADENCE_MS);
      expect(n).toBe(2);
      engine.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
