// Plan 30 Phase 4 (m2 / TC-3): the live-loop honesty gate. The hook's gating
// predicate is extracted pure (shouldRunLiveLoop) so it is Node-testable without a
// DOM. This proves the core honesty guarantee: relay-empty -> dormant (ZERO drain),
// tab hidden or segment inactive -> stops. Wired to the real engine to show a
// gated-off loop issues no tick at all.

import { describe, expect, it, vi } from 'vitest';
import { createLiveLoopEngine } from '../live-loop-core';
import { shouldRunLiveLoop } from '../../ui/channel/useChannelLiveLoop';

describe('shouldRunLiveLoop gate (TC-3)', () => {
  it('runs only when active AND relay-live AND tab-visible', () => {
    expect(shouldRunLiveLoop({ active: true, relayLive: true, documentVisible: true })).toBe(true);
    // Any single false -> dormant.
    expect(shouldRunLiveLoop({ active: false, relayLive: true, documentVisible: true })).toBe(false);
    expect(shouldRunLiveLoop({ active: true, relayLive: false, documentVisible: true })).toBe(false);
    expect(shouldRunLiveLoop({ active: true, relayLive: true, documentVisible: false })).toBe(false);
  });
});

describe('a gated-off loop issues ZERO drain', () => {
  it('never ticks while the gate is false (relay empty)', async () => {
    vi.useFakeTimers();
    try {
      let ticks = 0;
      const engine = createLiveLoopEngine({
        tick: async () => { ticks += 1; return { applied: false }; },
        random: () => 0.5,
      });
      // Simulate the hook's sync() with a relay-empty gate: engine stays stopped.
      const gateRun = shouldRunLiveLoop({ active: true, relayLive: false, documentVisible: true });
      if (gateRun) engine.start(); else engine.stop();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(ticks).toBe(0); // dormant: no relay = no network
      expect(engine.isRunning()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a running loop stops (no further ticks) when the gate flips to hidden/inactive', async () => {
    vi.useFakeTimers();
    try {
      let ticks = 0;
      const engine = createLiveLoopEngine({
        tick: async () => { ticks += 1; return { applied: false }; },
        random: () => 0.5,
      });
      // Gate open -> start + immediate tick.
      if (shouldRunLiveLoop({ active: true, relayLive: true, documentVisible: true })) engine.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(ticks).toBe(1);
      // Gate closes (tab hidden) -> stop; no further ticks.
      if (!shouldRunLiveLoop({ active: true, relayLive: true, documentVisible: false })) engine.stop();
      const afterStop = ticks;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(ticks).toBe(afterStop);
      expect(engine.isRunning()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
