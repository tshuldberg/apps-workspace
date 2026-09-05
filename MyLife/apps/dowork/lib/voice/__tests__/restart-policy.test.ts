import { describe, expect, it } from 'vitest';
import {
  createRestartPolicy,
  RESTART_HEALTHY_LIFETIME_MS,
  RESTART_MAX_IN_WINDOW,
  RESTART_MIN_GAP_MS,
  RESTART_WINDOW_MS,
} from '../restart-policy';

describe('restart-policy: min gap', () => {
  it('allows the first restart immediately', () => {
    const policy = createRestartPolicy();
    expect(policy.shouldRestart(1000)).toEqual({ kind: 'restart' });
  });

  it('throttles a restart that arrives inside the min gap', () => {
    const policy = createRestartPolicy();
    policy.shouldRestart(1000);
    const verdict = policy.shouldRestart(1000 + RESTART_MIN_GAP_MS - 150);
    expect(verdict).toEqual({ kind: 'wait', delayMs: 150 });
  });

  it('restarts again once the min gap has elapsed', () => {
    const policy = createRestartPolicy();
    policy.shouldRestart(1000);
    expect(policy.shouldRestart(1000 + RESTART_MIN_GAP_MS)).toEqual({ kind: 'restart' });
  });

  it('does not count a throttled attempt toward the window budget', () => {
    const policy = createRestartPolicy();
    // One real restart, then several sub-gap probes that all get throttled.
    policy.shouldRestart(0);
    expect(policy.shouldRestart(100).kind).toBe('wait');
    expect(policy.shouldRestart(200).kind).toBe('wait');
    // The next above-gap probe is only the 2nd real restart, well under the cap.
    expect(policy.shouldRestart(RESTART_MIN_GAP_MS)).toEqual({ kind: 'restart' });
  });
});

describe('restart-policy: window cap', () => {
  it('gives up after more than the cap of restarts inside the window', () => {
    const policy = createRestartPolicy();
    // Space restarts past the min gap but inside the 10s window.
    const spacing = 500;
    for (let i = 0; i < RESTART_MAX_IN_WINDOW; i += 1) {
      expect(policy.shouldRestart(i * spacing)).toEqual({ kind: 'restart' });
    }
    // The (cap + 1)th restart inside the window is refused.
    expect(policy.shouldRestart(RESTART_MAX_IN_WINDOW * spacing)).toEqual({ kind: 'stop' });
  });

  it('keeps refusing while the burst is still inside the window', () => {
    const policy = createRestartPolicy();
    for (let i = 0; i < RESTART_MAX_IN_WINDOW; i += 1) {
      policy.shouldRestart(i * 500);
    }
    expect(policy.shouldRestart(RESTART_MAX_IN_WINDOW * 500).kind).toBe('stop');
    // Still inside the 10s window a moment later: still stopped.
    expect(policy.shouldRestart(RESTART_MAX_IN_WINDOW * 500 + 600).kind).toBe('stop');
  });
});

describe('restart-policy: recovery after the window passes', () => {
  it('allows restarts again once the earlier burst ages out', () => {
    const policy = createRestartPolicy();
    for (let i = 0; i < RESTART_MAX_IN_WINDOW; i += 1) {
      policy.shouldRestart(i * 500);
    }
    const capHitAt = RESTART_MAX_IN_WINDOW * 500;
    expect(policy.shouldRestart(capHitAt).kind).toBe('stop');

    // Advance past the window so every recorded restart is pruned.
    const recovered = policy.shouldRestart(capHitAt + RESTART_WINDOW_MS);
    expect(recovered).toEqual({ kind: 'restart' });
  });
});

describe('restart-policy: custom options', () => {
  it('honors custom gap, window, and cap', () => {
    const policy = createRestartPolicy({ minGapMs: 100, windowMs: 1000, maxInWindow: 2 });
    expect(policy.shouldRestart(0)).toEqual({ kind: 'restart' });
    expect(policy.shouldRestart(50)).toEqual({ kind: 'wait', delayMs: 50 });
    expect(policy.shouldRestart(200)).toEqual({ kind: 'restart' });
    expect(policy.shouldRestart(400)).toEqual({ kind: 'stop' });
    // After the 1000ms window clears the first two restarts, restart is allowed.
    expect(policy.shouldRestart(1300)).toEqual({ kind: 'restart' });
  });
});

describe('restart-policy: healthy silence turnover (Android continuous mode)', () => {
  it('never gives up when sessions end on normal ~2s silence cycles', () => {
    const policy = createRestartPolicy();
    // 50 consecutive silence turnovers, each session living 2000ms: every one
    // must re-arm. Before the healthy-lifetime reset, the 5th cycle inside
    // 10s would have stopped hands-free voice for no reason.
    let now = 0;
    for (let i = 0; i < 50; i += 1) {
      expect(policy.shouldRestart(now)).toEqual({ kind: 'restart' });
      now += 2_000;
    }
  });

  it('still stops a genuine rapid-fire failure loop', () => {
    const policy = createRestartPolicy();
    // Sessions dying every 500ms are below the healthy lifetime, so the
    // budget burns and the loop is stopped.
    const verdicts: string[] = [];
    for (let i = 0; i <= RESTART_MAX_IN_WINDOW; i += 1) {
      verdicts.push(policy.shouldRestart(i * 500).kind);
    }
    expect(verdicts[verdicts.length - 1]).toBe('stop');
  });

  it('a healthy session after a partial burst clears the budget', () => {
    const policy = createRestartPolicy();
    // Three quick failures...
    for (let i = 0; i < 3; i += 1) {
      expect(policy.shouldRestart(i * 500).kind).toBe('restart');
    }
    // ...then recognition holds for a healthy lifetime before ending: the
    // burst history is forgotten and a fresh budget applies.
    expect(policy.shouldRestart(1_000 + RESTART_HEALTHY_LIFETIME_MS)).toEqual({ kind: 'restart' });
    for (let i = 1; i < RESTART_MAX_IN_WINDOW; i += 1) {
      expect(
        policy.shouldRestart(1_000 + RESTART_HEALTHY_LIFETIME_MS + i * 500).kind,
      ).toBe('restart');
    }
  });
});
