// Plan 30 Phase 3 (T3.1): the pure cadence + the single-flight scheduler.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOT_CADENCE_MS,
  HOT_WINDOW_MS,
  STEADY_CADENCE_MS,
  WORST_CASE_STEADY_DELAY_MS,
  createLiveLoopEngine,
  nextDelayMs,
  type LiveLoopTickResult,
} from '../(root)/data/live-loop-core';

describe('nextDelayMs', () => {
  it('fires immediately while a first tick is pending', () => {
    expect(nextDelayMs({ now: 0, hotUntil: 100_000, jitter: 0.5, firstTickPending: true })).toBe(0);
  });

  it('uses the 5s hot cadence inside the hot window', () => {
    expect(nextDelayMs({ now: 0, hotUntil: 60_000, jitter: 0.5, firstTickPending: false })).toBe(HOT_CADENCE_MS);
    // jitter 0 => -20%, jitter ~1 => +20%
    expect(nextDelayMs({ now: 0, hotUntil: 60_000, jitter: 0, firstTickPending: false })).toBe(4_000);
    expect(nextDelayMs({ now: 0, hotUntil: 60_000, jitter: 0.999, firstTickPending: false })).toBeCloseTo(6_000, -1);
  });

  it('uses the 10s steady cadence once the hot window has passed', () => {
    expect(nextDelayMs({ now: 120_000, hotUntil: 60_000, jitter: 0.5, firstTickPending: false })).toBe(STEADY_CADENCE_MS);
    expect(nextDelayMs({ now: 120_000, hotUntil: null, jitter: 0.5, firstTickPending: false })).toBe(STEADY_CADENCE_MS);
  });

  it('keeps the worst-case steady delay under the 15s AC-5 bound', () => {
    const worst = nextDelayMs({ now: 999_999, hotUntil: null, jitter: 0.999999, firstTickPending: false });
    expect(worst).toBeLessThanOrEqual(WORST_CASE_STEADY_DELAY_MS);
    expect(WORST_CASE_STEADY_DELAY_MS).toBeLessThan(15_000);
  });

  it('clamps an out-of-range jitter', () => {
    expect(nextDelayMs({ now: 0, hotUntil: null, jitter: -5, firstTickPending: false })).toBe(8_000);
    expect(nextDelayMs({ now: 0, hotUntil: null, jitter: 5, firstTickPending: false })).toBe(12_000);
  });
});

describe('createLiveLoopEngine (fake timers)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const idle: LiveLoopTickResult = { applied: false };

  it('fires an immediate tick on start, then polls at the hot cadence', async () => {
    const tick = vi.fn().mockResolvedValue(idle);
    const engine = createLiveLoopEngine({ tick, random: () => 0.5 });

    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1); // immediate-on-focus

    await vi.advanceTimersByTimeAsync(HOT_CADENCE_MS);
    expect(tick).toHaveBeenCalledTimes(2); // 5s hot cadence

    await vi.advanceTimersByTimeAsync(HOT_CADENCE_MS);
    expect(tick).toHaveBeenCalledTimes(3);
    engine.stop();
  });

  it('falls back to the 10s steady cadence after the hot window elapses', async () => {
    const tick = vi.fn().mockResolvedValue(idle);
    const engine = createLiveLoopEngine({ tick, random: () => 0.5 });

    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    // Drain the hot window with 5s hot ticks.
    await vi.advanceTimersByTimeAsync(HOT_WINDOW_MS);
    const hotCalls = tick.mock.calls.length;
    expect(hotCalls).toBeGreaterThanOrEqual(12); // ~1 immediate + 60s/5s

    // Now steady: exactly one tick per 10s.
    await vi.advanceTimersByTimeAsync(STEADY_CADENCE_MS);
    expect(tick).toHaveBeenCalledTimes(hotCalls + 1);
    engine.stop();
  });

  it('re-enters the hot window and calls onApplied when a tick applies work', async () => {
    const results: LiveLoopTickResult[] = [idle, { applied: true }, idle];
    let i = 0;
    const tick = vi.fn().mockImplementation(() => Promise.resolve(results[Math.min(i++, results.length - 1)]));
    const onApplied = vi.fn();
    // Advance the clock far past focus so we would be steady WITHOUT the applied bump.
    let clock = 0;
    const engine = createLiveLoopEngine({ tick, onApplied, random: () => 0.5, now: () => clock });

    engine.start();          // hotUntil = 60_000
    await vi.advanceTimersByTimeAsync(0);   // tick 1 (idle)
    clock = 200_000;         // beyond the original hot window
    await vi.advanceTimersByTimeAsync(HOT_CADENCE_MS); // tick 2 applies -> re-hot at 260_000
    expect(onApplied).toHaveBeenCalledTimes(1);
    engine.stop();
  });

  it('is single-flight: a slow tick never overlaps the next', async () => {
    const control: { resolve?: () => void } = {};
    const tick = vi.fn().mockImplementation(() => new Promise<LiveLoopTickResult>((resolveTick) => {
      control.resolve = () => resolveTick(idle);
    }));
    const engine = createLiveLoopEngine({ tick, random: () => 0.5 });

    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1); // in flight, unresolved

    // Even after a full cadence, no second tick starts while the first is pending.
    await vi.advanceTimersByTimeAsync(STEADY_CADENCE_MS * 2);
    expect(tick).toHaveBeenCalledTimes(1);

    control.resolve?.();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(HOT_CADENCE_MS);
    expect(tick).toHaveBeenCalledTimes(2);
    engine.stop();
  });

  it('a drain that settles after stop() is a no-op (no onApplied, no reschedule)', async () => {
    const control: { resolve?: () => void } = {};
    const tick = vi.fn().mockImplementation(() => new Promise<LiveLoopTickResult>((resolveTick) => {
      control.resolve = () => resolveTick({ applied: true });
    }));
    const onApplied = vi.fn();
    const engine = createLiveLoopEngine({ tick, onApplied, random: () => 0.5 });

    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1); // in flight
    engine.stop();

    control.resolve?.(); // settles AFTER stop
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(STEADY_CADENCE_MS * 2);
    expect(onApplied).not.toHaveBeenCalled();
    expect(tick).toHaveBeenCalledTimes(1); // no reschedule
  });

  it('stops scheduling after stop()', async () => {
    const tick = vi.fn().mockResolvedValue(idle);
    const engine = createLiveLoopEngine({ tick, random: () => 0.5 });

    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(tick).toHaveBeenCalledTimes(1);
    engine.stop();
    await vi.advanceTimersByTimeAsync(STEADY_CADENCE_MS * 5);
    expect(tick).toHaveBeenCalledTimes(1); // no ticks after stop
    expect(engine.isRunning()).toBe(false);
  });
});
