import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ORPHAN_GRACE_MS,
  DEFAULT_ORPHAN_POLL_MS,
  ORPHAN_WATCHDOG_DISABLE_ENV,
  ORPHAN_WATCHDOG_EXIT_CODE,
  ORPHAN_WATCHDOG_INTERVAL_ENV,
  installOrphanWatchdog,
  orphanWatchdogSkipReason,
  resolveOrphanPollMs,
  type OrphanWatchdogEvent,
  type OrphanWatchdogTarget,
} from '../orphan-watchdog';

/** A `process` stand-in whose ppid can be moved to simulate re-parenting. */
function fakeTarget(pid: number, ppid: number) {
  const state = { pid, ppid };
  const kills: Array<{ pid: number; signal: string }> = [];
  const exits: number[] = [];
  const target: OrphanWatchdogTarget = {
    get pid() { return state.pid; },
    get ppid() { return state.ppid; },
    kill(targetPid: number, signal: string) { kills.push({ pid: targetPid, signal }); return true; },
    exit(code?: number) { exits.push(code ?? 0); },
  };
  return { target, state, kills, exits };
}

/** Manual timer control, so no test depends on wall-clock time passing. */
function fakeTimers() {
  const intervals: Array<{ handler: () => void; ms: number; cleared: boolean }> = [];
  const timeouts: Array<{ handler: () => void; ms: number }> = [];
  return {
    intervals,
    timeouts,
    setInterval(handler: () => void, ms: number) {
      const entry = { handler, ms, cleared: false };
      intervals.push(entry);
      return entry;
    },
    clearInterval(handle: unknown) {
      (handle as { cleared: boolean }).cleared = true;
    },
    setTimeout(handler: () => void, ms: number) {
      const entry = { handler, ms };
      timeouts.push(entry);
      return entry;
    },
    /** Run every live interval handler once, the way one poll tick would. */
    tick() {
      for (const entry of intervals) if (!entry.cleared) entry.handler();
    },
  };
}

describe('orphanWatchdogSkipReason: the production-safety claim, as a test', () => {
  it('does not arm for a container PID 1 (ppid 0)', () => {
    expect(orphanWatchdogSkipReason(0, {})).toBe('no_supervising_parent');
  });

  it('does not arm under systemd or an init shim (ppid 1)', () => {
    expect(orphanWatchdogSkipReason(1, {})).toBe('no_supervising_parent');
  });

  it('arms under a real supervising parent', () => {
    expect(orphanWatchdogSkipReason(4242, {})).toBeNull();
  });

  it('does not arm when the opt-out env var is set, even with a real parent', () => {
    expect(orphanWatchdogSkipReason(4242, { [ORPHAN_WATCHDOG_DISABLE_ENV]: '1' }))
      .toBe('disabled_by_env');
  });

  it('treats only the exact value 1 as the opt-out', () => {
    expect(orphanWatchdogSkipReason(4242, { [ORPHAN_WATCHDOG_DISABLE_ENV]: 'true' })).toBeNull();
    expect(orphanWatchdogSkipReason(4242, { [ORPHAN_WATCHDOG_DISABLE_ENV]: '0' })).toBeNull();
  });

  it('does not arm on a nonsense ppid rather than polling forever', () => {
    expect(orphanWatchdogSkipReason(Number.NaN, {})).toBe('no_supervising_parent');
    expect(orphanWatchdogSkipReason(1.5, {})).toBe('no_supervising_parent');
    expect(orphanWatchdogSkipReason(-1, {})).toBe('no_supervising_parent');
  });
});

describe('resolveOrphanPollMs', () => {
  it('defaults when unset', () => {
    expect(resolveOrphanPollMs({})).toBe(DEFAULT_ORPHAN_POLL_MS);
  });

  it('honors a positive override', () => {
    expect(resolveOrphanPollMs({ [ORPHAN_WATCHDOG_INTERVAL_ENV]: '250' })).toBe(250);
  });

  it('falls back rather than disabling the poll on a bad value', () => {
    for (const raw of ['0', '-5', 'abc', '']) {
      expect(resolveOrphanPollMs({ [ORPHAN_WATCHDOG_INTERVAL_ENV]: raw })).toBe(DEFAULT_ORPHAN_POLL_MS);
    }
  });
});

describe('installOrphanWatchdog', () => {
  it('schedules nothing when it should not arm', () => {
    const { target } = fakeTarget(100, 1);
    const timers = fakeTimers();
    const uninstall = installOrphanWatchdog({ target, env: {}, ...timers });
    expect(timers.intervals).toHaveLength(0);
    expect(() => uninstall()).not.toThrow();
  });

  it('schedules nothing when disabled by env', () => {
    const { target } = fakeTarget(100, 500);
    const timers = fakeTimers();
    installOrphanWatchdog({ target, env: { [ORPHAN_WATCHDOG_DISABLE_ENV]: '1' }, ...timers });
    expect(timers.intervals).toHaveLength(0);
  });

  it('polls at the configured interval when armed', () => {
    const { target } = fakeTarget(100, 500);
    const timers = fakeTimers();
    installOrphanWatchdog({ target, env: {}, intervalMs: 111, ...timers });
    expect(timers.intervals).toHaveLength(1);
    expect(timers.intervals[0].ms).toBe(111);
  });

  it('reads the interval from env when no explicit interval is given', () => {
    const { target } = fakeTarget(100, 500);
    const timers = fakeTimers();
    installOrphanWatchdog({
      target,
      env: { [ORPHAN_WATCHDOG_INTERVAL_ENV]: '750' },
      ...timers,
    });
    expect(timers.intervals[0].ms).toBe(750);
  });

  it('stays quiet while the parent is alive', () => {
    const { target, kills, exits } = fakeTarget(100, 500);
    const timers = fakeTimers();
    const log = vi.fn();
    installOrphanWatchdog({ target, env: {}, log, ...timers });
    timers.tick();
    timers.tick();
    timers.tick();
    expect(log).not.toHaveBeenCalled();
    expect(kills).toHaveLength(0);
    expect(exits).toHaveLength(0);
  });

  it('SIGTERMs its own process the tick after the parent dies', () => {
    const { target, state, kills } = fakeTarget(100, 500);
    const timers = fakeTimers();
    const events: OrphanWatchdogEvent[] = [];
    installOrphanWatchdog({ target, env: {}, log: (e) => events.push(e), ...timers });

    timers.tick();
    expect(kills).toHaveLength(0);

    state.ppid = 1; // the parent died; init adopted us
    timers.tick();

    expect(kills).toEqual([{ pid: 100, signal: 'SIGTERM' }]);
    expect(events).toEqual([{
      event: 'orphaned',
      parentPid: 500,
      currentPid: 1,
      action: 'sigterm',
      graceMs: DEFAULT_ORPHAN_GRACE_MS,
    }]);
  });

  it('fires once and stops polling, even if ticks keep arriving', () => {
    const { target, state, kills } = fakeTarget(100, 500);
    const timers = fakeTimers();
    installOrphanWatchdog({ target, env: {}, ...timers });
    state.ppid = 1;
    timers.tick();
    timers.tick();
    timers.tick();
    expect(kills).toHaveLength(1);
    expect(timers.intervals[0].cleared).toBe(true);
  });

  it('hard-exits after the grace window if the clean shutdown never lands', () => {
    const { target, state, exits } = fakeTarget(100, 500);
    const timers = fakeTimers();
    installOrphanWatchdog({ target, env: {}, graceMs: 4_000, ...timers });
    state.ppid = 1;
    timers.tick();

    expect(exits).toHaveLength(0);
    expect(timers.timeouts).toHaveLength(1);
    expect(timers.timeouts[0].ms).toBe(4_000);

    timers.timeouts[0].handler();
    expect(exits).toEqual([ORPHAN_WATCHDOG_EXIT_CODE]);
  });

  it('exits immediately when the signal itself cannot be delivered', () => {
    const { target, state, exits } = fakeTarget(100, 500);
    const timers = fakeTimers();
    const throwing: OrphanWatchdogTarget = {
      get pid() { return target.pid; },
      get ppid() { return target.ppid; },
      kill() { throw new Error('ESRCH'); },
      exit(code?: number) { exits.push(code ?? 0); },
    };
    installOrphanWatchdog({ target: throwing, env: {}, ...timers });
    state.ppid = 1;
    timers.tick();
    expect(exits).toEqual([ORPHAN_WATCHDOG_EXIT_CODE]);
    // No grace timer: we already left.
    expect(timers.timeouts).toHaveLength(0);
  });

  it('still signals when the logger throws', () => {
    const { target, state, kills } = fakeTarget(100, 500);
    const timers = fakeTimers();
    installOrphanWatchdog({
      target,
      env: {},
      log: () => { throw new Error('logger exploded'); },
      ...timers,
    });
    state.ppid = 1;
    expect(() => timers.tick()).not.toThrow();
    expect(kills).toEqual([{ pid: 100, signal: 'SIGTERM' }]);
  });

  it('uninstall stops the poll so a later re-parent is ignored', () => {
    const { target, state, kills } = fakeTarget(100, 500);
    const timers = fakeTimers();
    const uninstall = installOrphanWatchdog({ target, env: {}, ...timers });
    uninstall();
    state.ppid = 1;
    timers.tick();
    expect(kills).toHaveLength(0);
  });
});
