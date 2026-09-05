// Rapid-loop guard for the hands-free voice coach. In continuous mode the OS
// ends a recognition session on routine silence (common on Android, also iOS),
// so the hook has to re-arm recognition on every 'end'. This pure policy keeps
// that re-arm from turning into a battery-burning tight loop: it enforces a
// minimum gap between restarts and gives up after too many restarts inside a
// rolling window so the hook can surface an honest error and fall back to
// push-to-talk. No React, no timers, no native modules, so it is fully unit
// testable; the hook owns the clock and the setTimeout.

export const RESTART_MIN_GAP_MS = 400;
export const RESTART_WINDOW_MS = 10_000;
export const RESTART_MAX_IN_WINDOW = 4;
// A recognition session that survived at least this long before ending is a
// healthy silence turnover (Android routinely ends after ~2s of silence), not
// a crash loop. Healthy sessions reset the restart budget so normal quiet
// stretches can cycle forever; only rapid-fire endings burn the window.
export const RESTART_HEALTHY_LIFETIME_MS = 1_500;

export type RestartVerdict =
  // Re-arm recognition now.
  | { kind: 'restart' }
  // Too soon after the last restart: wait this long, then ask again.
  | { kind: 'wait'; delayMs: number }
  // Too many restarts inside the window: stop trying and surface an error.
  | { kind: 'stop' };

export interface RestartPolicy {
  // Records the current time as a restart attempt and returns the verdict. Call
  // once per 'end' (and again when a 'wait' delay elapses).
  shouldRestart(nowMs: number): RestartVerdict;
}

export interface RestartPolicyOptions {
  minGapMs?: number;
  windowMs?: number;
  maxInWindow?: number;
  healthyLifetimeMs?: number;
}

export function createRestartPolicy(options: RestartPolicyOptions = {}): RestartPolicy {
  const minGapMs = options.minGapMs ?? RESTART_MIN_GAP_MS;
  const windowMs = options.windowMs ?? RESTART_WINDOW_MS;
  const maxInWindow = options.maxInWindow ?? RESTART_MAX_IN_WINDOW;
  const healthyLifetimeMs = options.healthyLifetimeMs ?? RESTART_HEALTHY_LIFETIME_MS;

  // Timestamps of the restarts we actually authorized, oldest first.
  const restartsAt: number[] = [];

  return {
    shouldRestart(nowMs: number): RestartVerdict {
      // The gap since the LAST authorized restart is (approximately) the
      // lifetime of the recognition session that just ended. A session that
      // lived a healthy lifetime is normal silence turnover, not a failure
      // loop: forget the burst history entirely so continuous mode can cycle
      // through quiet stretches indefinitely.
      const newest = restartsAt.length > 0 ? restartsAt[restartsAt.length - 1] : null;
      if (newest !== null && nowMs - newest >= healthyLifetimeMs) {
        restartsAt.length = 0;
      }

      // Drop restarts that aged out of the window so a device that recovers is
      // allowed to try again once an earlier burst passes.
      while (restartsAt.length > 0 && nowMs - restartsAt[0] >= windowMs) {
        restartsAt.shift();
      }

      const last = restartsAt.length > 0 ? restartsAt[restartsAt.length - 1] : null;
      if (last !== null && nowMs - last < minGapMs) {
        // Throttle: never re-arm faster than once per minGap. The caller waits
        // and asks again, so this never silently kills recognition.
        return { kind: 'wait', delayMs: minGapMs - (nowMs - last) };
      }

      if (restartsAt.length >= maxInWindow) {
        // More than maxInWindow restarts inside the window: give up.
        return { kind: 'stop' };
      }

      restartsAt.push(nowMs);
      return { kind: 'restart' };
    },
  };
}
